import { logger } from '../telemetry/logger.ts';
import { CoreError } from '../core/client.ts';
import { MatchRank, rankMatch } from './match.ts';
import { ownerBucket, PUBLIC_BUCKET } from './ownership.ts';
import { ENTITY_TYPES } from './registry.ts';
import {
  EntityKind,
  type Candidate,
  type EntityContext,
  type EntityType,
} from './types.ts';

export type Resolved = {
  kind: EntityKind;
  id: string;
  raw: Record<string, unknown>;
};

export const EntityVisibility = {
  Public: 'public',
  Private: 'private',
} as const;

export type EntityVisibility =
  (typeof EntityVisibility)[keyof typeof EntityVisibility];

export type FoundMatch = {
  kind: EntityKind;
  id: string;
  name: string;
  /** Absent for an id with no bucket, such as a deployment registered in Core's config. */
  visibility?: EntityVisibility;
};

export type SearchOutcome =
  | {
      status: 'found';
      matches: FoundMatch[];
      exact: boolean;
      skipped?: EntityKind[];
      idOnly?: EntityKind[];
    }
  | {
      status: 'not_found';
      searched: EntityKind[];
      skipped: EntityKind[];
      idOnly?: EntityKind[];
    };

const SEARCH_DEADLINE_MS = 25_000;

const BARE_ID_ORDER: EntityKind[] = [EntityKind.Agent, EntityKind.Toolset];

const isNotFound = (error: unknown): boolean =>
  error instanceof CoreError && error.status === 404;

const typeOfKind = (
  types: EntityType[],
  kind: EntityKind,
): EntityType | undefined => types.find((type) => type.kind === kind);

/**
 * Fetches one entity by its full id. An explicit `kind` picks the type; else
 * the id prefix does; a bare id is tried as an agent, then as a toolset.
 * @param ctx - config, credential and correlation context
 * @param id - exact entity id
 * @param kind - optional entity type hint
 * @param types - registered types, injectable for tests
 */
export const resolveById = async (
  ctx: EntityContext,
  id: string,
  kind?: EntityKind,
  types: EntityType[] = ENTITY_TYPES,
): Promise<Resolved> => {
  const trimmed = id.trim();
  const explicit = kind ? typeOfKind(types, kind) : undefined;
  const prefixed = explicit ?? types.find((type) => type.matchesId(trimmed));
  if (prefixed) {
    return {
      kind: prefixed.kind,
      id: trimmed,
      raw: await prefixed.fetch(ctx, trimmed),
    };
  }

  let firstNotFound: unknown;
  for (const bareKind of BARE_ID_ORDER) {
    const type = typeOfKind(types, bareKind);
    if (!type) continue;
    try {
      return {
        kind: type.kind,
        id: trimmed,
        raw: await type.fetch(ctx, trimmed),
      };
    } catch (error) {
      if (!isNotFound(error)) throw error;
      firstNotFound ??= error;
    }
  }
  throw firstNotFound ?? new CoreError(404, 'That entity no longer exists.');
};

const displayName = (candidate: Candidate): string =>
  candidate.names[0] ?? candidate.id;

const visibilityFields = (id: string): { visibility?: EntityVisibility } => {
  const bucket = ownerBucket(id);
  if (bucket === undefined) return {};
  return {
    visibility:
      bucket === PUBLIC_BUCKET
        ? EntityVisibility.Public
        : EntityVisibility.Private,
  };
};

const bestMatches = (
  candidates: Candidate[],
  name: string,
): { matches: Candidate[]; isExact: boolean } => {
  const ranked = candidates
    .map((candidate) => ({ candidate, rank: rankMatch(name, candidate.names) }))
    .filter(({ rank }) => rank !== MatchRank.None);
  const best = ranked.reduce((max, { rank }) => Math.max(max, rank), 0);
  return {
    matches: ranked
      .filter(({ rank }) => rank === best)
      .map(({ candidate }) => candidate),
    isExact: best === MatchRank.Exact,
  };
};

const uniqueCandidates = (candidates: Candidate[]): Candidate[] => {
  const byKey = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = `${candidate.kind}\u0000${candidate.id}`;
    if (!byKey.has(key)) byKey.set(key, candidate);
  }
  return [...byKey.values()];
};

/**
 * Finds an entity by name across the registered types (or one, with `kind`).
 * The full list of every type runs in parallel, so a display name that
 * differs from the id is always matched, whatever else matched exactly. A type
 * with a cheap names-only listing also runs it: when the full list fails or
 * the search deadline aborts it, the type is still matched by id and reported
 * as `idOnly`. Only a type with neither listing is `skipped`. The whole search
 * stops at `deadlineMs`: calls still in flight are aborted. Only the
 * best-ranked matches are kept, public and private ones side by side, and the
 * outcome says whether they match the name exactly. No detail is fetched: the
 * caller picks one by id.
 * @param ctx - config, credential and correlation context
 * @param name - what the user called the entity
 * @param kind - optional entity type hint
 * @param types - registered types, injectable for tests
 * @param deadlineMs - total time allowed for listing, injectable for tests
 */
export const findCandidates = async (
  ctx: EntityContext,
  name: string,
  kind?: EntityKind,
  types: EntityType[] = ENTITY_TYPES,
  deadlineMs: number = SEARCH_DEADLINE_MS,
): Promise<SearchOutcome> => {
  const searched = kind ? types.filter((type) => type.kind === kind) : types;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const searchCtx: EntityContext = { ...ctx, signal: controller.signal };

  let results: {
    full: PromiseSettledResult<Candidate[]>;
    names?: PromiseSettledResult<Candidate[]>;
  }[];
  try {
    results = await Promise.all(
      searched.map(async (type) => {
        const [full, names] = await Promise.allSettled([
          type.list(searchCtx),
          type.listNames?.(searchCtx) ?? Promise.resolve(undefined),
        ]);
        return {
          full,
          ...(type.listNames && names
            ? { names: names as PromiseSettledResult<Candidate[]> }
            : {}),
        };
      }),
    );
  } finally {
    clearTimeout(timer);
  }

  const failures = new Map<EntityKind, unknown>();
  const idOnly: EntityKind[] = [];
  const candidates = results.flatMap(({ full, names }, index) => {
    const type = searched[index]!;
    if (full.status === 'fulfilled') return full.value;
    const reason = full.reason as unknown;
    logger.error(
      `find_entities could not list ${type.kind}: ${reason instanceof Error ? reason.message : 'unexpected error'} (correlation ${JSON.stringify(ctx.correlation.correlationId)})`,
    );
    if (names?.status === 'fulfilled') {
      idOnly.push(type.kind);
      return names.value;
    }
    failures.set(type.kind, reason);
    return [];
  });
  const { matches, isExact } = bestMatches(uniqueCandidates(candidates), name);

  if (searched.length > 0 && failures.size === searched.length) {
    throw failures.get(searched.find((type) => failures.has(type.kind))!.kind);
  }

  const skipped = searched
    .filter((type) => failures.has(type.kind))
    .map((type) => type.kind);
  const notes = {
    ...(idOnly.length ? { idOnly } : {}),
  };
  if (matches.length === 0) {
    return {
      status: 'not_found',
      searched: searched.map((type) => type.kind),
      skipped,
      ...notes,
    };
  }
  return {
    status: 'found',
    matches: matches.map((candidate) => ({
      kind: candidate.kind,
      id: candidate.id,
      name: displayName(candidate),
      ...visibilityFields(candidate.id),
    })),
    exact: isExact,
    ...(skipped.length ? { skipped } : {}),
    ...notes,
  };
};

import { CoreError } from '../core/client.ts';
import { MatchRank, rankMatch } from './match.ts';
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

export type SearchOutcome =
  | { status: 'found'; resolved: Resolved; skipped?: EntityKind[] }
  | {
      status: 'ambiguous';
      matches: { kind: EntityKind; id: string; name: string }[];
    }
  | { status: 'not_found'; searched: EntityKind[]; skipped: EntityKind[] };

const SEARCH_DEADLINE_MS = 50_000;
const TOTAL_BUDGET_MS = 60_000;
const MIN_FETCH_MS = 5_000;

const BARE_ID_ORDER: EntityKind[] = [EntityKind.Agent, EntityKind.Toolset];

const isAuthError = (error: unknown): boolean =>
  error instanceof CoreError && (error.status === 401 || error.status === 403);

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

const bestMatches = (candidates: Candidate[], name: string): Candidate[] => {
  const ranked = candidates
    .map((candidate) => ({ candidate, rank: rankMatch(name, candidate.names) }))
    .filter(({ rank }) => rank !== MatchRank.None);
  const best = Math.max(0, ...ranked.map(({ rank }) => rank));
  return ranked
    .filter(({ rank }) => rank === best)
    .map(({ candidate }) => candidate);
};

const isPublicId = (id: string): boolean => id.split('/')[1] === 'public';

/**
 * Drops a public candidate when the same kind also matched a non-public one:
 * Core lists only the caller's own, shared-with-them and public entities, so a
 * non-public match is one the caller can already use and is the likelier
 * target of a name that also matches its published copy.
 * @param candidates - best-ranked matches
 */
const preferNonPublic = (candidates: Candidate[]): Candidate[] => {
  const kindsWithNonPublic = new Set(
    candidates
      .filter((candidate) => !isPublicId(candidate.id))
      .map((candidate) => candidate.kind),
  );
  return candidates.filter(
    (candidate) =>
      !isPublicId(candidate.id) || !kindsWithNonPublic.has(candidate.kind),
  );
};

const uniqueCandidates = (candidates: Candidate[]): Candidate[] => {
  const byKey = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = `${candidate.kind}\u0000${candidate.id}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.raw && candidate.raw)) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()];
};

/**
 * Finds an entity by name across the registered types (or one, with `kind`).
 * Lists run in parallel. A type with a cheap names-only listing is searched
 * through it first, and only an exact name match counts from it, so a loose
 * id match never stands in for the right entity. The full list (slow on a
 * large Core, and the only way to match a display name that differs from the
 * id) runs when no exact match was found anywhere, or when the names call
 * failed. The whole search stops at `deadlineMs`: calls still in flight are
 * aborted and their types are reported as skipped. Only the best-ranked
 * matches are kept.
 * @param ctx - config, credential and correlation context
 * @param name - what the user called the entity
 * @param kind - optional entity type hint
 * @param types - registered types, injectable for tests
 * @param deadlineMs - total time allowed for listing, injectable for tests
 */
export const searchByName = async (
  ctx: EntityContext,
  name: string,
  kind?: EntityKind,
  types: EntityType[] = ENTITY_TYPES,
  deadlineMs: number = SEARCH_DEADLINE_MS,
): Promise<SearchOutcome> => {
  const startedAt = Date.now();
  const searched = kind ? types.filter((type) => type.kind === kind) : types;
  const failures = new Map<EntityKind, unknown>();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const searchCtx: EntityContext = { ...ctx, signal: controller.signal };

  const collect = async (
    listed: EntityType[],
    useNames: boolean,
  ): Promise<Candidate[]> => {
    const settled = await Promise.allSettled(
      listed.map((type) =>
        useNames && type.listNames
          ? type.listNames(searchCtx)
          : type.list(searchCtx),
      ),
    );
    return settled.flatMap((result, index) => {
      const type = listed[index]!;
      if (result.status === 'fulfilled') {
        return useNames && type.listNames
          ? result.value.filter(
              (candidate) =>
                rankMatch(name, candidate.names) === MatchRank.Exact,
            )
          : result.value;
      }
      const reason = result.reason as unknown;
      failures.set(type.kind, reason);
      console.error(
        `show_entity_card could not list ${type.kind}: ${reason instanceof Error ? reason.message : 'unexpected error'} (correlation ${JSON.stringify(ctx.correlation.correlationId)})`,
      );
      return [];
    });
  };

  let candidates: Candidate[];
  try {
    candidates = await collect(searched, true);
    const hasExact = candidates.some(
      (candidate) => rankMatch(name, candidate.names) === MatchRank.Exact,
    );
    const withFallback = searched.filter(
      (type) =>
        type.listNames &&
        !isAuthError(failures.get(type.kind)) &&
        (!hasExact || failures.has(type.kind)),
    );
    if (withFallback.length > 0) {
      const fallbackKinds = new Set(withFallback.map((type) => type.kind));
      for (const fallbackKind of fallbackKinds) failures.delete(fallbackKind);
      candidates = [
        ...candidates.filter((candidate) => !fallbackKinds.has(candidate.kind)),
        ...(await collect(withFallback, false)),
      ];
    }
  } finally {
    clearTimeout(timer);
  }
  const matches = preferNonPublic(
    bestMatches(uniqueCandidates(candidates), name),
  );

  if (searched.length > 0 && failures.size === searched.length) {
    throw failures.get(searched.find((type) => failures.has(type.kind))!.kind);
  }

  if (matches.length === 0) {
    return {
      status: 'not_found',
      searched: searched.map((type) => type.kind),
      skipped: searched
        .filter((type) => failures.has(type.kind))
        .map((type) => type.kind),
    };
  }
  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      matches: matches.map((candidate) => ({
        kind: candidate.kind,
        id: candidate.id,
        name: displayName(candidate),
      })),
    };
  }

  const [match] = matches as [Candidate];
  const fetchCtx: EntityContext = {
    ...ctx,
    signal: AbortSignal.timeout(
      Math.max(MIN_FETCH_MS, TOTAL_BUDGET_MS - (Date.now() - startedAt)),
    ),
  };
  const raw =
    match.raw ??
    (await typeOfKind(searched, match.kind)!.fetch(fetchCtx, match.id));
  const skipped = searched
    .filter((type) => failures.has(type.kind))
    .map((type) => type.kind);
  return {
    status: 'found',
    resolved: { kind: match.kind, id: match.id, raw },
    ...(skipped.length ? { skipped } : {}),
  };
};

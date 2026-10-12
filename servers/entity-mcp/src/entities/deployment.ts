import { coreGetJson, coreGetRecord } from '../core/client.ts';
import { PRIMARY_LOCALE, resolveLocalizedText } from '../mapping/locale.ts';
import { decodeResourceUrl, encodeDeploymentId } from './ids.ts';
import { lastSegment } from './match.ts';
import { isRecord, nonEmptyText, pickField, requireText } from './shared.ts';
import type { EntityKind, EntityType, MappedEntity } from './types.ts';

const NO_DESCRIPTION = 'No description provided.';
const FULL_LIST_TIMEOUT_MS = 60_000;

/**
 * Maps the name and description shared by Core applications and toolsets. A
 * description is optional in Core (many agents have none or an empty one) but
 * required by the card, so a fixed fallback stands in for it.
 * @param raw - a record from /openai/applications or /openai/toolsets
 * @param activeLocale - locale requested by the host
 * @param kindLabel - label shown on the card, e.g. `Agent`
 */
export const mapDeployment = (
  raw: Record<string, unknown>,
  activeLocale: string,
  kindLabel: string,
): Omit<MappedEntity, 'sections'> => {
  const resolvedName = resolveLocalizedText(
    pickField(raw, 'display_name', 'displayName'),
    activeLocale,
    PRIMARY_LOCALE,
  );
  const name = resolvedName || (typeof raw.id === 'string' ? raw.id : '');
  return {
    name: requireText(name, 'display_name'),
    description:
      nonEmptyText(
        resolveLocalizedText(raw.description, activeLocale, PRIMARY_LOCALE),
      ) ?? NO_DESCRIPTION,
    kindLabel,
  };
};

export type DeploymentTypeOptions = {
  kind: EntityKind;
  route: 'applications' | 'toolsets';
  idPrefix: string;
  namesType?: 'application';
  map: EntityType['map'];
};

/**
 * Builds the cheap names-only listing from `/v1/deployment-names`, which
 * returns ids without reading each entity (about a second where the full list
 * takes tens of seconds on a large Core).
 * @param options - kind and the `type` value to request
 */
const listDeploymentNames =
  (options: DeploymentTypeOptions): EntityType['list'] =>
  async (ctx) => {
    const body = await coreGetJson(
      ctx,
      `/v1/deployment-names?type=${options.namesType}`,
    );
    const items = Array.isArray(body) ? body.filter(isRecord) : [];
    return items.flatMap((item) => {
      const listedId = nonEmptyText(item.id);
      if (!listedId) return [];
      const id = decodeResourceUrl(listedId);
      return [{ kind: options.kind, id, names: [lastSegment(id)] }];
    });
  };

/**
 * Builds an `EntityType` for a Core deployment collection, where the list
 * response already carries every field the card needs. Core lists
 * resource-based ids as percent-encoded urls, but its detail routes expect
 * the plain id (they encode it themselves), so list ids are decoded here.
 * @param options - kind, `/openai/{route}` collection, id prefix and mapper
 */
export const createDeploymentType = (
  options: DeploymentTypeOptions,
): EntityType => ({
  kind: options.kind,
  matchesId: (id) => id.trim().startsWith(options.idPrefix),
  fetch: (ctx, id) =>
    coreGetRecord(ctx, `/openai/${options.route}/${encodeDeploymentId(id)}`),
  list: async (ctx) => {
    const body = await coreGetJson(ctx, `/openai/${options.route}`, {
      timeoutMs: FULL_LIST_TIMEOUT_MS,
    });
    const data =
      isRecord(body) && Array.isArray(body.data)
        ? body.data.filter(isRecord)
        : [];
    return data.flatMap((item) => {
      const listedId = nonEmptyText(item.id);
      if (!listedId) return [];
      const id = decodeResourceUrl(listedId);
      const displayName = resolveLocalizedText(
        pickField(item, 'display_name', 'displayName'),
        PRIMARY_LOCALE,
        PRIMARY_LOCALE,
      );
      return [
        {
          kind: options.kind,
          id,
          names: [displayName, lastSegment(id)].filter(Boolean),
          raw: item,
        },
      ];
    });
  },
  ...(options.namesType ? { listNames: listDeploymentNames(options) } : {}),
  map: options.map,
});

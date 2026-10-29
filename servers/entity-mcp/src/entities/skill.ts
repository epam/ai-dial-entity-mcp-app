import { coreGetRecord } from '../core/client.ts';
import { decodeResourceUrl, parseBucketId } from './ids.ts';
import { lastSegment } from './match.ts';
import { listOwnAndPublic, withToken } from './paging.ts';
import { isRecord, nonEmptyText, requireText } from './shared.ts';
import { EntityKind, type EntityType, type MappedEntity } from './types.ts';

const PREFIX = 'skills';

/**
 * Maps a Core skill record onto the card's entity fields.
 * @param raw - body of GET /v2/metadata/skills/{bucket}/{path}, or a list item
 */
export const mapSkill = (raw: Record<string, unknown>): MappedEntity => {
  const attributes = isRecord(raw.attributes) ? raw.attributes : {};
  return {
    name: requireText(attributes.name, 'attributes.name'),
    description: requireText(attributes.description, 'attributes.description'),
    kindLabel: 'Skill',
    sections: [],
  };
};

export const skillType: EntityType = {
  kind: EntityKind.Skill,
  matchesId: (id) => id.trim().startsWith(`${PREFIX}/`),
  fetch: (ctx, id) => {
    const { bucket, path } = parseBucketId(PREFIX, id);
    return coreGetRecord(ctx, `/v2/metadata/${PREFIX}/${bucket}/${path}`);
  },
  list: async (ctx) => {
    const items = await listOwnAndPublic(
      ctx,
      (bucket, token) =>
        `/v2/metadata/${PREFIX}/${bucket}/?recursive=true&limit=1000${withToken(token)}`,
    );
    return items.flatMap((item) => {
      if (item.nodeType !== 'ITEM' || typeof item.url !== 'string') return [];
      const id = decodeResourceUrl(item.url);
      const attributes = isRecord(item.attributes) ? item.attributes : {};
      const name = nonEmptyText(attributes.name);
      const complete =
        name !== undefined &&
        nonEmptyText(attributes.description) !== undefined;
      return [
        {
          kind: EntityKind.Skill,
          id,
          names: [lastSegment(id), ...(name ? [name] : [])],
          ...(complete ? { raw: { attributes } } : {}),
        },
      ];
    });
  },
  map: (raw) => mapSkill(raw),
};

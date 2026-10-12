import { coreGetRecord } from '../core/client.ts';
import { decodeResourceUrl, parseBucketId } from './ids.ts';
import { fetchUserBucket, listAllPages, withToken } from './paging.ts';
import { nonEmptyText, requireText } from './shared.ts';
import { EntityKind, type EntityType, type MappedEntity } from './types.ts';

const PREFIX = 'prompts';
const DESCRIPTION_LIMIT = 200;

const summarize = (content: string): string => {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > DESCRIPTION_LIMIT
    ? `${oneLine.slice(0, DESCRIPTION_LIMIT)}…`
    : oneLine;
};

/**
 * Maps a Core prompt record onto the card. The record's own description is
 * used when present; otherwise the content stands in as a one-line summary.
 * The full content is shown as a text section.
 * @param raw - body of GET /v1/prompts/{bucket}/{path}
 */
export const mapPrompt = (raw: Record<string, unknown>): MappedEntity => {
  const content = requireText(raw.content, 'content');
  return {
    name: requireText(raw.name, 'name'),
    description: nonEmptyText(raw.description) ?? summarize(content),
    kindLabel: 'Prompt',
    sections: [{ type: 'text', label: 'Prompt', text: content }],
  };
};

export const promptType: EntityType = {
  kind: EntityKind.Prompt,
  matchesId: (id) => id.trim().startsWith(`${PREFIX}/`),
  fetch: (ctx, id) => {
    const { bucket, path } = parseBucketId(PREFIX, id);
    return coreGetRecord(ctx, `/v1/${PREFIX}/${bucket}/${path}`);
  },
  list: async (ctx) => {
    const bucket = encodeURIComponent(await fetchUserBucket(ctx));
    const items = await listAllPages(
      ctx,
      (token) =>
        `/v1/metadata/${PREFIX}/${bucket}/?recursive=true&limit=1000${withToken(token)}`,
    );
    return items.flatMap((item) => {
      const name = nonEmptyText(item.name);
      if (item.nodeType !== 'ITEM' || typeof item.url !== 'string' || !name) {
        return [];
      }
      return [
        {
          kind: EntityKind.Prompt,
          id: decodeResourceUrl(item.url),
          names: [name],
        },
      ];
    });
  },
  map: (raw) => mapPrompt(raw),
};

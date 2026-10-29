import { CoreError, coreGetRecord } from '../core/client.ts';
import type { EntityContext } from './types.ts';

export const PUBLIC_BUCKET = 'public';

const RESOURCE_PREFIXES = new Set([
  'applications',
  'toolsets',
  'skills',
  'prompts',
]);

/**
 * Reads the owner bucket out of an entity id the way DIAL Chat does:
 * `{prefix}/{bucket}/{path}` for the known resource prefixes, and
 * `{bucket}/{name}` for the prefix-less id Core can return for a copied
 * toolset. A bare id (a config-registered deployment such as `gpt-4o`) has no
 * bucket.
 * @param id - full entity id
 */
export const ownerBucket = (id: string): string | undefined => {
  const segments = id.trim().split('/');
  const prefixed = RESOURCE_PREFIXES.has(segments[0] ?? '');
  const bucket = prefixed ? segments[1] : segments[0];
  const hasPath = segments.length >= (prefixed ? 3 : 2);
  return hasPath && bucket ? bucket : undefined;
};

/**
 * Whether an id belongs to the shared `public` bucket.
 * @param id - full entity id
 */
export const isPublicId = (id: string): boolean =>
  ownerBucket(id) === PUBLIC_BUCKET;

/**
 * Reads the caller's own bucket from Core. Returns undefined when Core does
 * not answer or answers without one, so the caller is treated as owning
 * nothing.
 * @param ctx - config, credential and correlation context
 */
const fetchOwnBucket = async (
  ctx: EntityContext,
): Promise<string | undefined> => {
  try {
    const { bucket } = await coreGetRecord(ctx, '/v1/bucket');
    return typeof bucket === 'string' && bucket.trim()
      ? bucket.trim()
      : undefined;
  } catch (error) {
    const reason =
      error instanceof CoreError ? error.message : 'unexpected error';
    console.error(
      `could not read the caller's bucket: ${reason} (correlation ${JSON.stringify(ctx.correlation.correlationId)})`,
    );
    return undefined;
  }
};

/**
 * Whether the caller owns an entity, which is what lets the card offer Edit.
 * An entity without a bucket, a public one and one in another user's bucket
 * all count as not owned, as does any failure to learn the caller's bucket.
 * @param ctx - config, credential and correlation context
 * @param id - full entity id
 */
export const isOwnEntity = async (
  ctx: EntityContext,
  id: string,
): Promise<boolean> => {
  const owner = ownerBucket(id);
  if (!owner || owner === PUBLIC_BUCKET) return false;
  return owner === (await fetchOwnBucket(ctx));
};

import { CoreError, FALLBACK_MESSAGE, coreGetJson } from '../core/client.ts';
import { PUBLIC_BUCKET } from './ownership.ts';
import { isRecord } from './shared.ts';
import type { EntityContext } from './types.ts';

/**
 * Builds the optional `&token=` query suffix for a paged list call.
 * @param token - continuation token from the previous page, if any
 */
export const withToken = (token?: string): string =>
  token ? `&token=${encodeURIComponent(token)}` : '';

/**
 * Reads the caller's own bucket id from Core.
 * @param ctx - config, credential and correlation context
 */
export const fetchUserBucket = async (ctx: EntityContext): Promise<string> => {
  const body = await coreGetJson(ctx, '/v1/bucket');
  const bucket = isRecord(body) ? body.bucket : undefined;
  if (typeof bucket !== 'string' || !bucket) {
    throw new CoreError(502, FALLBACK_MESSAGE);
  }
  return bucket;
};

/**
 * Collects every `items` entry from a paged Core metadata list. Stops when
 * there is no `nextToken`, or Core hands back a token already used (a cycle).
 * @param ctx - config, credential and correlation context
 * @param buildPath - builds the list path for a given continuation token
 */
export const listAllPages = async (
  ctx: EntityContext,
  buildPath: (token?: string) => string,
): Promise<Record<string, unknown>[]> => {
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  do {
    const body = await coreGetJson(ctx, buildPath(token));
    const page = isRecord(body) && Array.isArray(body.items) ? body.items : [];
    items.push(...page.filter(isRecord));
    const next =
      isRecord(body) && typeof body.nextToken === 'string' && body.nextToken
        ? body.nextToken
        : undefined;
    token = next && !seen.has(next) ? next : undefined;
    if (token) seen.add(token);
  } while (token);
  return items;
};

/**
 * Lists the caller's own bucket and the shared `public` one, which Core keeps
 * apart for prompts and skills. A failure to read the public bucket is logged
 * and skipped so it never hides the caller's own entities.
 * @param ctx - config, credential and correlation context
 * @param buildPath - builds the list path for a bucket and continuation token
 */
export const listOwnAndPublic = async (
  ctx: EntityContext,
  buildPath: (bucket: string, token?: string) => string,
): Promise<Record<string, unknown>[]> => {
  const own = await fetchUserBucket(ctx);
  const listBucket = (bucket: string) =>
    listAllPages(ctx, (token) => buildPath(encodeURIComponent(bucket), token));
  if (own === PUBLIC_BUCKET) return listBucket(own);
  const [ownItems, publicItems] = await Promise.allSettled([
    listBucket(own),
    listBucket(PUBLIC_BUCKET),
  ]);
  if (ownItems.status === 'rejected') throw ownItems.reason;
  if (publicItems.status === 'rejected') {
    const reason: unknown = publicItems.reason;
    console.error(
      `could not list the public bucket: ${reason instanceof Error ? reason.message : 'unexpected error'} (correlation ${JSON.stringify(ctx.correlation.correlationId)})`,
    );
    return ownItems.value;
  }
  return [...ownItems.value, ...publicItems.value];
};

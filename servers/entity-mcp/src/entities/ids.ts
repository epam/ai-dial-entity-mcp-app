/**
 * Thrown when a caller-supplied entity id doesn't match the shape this server
 * expects. `message` is developer-facing and names the offending id, for
 * logs; `userMessage` is a fixed, user-safe explanation that never repeats
 * caller input.
 */
export class InvalidEntityId extends Error {
  readonly userMessage =
    'This entity id is not in a form this tool understands. A full id looks like skills/{bucket}/{path}, prompts/{bucket}/{path} or toolsets/{bucket}/{path}; an agent id is a deployment id.';
}

const hasTraversal = (value: string): boolean =>
  value.split('/').some((segment) => segment === '..' || segment === '.');

/**
 * Splits `{prefix}/{bucket}/{path}` into URL-encoded bucket and path.
 * @param prefix - expected first segment, e.g. `skills`
 * @param id - full entity id as supplied by the caller
 */
export const parseBucketId = (
  prefix: string,
  id: string,
): { bucket: string; path: string } => {
  const trimmed = id.trim();
  if (!trimmed) throw new InvalidEntityId('id must not be empty');
  if (hasTraversal(trimmed)) {
    throw new InvalidEntityId(`id must not contain path traversal: ${id}`);
  }
  const [head, bucket, ...rest] = trimmed.split('/');
  if (head !== prefix || !bucket || rest.length === 0) {
    throw new InvalidEntityId(
      `id must be ${prefix}/{bucket}/{path}, got: ${id}`,
    );
  }
  if (rest.some((segment) => segment.trim() === '')) {
    throw new InvalidEntityId(`id must not contain empty path segments: ${id}`);
  }
  return {
    bucket: encodeURIComponent(bucket),
    path: rest.map(encodeURIComponent).join('/'),
  };
};

/**
 * Encodes a deployment id (agent or toolset) as a single path segment.
 * @param id - deployment id as supplied by the caller
 */
export const encodeDeploymentId = (id: string): string => {
  const trimmed = id.trim();
  if (!trimmed) throw new InvalidEntityId('id must not be empty');
  if (hasTraversal(trimmed)) {
    throw new InvalidEntityId(`id must not contain path traversal: ${id}`);
  }
  return encodeURIComponent(trimmed);
};

const safeDecode = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * Turns a Core resource `url` or deployment id (percent-encoded per segment)
 * into the plain id a person would type. Core ends the url of a skill item
 * with `/`, which an id never carries, so trailing slashes are dropped.
 * @param url - `url` of a Core metadata list item, or a deployment `id`
 */
export const decodeResourceUrl = (url: string): string =>
  url.replace(/\/+$/, '').split('/').map(safeDecode).join('/');

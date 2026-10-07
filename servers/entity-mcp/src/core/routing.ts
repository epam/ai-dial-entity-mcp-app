export const EntityKind = {
  Skill: 'skill',
  Agent: 'agent',
} as const;

export type EntityKind = (typeof EntityKind)[keyof typeof EntityKind];

/**
 * Thrown when a caller-supplied entity id doesn't match the shape this server
 * expects. `message` is developer-facing and names the offending id, for
 * logs; `userMessage` is a fixed, user-safe explanation that never repeats
 * caller input.
 */
export class InvalidEntityId extends Error {
  readonly userMessage =
    'This entity id is not in a form this tool understands. A skill id looks like skills/{bucket}/{path}; an agent id is a deployment id.';
}

const SKILL_PREFIX = 'skills';

const hasTraversal = (value: string): boolean =>
  value.split('/').some((segment) => segment === '..' || segment === '.');

const hasEmptySegment = (segments: string[]): boolean =>
  segments.some((segment) => segment.trim() === '');

/**
 * Builds the DIAL Core path that returns the entity record for an id.
 * Skills are v2 complex resources addressed as `skills/{bucket}/{path}`;
 * agents are applications addressed by deployment id.
 * @param kind - which entity type the caller asked for
 * @param id - exact entity id, as supplied to the tool
 */
export const coreUrlForEntity = (kind: EntityKind, id: string): string => {
  const trimmed = id.trim();
  if (!trimmed) throw new InvalidEntityId('id must not be empty');
  if (hasTraversal(trimmed)) {
    throw new InvalidEntityId(`id must not contain path traversal: ${id}`);
  }

  if (kind === EntityKind.Agent) {
    return `/openai/applications/${encodeURIComponent(trimmed)}`;
  }

  const [prefix, bucket, ...rest] = trimmed.split('/');
  const path = rest.join('/');
  if (prefix !== SKILL_PREFIX || !bucket || !path) {
    throw new InvalidEntityId(
      `skill id must be skills/{bucket}/{path}, got: ${id}`,
    );
  }
  if (hasEmptySegment(rest)) {
    throw new InvalidEntityId(
      `skill id must not contain empty path segments: ${id}`,
    );
  }
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `/v2/${SKILL_PREFIX}/${encodeURIComponent(bucket)}/${encodedPath}`;
};

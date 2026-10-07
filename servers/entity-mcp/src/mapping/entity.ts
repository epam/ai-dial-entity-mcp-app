import { PRIMARY_LOCALE, resolveLocalizedText } from './locale.ts';

export type MappedEntity = {
  name: string;
  description: string;
  kindLabel: string;
};

/**
 * Thrown when a Core record is missing a field the card requires (name or
 * description). The constructor message names the missing field for
 * diagnostics; `userMessage` is a fixed, user-safe explanation that never
 * repeats that field name.
 */
export class IncompleteEntity extends Error {
  readonly userMessage =
    'This entity is missing a name or description, so it cannot be displayed.';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns a trimmed, non-empty string or throws `IncompleteEntity`. Used to
 * guarantee the card never receives an empty `name` or `description`.
 * @param value - candidate field value, already resolved if localized
 * @param field - name of the missing field, for the thrown error's message
 */
const requireText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new IncompleteEntity(`missing ${field}`);
  }
  return value.trim();
};

/**
 * Maps a Core skill record onto the card's entity fields.
 * @param raw - body of GET /v2/skills/{bucket}/{path}
 */
export const mapSkill = (raw: Record<string, unknown>): MappedEntity => {
  const attributes = isRecord(raw.attributes) ? raw.attributes : {};
  return {
    name: requireText(attributes.name, 'attributes.name'),
    description: requireText(attributes.description, 'attributes.description'),
    kindLabel: 'Skill',
  };
};

/**
 * Maps a Core application record onto the card's entity fields. An
 * application's description is optional in Core but required by the card, so
 * its absence is an error here rather than an invalid payload downstream.
 * @param raw - body of GET /openai/applications/{id}
 * @param activeLocale - locale requested by the host
 */
export const mapAgent = (
  raw: Record<string, unknown>,
  activeLocale: string,
): MappedEntity => {
  const resolvedName = resolveLocalizedText(
    raw.displayName,
    activeLocale,
    PRIMARY_LOCALE,
  );
  const name = resolvedName || (typeof raw.id === 'string' ? raw.id : '');
  return {
    name: requireText(name, 'displayName'),
    description: requireText(
      resolveLocalizedText(raw.description, activeLocale, PRIMARY_LOCALE),
      'description',
    ),
    kindLabel: 'Agent',
  };
};

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

/**
 * Narrows an unknown value to a plain object.
 * @param value - candidate value
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns the trimmed string, or undefined when the value is not a non-blank string.
 * @param value - candidate value
 */
export const nonEmptyText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * Returns a trimmed, non-empty string or throws `IncompleteEntity`.
 * @param value - candidate field value, already resolved if localized
 * @param field - name of the missing field, for the thrown error's message
 */
export const requireText = (value: unknown, field: string): string => {
  const text = nonEmptyText(value);
  if (!text) throw new IncompleteEntity(`missing ${field}`);
  return text;
};

/**
 * Reads a field from a Core deployment record. Core serializes these in
 * snake_case; the camelCase spelling is accepted as a fallback.
 * @param raw - the Core record
 * @param snake - the snake_case field name, tried first
 * @param camel - the camelCase field name, tried second
 */
export const pickField = (
  raw: Record<string, unknown>,
  snake: string,
  camel: string,
): unknown => raw[snake] ?? raw[camel];

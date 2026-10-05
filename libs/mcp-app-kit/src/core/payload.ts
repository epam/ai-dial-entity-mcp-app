export type ParseResult<T> =
  { ok: true; data: T } | { ok: false; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const findFirstText = (content: unknown): string | undefined => {
  if (!Array.isArray(content)) return undefined;
  const block = content.find(
    (item) =>
      isRecord(item) && item.type === 'text' && typeof item.text === 'string',
  ) as { text: string } | undefined;
  return block?.text;
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const unwrap = (result: Record<string, unknown>): Record<string, unknown> =>
  isRecord(result.result) ? result.result : result;

/**
 * Extracts the app-facing payload from a tool result, tolerating host envelope
 * differences: a nested `result` wrapper, `structuredContent` vs
 * `structured_content`, and hosts that only forward a JSON text block.
 * @param result - raw tool result as delivered by `ui/notifications/tool-result`
 */
export const getStructuredContent = (result: unknown): unknown => {
  if (!isRecord(result)) return undefined;
  const inner = unwrap(result);
  if (inner.structuredContent != null) return inner.structuredContent;
  if (inner.structured_content != null) return inner.structured_content;
  const text = findFirstText(inner.content);
  return text === undefined ? undefined : parseJson(text);
};

/**
 * Returns the error message of a tool result flagged `isError` (its first text
 * block, else a generic message), or `undefined` for a successful result.
 * @param result - raw tool result as delivered by `ui/notifications/tool-result`
 */
export const getToolError = (result: unknown): string | undefined => {
  if (!isRecord(result)) return undefined;
  const inner = unwrap(result);
  if (inner.isError !== true) return undefined;
  return findFirstText(inner.content) ?? 'Tool failed';
};

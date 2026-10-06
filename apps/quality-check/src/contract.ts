import type { ParseResult } from '@epam/ai-dial-mcp-app-kit';

export type QualityCheckItem = {
  id: string;
  label: string;
  passed: boolean;
  hint?: string;
};

/** Normalised payload the UI renders. */
export type QualityCheckData = {
  passedPercent: number;
  items: QualityCheckItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const fail = (reason: string): ParseResult<never> => ({ ok: false, reason });

const parseItem = (raw: unknown): QualityCheckItem | undefined => {
  if (!isRecord(raw)) return undefined;
  const { id, label, passed, hint } = raw;
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(label) ||
    typeof passed !== 'boolean'
  ) {
    return undefined;
  }
  return isNonEmptyString(hint)
    ? { id, label, passed, hint }
    : { id, label, passed };
};

/**
 * Validates and normalises the quality check tool payload. Unknown fields are
 * ignored; `passedPercent` is clamped to 0–100 after rounding.
 * @param raw - structured content from the tool result
 */
export const parseQualityCheckPayload = (
  raw: unknown,
): ParseResult<QualityCheckData> => {
  if (!isRecord(raw)) return fail('payload must be an object');
  const { qualityCheck } = raw;
  if (!isRecord(qualityCheck)) return fail('qualityCheck must be an object');
  const { passedPercent, items } = qualityCheck;
  if (typeof passedPercent !== 'number' || !Number.isFinite(passedPercent)) {
    return fail('qualityCheck.passedPercent must be a number');
  }
  if (!Array.isArray(items)) return fail('qualityCheck.items must be an array');
  const parsed: QualityCheckItem[] = [];
  for (const [index, item] of items.entries()) {
    const value = parseItem(item);
    if (!value) return fail(`qualityCheck.items[${index}] is invalid`);
    parsed.push(value);
  }
  const clamped = Math.min(100, Math.max(0, Math.round(passedPercent)));
  return { ok: true, data: { passedPercent: clamped, items: parsed } };
};

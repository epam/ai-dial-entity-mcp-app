export const PRIMARY_LOCALE = 'en';

const toBaseLocale = (locale: string): string =>
  locale.split('-')[0]?.toLowerCase() ?? locale;

const isStringMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

/**
 * Resolves a DIAL `LocalizedValue` to a single string, following the same
 * fallback chain as AI DIAL Chat so the card shows the name users see
 * everywhere else: exact tag, base language, primary locale, first value.
 * @param value - plain string, locale map, or nothing
 * @param activeLocale - locale requested by the host
 * @param primaryLocale - installation default used before giving up
 */
export const resolveLocalizedText = (
  value: unknown,
  activeLocale: string,
  primaryLocale: string,
): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (!isStringMap(value)) return '';

  const base = toBaseLocale(activeLocale);
  const candidates = [value[activeLocale], value[base], value[primaryLocale]];
  const picked = candidates.find(isNonEmptyString);
  if (picked) return picked;

  return Object.values(value).find(isNonEmptyString) ?? '';
};

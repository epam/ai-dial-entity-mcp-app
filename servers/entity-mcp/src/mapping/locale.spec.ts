import { describe, expect, test } from 'vitest';
import { PRIMARY_LOCALE, resolveLocalizedText } from './locale.ts';

describe('resolveLocalizedText', () => {
  test('passes a plain string through', () => {
    expect(resolveLocalizedText('Inbox Digest', 'de', PRIMARY_LOCALE)).toBe(
      'Inbox Digest',
    );
  });

  test('prefers an exact locale tag', () => {
    expect(
      resolveLocalizedText({ 'en-US': 'Color', en: 'Colour' }, 'en-US', 'en'),
    ).toBe('Color');
  });

  test('falls back to the base language', () => {
    expect(resolveLocalizedText({ en: 'Colour' }, 'en-US', 'en')).toBe(
      'Colour',
    );
  });

  test('falls back to the primary locale', () => {
    expect(
      resolveLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'de', 'en'),
    ).toBe('Hello');
  });

  test('falls back to the first defined value', () => {
    expect(resolveLocalizedText({ fr: 'Bonjour' }, 'de', 'en')).toBe('Bonjour');
  });

  test('returns an empty string for null, undefined and an empty map', () => {
    expect(resolveLocalizedText(null, 'en', 'en')).toBe('');
    expect(resolveLocalizedText(undefined, 'en', 'en')).toBe('');
    expect(resolveLocalizedText({}, 'en', 'en')).toBe('');
  });
});

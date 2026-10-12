import { describe, expect, test } from 'vitest';
import {
  IncompleteEntity,
  nonEmptyText,
  pickField,
  requireText,
} from './shared.ts';

describe('requireText', () => {
  test('returns the trimmed text', () => {
    expect(requireText('  x ', 'name')).toBe('x');
  });

  test('message names the field while userMessage is the fixed string without it', () => {
    expect.assertions(3);
    try {
      requireText('  ', 'attributes.description');
    } catch (error) {
      const incomplete = error as IncompleteEntity;
      expect(incomplete.message).toContain('attributes.description');
      expect(incomplete.userMessage).toBe(
        'This entity is missing a name or description, so it cannot be displayed.',
      );
      expect(incomplete.userMessage).not.toContain('attributes.description');
    }
  });
});

describe('nonEmptyText', () => {
  test('is undefined for blanks and non-strings', () => {
    expect(nonEmptyText('  ')).toBeUndefined();
    expect(nonEmptyText(3)).toBeUndefined();
    expect(nonEmptyText(undefined)).toBeUndefined();
  });
});

describe('pickField', () => {
  test('prefers the snake_case spelling, falls back to camelCase', () => {
    expect(
      pickField(
        { display_name: 'a', displayName: 'b' },
        'display_name',
        'displayName',
      ),
    ).toBe('a');
    expect(pickField({ displayName: 'b' }, 'display_name', 'displayName')).toBe(
      'b',
    );
    expect(pickField({}, 'display_name', 'displayName')).toBeUndefined();
  });
});

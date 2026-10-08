import { describe, expect, test } from 'vitest';
import { IncompleteEntity, mapAgent, mapSkill } from './entity.ts';

describe('mapSkill', () => {
  test('maps Core attributes onto the card fields', () => {
    const mapped = mapSkill({
      attributes: {
        name: 'good-morning-breakfast',
        description: 'Evaluates deals.',
      },
    });
    expect(mapped).toEqual({
      name: 'good-morning-breakfast',
      description: 'Evaluates deals.',
      kindLabel: 'Skill',
    });
  });

  test('errors when the description is missing', () => {
    expect(() => mapSkill({ attributes: { name: 'x' } })).toThrow(
      IncompleteEntity,
    );
  });

  test('errors when attributes are absent entirely', () => {
    expect(() => mapSkill({})).toThrow(IncompleteEntity);
  });
});

describe('mapAgent', () => {
  test('maps displayName and description', () => {
    const mapped = mapAgent(
      { displayName: 'Inbox Digest', description: 'Summarizes your inbox.' },
      'en',
    );
    expect(mapped).toEqual({
      name: 'Inbox Digest',
      description: 'Summarizes your inbox.',
      kindLabel: 'Agent',
    });
  });

  test('resolves a localized displayName', () => {
    const mapped = mapAgent(
      { displayName: { fr: 'Boite', en: 'Inbox' }, description: 'x' },
      'fr',
    );
    expect(mapped.name).toBe('Boite');
  });

  test('falls back to the deployment id when displayName is absent', () => {
    const mapped = mapAgent({ id: 'gpt-4o', description: 'x' }, 'en');
    expect(mapped.name).toBe('gpt-4o');
  });

  test('errors when an application has no description', () => {
    expect(() => mapAgent({ displayName: 'Inbox Digest' }, 'en')).toThrow(
      IncompleteEntity,
    );
  });

  test('errors when a localized map resolves to nothing usable', () => {
    expect(() => mapAgent({ displayName: {}, description: 'x' }, 'en')).toThrow(
      IncompleteEntity,
    );
  });
});

describe('IncompleteEntity message separation', () => {
  const FIXED_USER_MESSAGE =
    'This entity is missing a name or description, so it cannot be displayed.';

  test('mapSkill failure: message names the field, userMessage is the fixed string', () => {
    expect.assertions(2);
    try {
      mapSkill({ attributes: { name: 'x' } });
    } catch (error) {
      const incomplete = error as IncompleteEntity;
      expect(incomplete.message).toContain('attributes.description');
      expect(incomplete.userMessage).toBe(FIXED_USER_MESSAGE);
    }
  });

  test('mapAgent failure: userMessage matches the same fixed string as mapSkill', () => {
    expect.assertions(1);
    try {
      mapAgent({ displayName: 'Inbox Digest' }, 'en');
    } catch (error) {
      const incomplete = error as IncompleteEntity;
      expect(incomplete.userMessage).toBe(FIXED_USER_MESSAGE);
    }
  });

  test('userMessage never contains the offending field name', () => {
    expect.assertions(1);
    try {
      mapAgent({ description: 'x' }, 'en');
    } catch (error) {
      const incomplete = error as IncompleteEntity;
      expect(incomplete.userMessage).not.toContain('displayName');
    }
  });
});

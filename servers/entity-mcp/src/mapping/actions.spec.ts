import { describe, expect, test } from 'vitest';
import { EntityKind } from '../core/routing.ts';
import { buildActions } from './actions.ts';

const base = {
  coreBaseUrl: 'https://core.example.com',
  port: 8080,
  appHtmlPath: 'x',
};

describe('buildActions', () => {
  test('returns nothing when no templates are configured', () => {
    expect(buildActions(base, EntityKind.Skill, 'skills/b/s')).toEqual({});
  });

  test('substitutes kind and url-encoded id', () => {
    const actions = buildActions(
      { ...base, tryUrlTemplate: 'https://chat.example.com/{kind}s/{id}/try' },
      EntityKind.Skill,
      'skills/b/my skill',
    );
    expect(actions.tryUrl).toBe(
      'https://chat.example.com/skills/skills%2Fb%2Fmy%20skill/try',
    );
  });

  test('omits a url whose template produces a non-http scheme', () => {
    const actions = buildActions(
      { ...base, editUrlTemplate: 'javascript:alert({id})' },
      EntityKind.Agent,
      'gpt-4o',
    );
    expect(actions.editUrl).toBeUndefined();
  });

  test('builds try and edit independently', () => {
    const actions = buildActions(
      {
        ...base,
        editUrlTemplate: 'https://chat.example.com/{kind}s/{id}/edit',
      },
      EntityKind.Agent,
      'gpt-4o',
    );
    expect(actions.tryUrl).toBeUndefined();
    expect(actions.editUrl).toBe('https://chat.example.com/agents/gpt-4o/edit');
  });
});

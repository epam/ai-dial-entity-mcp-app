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

  describe('scheme rejection', () => {
    const rejectedTemplates = [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      '//evil.com/{id}',
    ];

    test.each(rejectedTemplates)(
      'drops non-http(s) template %s',
      (template) => {
        const actions = buildActions(
          { ...base, tryUrlTemplate: template },
          EntityKind.Skill,
          'skills/b/s',
        );
        expect(actions.tryUrl).toBeUndefined();
      },
    );
  });

  describe('id containment', () => {
    const template = 'https://host/{kind}s/{id}/try';

    test('an id containing ? stays in its slot', () => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: template },
        EntityKind.Skill,
        'skills/b/s?x=1',
      );
      expect(actions.tryUrl).toBe(
        'https://host/skills/skills%2Fb%2Fs%3Fx%3D1/try',
      );
    });

    test('an id containing # stays in its slot', () => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: template },
        EntityKind.Skill,
        'skills/b/s#frag',
      );
      expect(actions.tryUrl).toBe(
        'https://host/skills/skills%2Fb%2Fs%23frag/try',
      );
    });

    test('an id containing / stays in its slot', () => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: template },
        EntityKind.Skill,
        'skills/bucket/my-skill',
      );
      expect(actions.tryUrl).toBe(
        'https://host/skills/skills%2Fbucket%2Fmy-skill/try',
      );
    });

    test('an id containing @ stays in its slot', () => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: template },
        EntityKind.Skill,
        'skills/b/s@evil',
      );
      expect(actions.tryUrl).toBe(
        'https://host/skills/skills%2Fb%2Fs%40evil/try',
      );
    });

    test('an id that is literally {id} is not substituted recursively', () => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: template },
        EntityKind.Skill,
        '{id}',
      );
      expect(actions.tryUrl).toBe('https://host/skills/%7Bid%7D/try');
    });
  });

  describe('placeholder handling', () => {
    test('substitutes and encodes every occurrence of {id}', () => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: 'https://host/{id}/{id}' },
        EntityKind.Skill,
        'a/b',
      );
      expect(actions.tryUrl).toBe('https://host/a%2Fb/a%2Fb');
    });

    test('substitutes every occurrence of {kind}', () => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: 'https://host/{kind}/{kind}' },
        EntityKind.Agent,
        'gpt-4o',
      );
      expect(actions.tryUrl).toBe('https://host/agent/agent');
    });
  });
});

import { describe, expect, test } from 'vitest';
import { EntityKind } from '../entities/types.ts';
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
      {},
      true,
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

  test.each([
    [EntityKind.Toolset, 'toolsets/b/mail', 'toolset'],
    [EntityKind.Prompt, 'prompts/b/greeter', 'prompt'],
  ])(
    'substitutes the %s kind into the {kind} placeholder',
    (kind, id, label) => {
      const actions = buildActions(
        { ...base, tryUrlTemplate: 'https://chat.example.com/{kind}/try' },
        kind,
        id,
      );
      expect(actions.tryUrl).toBe(`https://chat.example.com/${label}/try`);
    },
  );
});

describe('buildActions with DIAL_CHAT_URL', () => {
  const chat = { ...base, chatBaseUrl: 'https://chat.example.com' };

  test('builds no urls without a base url or templates', () => {
    expect(buildActions(base, EntityKind.Agent, 'gpt-4o')).toEqual({});
  });

  test('builds the Try url for an agent from its id', () => {
    const actions = buildActions(chat, EntityKind.Agent, 'applications/p/a');
    expect(actions.tryUrl).toBe(
      'https://chat.example.com/?isolated-model-id=applications%2Fp%2Fa',
    );
  });

  test.each([EntityKind.Skill, EntityKind.Prompt, EntityKind.Toolset])(
    'has no Try url for a %s',
    (kind) => {
      expect(buildActions(chat, kind, 'x/b/y').tryUrl).toBeUndefined();
    },
  );

  test.each([
    [EntityKind.Skill, '/skill-editor'],
    [EntityKind.Prompt, '/prompt-editor'],
    [EntityKind.Toolset, '/toolset-editor'],
    [EntityKind.Agent, '/custom-app-editor'],
  ])('builds the Edit url for a %s', (kind, path) => {
    expect(buildActions(chat, kind, 'a/b c', {}, true).editUrl).toBe(
      `https://chat.example.com${path}?id=a%2Fb%20c`,
    );
  });

  test('opens the schema editor for an agent with an application type schema', () => {
    const actions = buildActions(
      chat,
      EntityKind.Agent,
      'my-app',
      { application_type_schema_id: 'https://dial.example.com/schemas/rag' },
      true,
    );
    expect(actions.editUrl).toBe(
      'https://chat.example.com/apps-editor?schema=https%3A%2F%2Fdial.example.com%2Fschemas%2Frag&appId=my-app',
    );
  });

  test('accepts the camelCase schema field', () => {
    const actions = buildActions(
      chat,
      EntityKind.Agent,
      'my-app',
      { applicationTypeSchemaId: 'rag' },
      true,
    );
    expect(actions.editUrl).toContain('/apps-editor?schema=rag&appId=my-app');
  });

  test('ignores a schema id on a non-agent entity', () => {
    const actions = buildActions(
      chat,
      EntityKind.Skill,
      'skills/b/s',
      { application_type_schema_id: 'rag' },
      true,
    );
    expect(actions.editUrl).toContain('/skill-editor?id=');
  });

  test('an explicit template overrides the default route', () => {
    const actions = buildActions(
      { ...chat, editUrlTemplate: 'https://other.example.com/e/{id}' },
      EntityKind.Skill,
      'skills/b/s',
      {},
      true,
    );
    expect(actions.editUrl).toBe('https://other.example.com/e/skills%2Fb%2Fs');
    expect(actions.tryUrl).toBeUndefined();
  });

  test('keeps a base url with a path prefix', () => {
    const actions = buildActions(
      { ...base, chatBaseUrl: 'https://host.example.com/chat' },
      EntityKind.Skill,
      'skills/b/s',
      {},
      true,
    );
    expect(actions.editUrl).toBe(
      'https://host.example.com/chat/skill-editor?id=skills%2Fb%2Fs',
    );
  });

  test('appends a relative template override to the base url', () => {
    const actions = buildActions(
      { ...chat, editUrlTemplate: '/my-app/{id}/edit' },
      EntityKind.Skill,
      'skills/b/s',
      {},
      true,
    );
    expect(actions.editUrl).toBe(
      'https://chat.example.com/my-app/skills%2Fb%2Fs/edit',
    );
  });

  test('builds no Edit url unless the caller owns the entity', () => {
    const actions = buildActions(chat, EntityKind.Skill, 'skills/b/s');
    expect(actions.editUrl).toBeUndefined();
    expect(
      buildActions(chat, EntityKind.Skill, 'skills/b/s', {}, false),
    ).toEqual(actions);
  });

  test('drops a relative template override without a base url', () => {
    expect(
      buildActions(
        { ...base, editUrlTemplate: '/my-app/{id}/edit' },
        EntityKind.Skill,
        'skills/b/s',
      ).editUrl,
    ).toBeUndefined();
  });
});

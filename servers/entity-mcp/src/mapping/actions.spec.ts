import { describe, expect, test } from 'vitest';
import type { ActionTemplates } from '../config.ts';
import { EntityKind } from '../entities/types.ts';
import { buildActions } from './actions.ts';

const base = {
  coreBaseUrl: 'https://core.example.com',
  port: 8080,
  appHtmlPath: 'x',
  actionTemplates: {},
};

const withTemplates = (
  actionTemplates: ActionTemplates,
  chatBaseUrl?: string,
) => ({ ...base, actionTemplates, chatBaseUrl });

describe('buildActions', () => {
  test('builds no buttons when nothing is configured, even with a base url', () => {
    const config = withTemplates({}, 'https://chat.example.com');
    expect(buildActions(config, EntityKind.Agent, 'a', {}, true)).toEqual({});
    expect(buildActions(config, EntityKind.Skill, 's', {}, true)).toEqual({});
  });

  test.each([
    [EntityKind.Skill, 'editSkill'],
    [EntityKind.Prompt, 'editPrompt'],
    [EntityKind.Toolset, 'editToolset'],
    [EntityKind.Agent, 'editAgent'],
  ] as const)('a %s uses only its own Edit template', (kind, key) => {
    const config = withTemplates(
      { [key]: '/edit/{id}' },
      'https://chat.example.com',
    );
    expect(buildActions(config, kind, 'a/b c', {}, true).editUrl).toBe(
      'https://chat.example.com/edit/a%2Fb%20c',
    );
    const others = Object.values(EntityKind).filter((k) => k !== kind);
    for (const other of others) {
      expect(
        buildActions(config, other, 'x', {}, true).editUrl,
      ).toBeUndefined();
    }
  });

  test('an unset template for one type leaves the others working', () => {
    const config = withTemplates(
      { editSkill: '/skill-editor?id={id}' },
      'https://chat.example.com',
    );
    expect(
      buildActions(config, EntityKind.Toolset, 'toolsets/b/t', {}, true),
    ).toEqual({});
    expect(
      buildActions(config, EntityKind.Skill, 'skills/b/s', {}, true).editUrl,
    ).toBe('https://chat.example.com/skill-editor?id=skills%2Fb%2Fs');
  });

  describe('Try', () => {
    const config = withTemplates(
      {
        tryAgent: '/?deployment-id={id}',
        trySkill: '/?skill-id={id}',
        tryPrompt: '/?prompt-id={id}',
      },
      'https://chat.example.com',
    );

    test('builds deployment-id for an agent', () => {
      expect(
        buildActions(config, EntityKind.Agent, 'applications/p/a').tryUrl,
      ).toBe('https://chat.example.com/?deployment-id=applications%2Fp%2Fa');
    });

    test('builds deployment-id for a plain model id', () => {
      expect(buildActions(config, EntityKind.Agent, 'gpt-4o').tryUrl).toBe(
        'https://chat.example.com/?deployment-id=gpt-4o',
      );
    });

    test('encodes a percent sequence in a deployment id exactly once', () => {
      expect(
        buildActions(
          config,
          EntityKind.Agent,
          'applications/b/Entity%20Creator__1.0.0',
        ).tryUrl,
      ).toBe(
        'https://chat.example.com/?deployment-id=applications%2Fb%2FEntity%2520Creator__1.0.0',
      );
    });

    test('builds skill-id for a skill with the full id', () => {
      expect(
        buildActions(config, EntityKind.Skill, 'skills/B/my-skill').tryUrl,
      ).toBe('https://chat.example.com/?skill-id=skills%2FB%2Fmy-skill');
    });

    test('builds prompt-id for a prompt with the full id', () => {
      expect(
        buildActions(config, EntityKind.Prompt, 'prompts/B/my-prompt').tryUrl,
      ).toBe('https://chat.example.com/?prompt-id=prompts%2FB%2Fmy-prompt');
    });

    test('a toolset never gets Try', () => {
      expect(
        buildActions(config, EntityKind.Toolset, 'toolsets/b/t').tryUrl,
      ).toBeUndefined();
    });

    test.each([
      [EntityKind.Agent, 'tryAgent'],
      [EntityKind.Skill, 'trySkill'],
      [EntityKind.Prompt, 'tryPrompt'],
    ] as const)('a %s uses only its own Try template', (kind, key) => {
      const single = withTemplates(
        { [key]: '/?x={id}' },
        'https://chat.example.com',
      );
      expect(buildActions(single, kind, 'a/b/c').tryUrl).toBe(
        'https://chat.example.com/?x=a%2Fb%2Fc',
      );
      const others = Object.values(EntityKind).filter((k) => k !== kind);
      for (const other of others) {
        expect(buildActions(single, other, 'a/b/c').tryUrl).toBeUndefined();
      }
    });

    test('an unset template gives no Try button', () => {
      const unset = withTemplates({}, 'https://chat.example.com');
      for (const kind of Object.values(EntityKind)) {
        expect(buildActions(unset, kind, 'a/b/c').tryUrl).toBeUndefined();
      }
    });
  });

  describe('agent with an application type schema', () => {
    const templates = {
      editAgent: '/custom-app-editor?id={id}',
      editAgentSchema: '/apps-editor?schema={schemaId}&appId={id}',
    };
    const config = withTemplates(templates, 'https://chat.example.com');

    test('uses the schema template', () => {
      const actions = buildActions(
        config,
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
        config,
        EntityKind.Agent,
        'my-app',
        { applicationTypeSchemaId: 'rag' },
        true,
      );
      expect(actions.editUrl).toContain('/apps-editor?schema=rag&appId=my-app');
    });

    describe('per-schema templates', () => {
      const quickApp = 'https://dial.example.com/schemas/quickapps2';
      const loop = 'https://dial.example.com/schemas/dial-loop';
      const perSchema = withTemplates(
        {
          editAgentSchema: templates.editAgentSchema,
          editAgentBySchema: {
            [quickApp]: '/agent-builder?id={id}',
            [loop]: '/dial-loop-builder?id={id}',
          },
        },
        'https://chat.example.com',
      );
      const edit = (config: typeof perSchema, schema: string) =>
        buildActions(
          config,
          EntityKind.Agent,
          'applications/b/a',
          { application_type_schema_id: schema },
          true,
        ).editUrl;

      test('picks the template of the agent schema', () => {
        expect(edit(perSchema, quickApp)).toBe(
          'https://chat.example.com/agent-builder?id=applications%2Fb%2Fa',
        );
        expect(edit(perSchema, loop)).toBe(
          'https://chat.example.com/dial-loop-builder?id=applications%2Fb%2Fa',
        );
      });

      test('falls back to the any-schema template for another schema', () => {
        expect(edit(perSchema, 'other')).toContain('/apps-editor?schema=other');
      });

      test('has no button for another schema without an any-schema template', () => {
        const config = withTemplates(
          { editAgentBySchema: { [quickApp]: '/agent-builder?id={id}' } },
          'https://chat.example.com',
        );
        expect(edit(config, 'other')).toBeUndefined();
      });

      test('matches the schema id exactly', () => {
        expect(edit(perSchema, `${quickApp}-als`)).toContain('/apps-editor?');
        expect(edit(perSchema, quickApp.toUpperCase())).toContain(
          '/apps-editor?',
        );
      });

      test('does not read inherited object properties as a schema', () => {
        const config = withTemplates(
          { editAgentBySchema: {} },
          'https://chat.example.com',
        );
        for (const schema of ['__proto__', 'constructor', 'toString']) {
          expect(edit(config, schema)).toBeUndefined();
        }
      });

      test('finds a configured schema whose id is __proto__', () => {
        const config = withTemplates(
          {
            editAgentBySchema: Object.fromEntries([
              ['__proto__', '/proto?id={id}'],
            ]),
          },
          'https://chat.example.com',
        );
        expect(edit(config, '__proto__')).toBe(
          'https://chat.example.com/proto?id=applications%2Fb%2Fa',
        );
      });

      test('an agent without a schema never uses a per-schema template', () => {
        expect(
          buildActions(perSchema, EntityKind.Agent, 'a', {}, true).editUrl,
        ).toBeUndefined();
      });
    });

    test('has no Edit button when only the plain agent template is set', () => {
      const actions = buildActions(
        withTemplates(
          { editAgent: templates.editAgent },
          'https://chat.example.com',
        ),
        EntityKind.Agent,
        'my-app',
        { application_type_schema_id: 'rag' },
        true,
      );
      expect(actions.editUrl).toBeUndefined();
    });

    test('an agent without a schema never uses the schema template', () => {
      const actions = buildActions(
        withTemplates(
          { editAgentSchema: templates.editAgentSchema },
          'https://chat.example.com',
        ),
        EntityKind.Agent,
        'my-app',
        {},
        true,
      );
      expect(actions.editUrl).toBeUndefined();
    });

    test('ignores a schema id on a non-agent entity', () => {
      const actions = buildActions(
        withTemplates(
          { editSkill: '/skill-editor?id={id}' },
          'https://chat.example.com',
        ),
        EntityKind.Skill,
        'skills/b/s',
        { application_type_schema_id: 'rag' },
        true,
      );
      expect(actions.editUrl).toContain('/skill-editor?id=');
    });
  });

  test('builds no Edit url unless the caller owns the entity', () => {
    const config = withTemplates(
      { editSkill: '/skill-editor?id={id}' },
      'https://chat.example.com',
    );
    expect(buildActions(config, EntityKind.Skill, 'skills/b/s').editUrl).toBe(
      undefined,
    );
    expect(
      buildActions(config, EntityKind.Skill, 'skills/b/s', {}, false),
    ).toEqual({});
  });

  test('keeps a base url with a path prefix', () => {
    const config = withTemplates(
      { editSkill: '/skill-editor?id={id}' },
      'https://host.example.com/chat',
    );
    expect(
      buildActions(config, EntityKind.Skill, 'skills/b/s', {}, true).editUrl,
    ).toBe('https://host.example.com/chat/skill-editor?id=skills%2Fb%2Fs');
  });

  test('uses an absolute template as given, without a base url', () => {
    const config = withTemplates({
      editSkill: 'https://other.example.com/e/{id}',
    });
    expect(
      buildActions(config, EntityKind.Skill, 'skills/b/s', {}, true).editUrl,
    ).toBe('https://other.example.com/e/skills%2Fb%2Fs');
  });

  test('drops a path template without a base url', () => {
    const config = withTemplates({ editSkill: '/skill-editor?id={id}' });
    expect(
      buildActions(config, EntityKind.Skill, 'skills/b/s', {}, true).editUrl,
    ).toBeUndefined();
  });

  test('drops a template that does not start with a slash or a scheme', () => {
    const config = withTemplates(
      { editSkill: 'skill-editor?id={id}' },
      'https://chat.example.com',
    );
    expect(
      buildActions(config, EntityKind.Skill, 'skills/b/s', {}, true).editUrl,
    ).toBeUndefined();
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
          withTemplates({ tryAgent: template, editSkill: template }),
          EntityKind.Agent,
          'a',
          {},
          true,
        );
        expect(actions.tryUrl).toBeUndefined();
        expect(
          buildActions(
            withTemplates({ trySkill: template, tryPrompt: template }),
            EntityKind.Skill,
            's',
          ).tryUrl,
        ).toBeUndefined();
        expect(
          buildActions(
            withTemplates({ trySkill: template, tryPrompt: template }),
            EntityKind.Prompt,
            'p',
          ).tryUrl,
        ).toBeUndefined();
        expect(
          buildActions(
            withTemplates({ editSkill: template }),
            EntityKind.Skill,
            's',
            {},
            true,
          ).editUrl,
        ).toBeUndefined();
      },
    );
  });

  test('a protocol-relative path template stays on the chat host', () => {
    const config = withTemplates(
      { editSkill: '//evil.example.com/{id}' },
      'https://chat.example.com',
    );
    const url = buildActions(config, EntityKind.Skill, 's', {}, true).editUrl;
    expect(new URL(url!).host).toBe('chat.example.com');
  });

  describe('id containment', () => {
    const config = withTemplates({ tryAgent: 'https://host/agents/{id}/try' });

    test.each([
      ['skills/b/s?x=1', 'skills%2Fb%2Fs%3Fx%3D1'],
      ['skills/b/s#frag', 'skills%2Fb%2Fs%23frag'],
      ['skills/bucket/my-skill', 'skills%2Fbucket%2Fmy-skill'],
      ['skills/b/s@evil', 'skills%2Fb%2Fs%40evil'],
      ['{id}', '%7Bid%7D'],
    ])('an id %s stays in its slot', (id, encoded) => {
      expect(buildActions(config, EntityKind.Agent, id).tryUrl).toBe(
        `https://host/agents/${encoded}/try`,
      );
    });
  });

  test('substitutes and encodes every occurrence of {id}', () => {
    const actions = buildActions(
      withTemplates({ tryAgent: 'https://host/{id}/{id}' }),
      EntityKind.Agent,
      'a/b',
    );
    expect(actions.tryUrl).toBe('https://host/a%2Fb/a%2Fb');
  });
});

import { describe, expect, test } from 'vitest';
import { findConfigWarnings, loadConfig } from './config.ts';

describe('loadConfig', () => {
  test('throws a named error when DIAL_CORE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/DIAL_CORE_URL/);
  });

  test('defaults port to 8080 and leaves url templates undefined', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
    });
    expect(config.port).toBe(8080);
    expect(config.actionTemplates).toEqual({});
  });

  test('reads each action template from its own variable', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
      ENTITY_EDIT_URL_SKILL: ' /skill-editor?id={id} ',
      ENTITY_EDIT_URL_PROMPT: '/prompt-editor?id={id}',
      ENTITY_EDIT_URL_TOOLSET: '/toolset-editor?id={id}',
      ENTITY_EDIT_URL_AGENT: '/custom-app-editor?id={id}',
      ENTITY_EDIT_URL_AGENT_SCHEMA: '/apps-editor?schema={schemaId}&appId={id}',
      ENTITY_TRY_URL_AGENT: '/?isolated-model-id={id}',
    });
    expect(config.actionTemplates).toEqual({
      editSkill: '/skill-editor?id={id}',
      editPrompt: '/prompt-editor?id={id}',
      editToolset: '/toolset-editor?id={id}',
      editAgent: '/custom-app-editor?id={id}',
      editAgentSchema: '/apps-editor?schema={schemaId}&appId={id}',
      tryAgent: '/?isolated-model-id={id}',
    });
  });

  test('treats an empty template variable as unset', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
      ENTITY_EDIT_URL_TOOLSET: '  ',
    });
    expect(config.actionTemplates).toEqual({});
  });

  test('ignores the removed variables', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
      ENTITY_EDIT_URL_TEMPLATE: '/x/{id}',
      ENTITY_TRY_URL_TEMPLATE: '/y/{id}',
    });
    expect(config.actionTemplates).toEqual({});
  });

  test('strips a trailing slash from the base url', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com/',
    });
    expect(config.coreBaseUrl).toBe('https://core.example.com');
  });

  test('never reads credential variables', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
      DIAL_API_KEY: 'secret',
      DIAL_USER_JWT: 'secret',
    });
    expect(JSON.stringify(config)).not.toContain('secret');
  });

  test('throws when the base url has no scheme', () => {
    expect(() => loadConfig({ DIAL_CORE_URL: 'core.example.com' })).toThrow(
      /DIAL_CORE_URL/,
    );
  });

  test('throws when the base url uses a javascript: scheme', () => {
    expect(() => loadConfig({ DIAL_CORE_URL: 'javascript:alert(1)' })).toThrow(
      /DIAL_CORE_URL/,
    );
  });

  test('throws when the base url uses a file: scheme', () => {
    expect(() => loadConfig({ DIAL_CORE_URL: 'file:///etc/passwd' })).toThrow(
      /DIAL_CORE_URL/,
    );
  });

  test('accepts a valid https url', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
    });
    expect(config.coreBaseUrl).toBe('https://core.example.com');
  });

  test('throws when PORT exceeds the maximum valid port number', () => {
    expect(() =>
      loadConfig({
        DIAL_CORE_URL: 'https://core.example.com',
        PORT: '70000',
      }),
    ).toThrow(/PORT/);
  });

  test('throws when PORT is 0', () => {
    expect(() =>
      loadConfig({
        DIAL_CORE_URL: 'https://core.example.com',
        PORT: '0',
      }),
    ).toThrow(/PORT/);
  });

  test('accepts a valid PORT', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
      PORT: '8080',
    });
    expect(config.port).toBe(8080);
  });

  test('reads and normalises CHAT_BASE_URL', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
      CHAT_BASE_URL: ' https://chat.example.com/ ',
    });
    expect(config.chatBaseUrl).toBe('https://chat.example.com');
  });

  test('leaves chatBaseUrl undefined when unset', () => {
    expect(
      loadConfig({ DIAL_CORE_URL: 'https://core.example.com' }).chatBaseUrl,
    ).toBeUndefined();
  });

  test('throws a named error for a non-http(s) CHAT_BASE_URL', () => {
    expect(() =>
      loadConfig({
        DIAL_CORE_URL: 'https://core.example.com',
        CHAT_BASE_URL: 'javascript:alert(1)',
      }),
    ).toThrow(/CHAT_BASE_URL/);
  });

  test.each([
    'https://chat.example.com/?lang=en',
    'https://chat.example.com/#x',
  ])('rejects CHAT_BASE_URL with a query or fragment: %s', (value) => {
    expect(() =>
      loadConfig({
        DIAL_CORE_URL: 'https://core.example.com',
        CHAT_BASE_URL: value,
      }),
    ).toThrow(/CHAT_BASE_URL/);
  });
});

describe('findConfigWarnings', () => {
  const core = { DIAL_CORE_URL: 'https://core.example.com' };
  const warningsFor = (env: Record<string, string>) =>
    findConfigWarnings(loadConfig({ ...core, ...env }), { ...core, ...env });

  test('is silent for a resolvable configuration', () => {
    expect(
      warningsFor({
        CHAT_BASE_URL: 'https://chat.example.com',
        ENTITY_EDIT_URL_SKILL: '/skill-editor?id={id}',
        ENTITY_TRY_URL_AGENT: 'https://other.example.com/{id}',
      }),
    ).toEqual([]);
  });

  test('is silent when nothing is configured', () => {
    expect(warningsFor({})).toEqual([]);
  });

  test('warns about a path template without CHAT_BASE_URL', () => {
    expect(
      warningsFor({ ENTITY_EDIT_URL_SKILL: '/skill-editor?id={id}' }),
    ).toEqual([expect.stringContaining('ENTITY_EDIT_URL_SKILL')]);
  });

  test('warns about a template that is neither a path nor an absolute URL', () => {
    expect(
      warningsFor({
        CHAT_BASE_URL: 'https://chat.example.com',
        ENTITY_EDIT_URL_TOOLSET: 'toolset-editor?id={id}',
      }),
    ).toEqual([expect.stringContaining('ENTITY_EDIT_URL_TOOLSET')]);
  });

  test('warns about each removed variable and names its replacement', () => {
    const warnings = warningsFor({
      ENTITY_EDIT_URL_TEMPLATE: '/x/{id}',
      ENTITY_TRY_URL_TEMPLATE: '/y/{id}',
      DIAL_CHAT_URL: 'https://chat.example.com',
    });
    expect(warnings).toHaveLength(3);
    expect(warnings[2]).toContain('CHAT_BASE_URL');
    expect(warnings[0]).toContain('ENTITY_EDIT_URL_TEMPLATE');
    expect(warnings[1]).toContain('ENTITY_TRY_URL_AGENT');
  });
});

describe('per-schema agent Edit templates', () => {
  const core = { DIAL_CORE_URL: 'https://core.example.com' };
  const env = {
    ...core,
    CHAT_BASE_URL: 'https://chat.example.com',
    ENTITY_AGENT_SCHEMA_QUICKAPP: ' https://dial.example.com/quickapps2 ',
    ENTITY_EDIT_URL_AGENT_SCHEMA_QUICKAPP: '/agent-builder?id={id}',
    ENTITY_AGENT_SCHEMA_LOOP: 'https://dial.example.com/dial-loop',
    ENTITY_EDIT_URL_AGENT_SCHEMA_LOOP: '/dial-loop-builder?id={id}',
  };

  test('maps each schema id to the template of its key', () => {
    expect(loadConfig(env).actionTemplates.editAgentBySchema).toEqual({
      'https://dial.example.com/quickapps2': '/agent-builder?id={id}',
      'https://dial.example.com/dial-loop': '/dial-loop-builder?id={id}',
    });
  });

  test('leaves the map out when no key is configured', () => {
    expect(loadConfig(core).actionTemplates.editAgentBySchema).toBeUndefined();
  });

  test('keeps the any-schema variable apart from the keyed ones', () => {
    const config = loadConfig({
      ...env,
      ENTITY_EDIT_URL_AGENT_SCHEMA: '/apps-editor?schema={schemaId}&appId={id}',
    });
    expect(config.actionTemplates.editAgentSchema).toBe(
      '/apps-editor?schema={schemaId}&appId={id}',
    );
  });

  test('throws when two keys share a schema id', () => {
    expect(() =>
      loadConfig({
        ...env,
        ENTITY_AGENT_SCHEMA_LOOP: 'https://dial.example.com/quickapps2',
      }),
    ).toThrow(
      /ENTITY_AGENT_SCHEMA_LOOP.*ENTITY_AGENT_SCHEMA_QUICKAPP|ENTITY_AGENT_SCHEMA_QUICKAPP.*ENTITY_AGENT_SCHEMA_LOOP/,
    );
  });

  test('ignores a key that has only one of its two variables', () => {
    const config = loadConfig({
      ...core,
      ENTITY_AGENT_SCHEMA_LOOP: 'https://dial.example.com/dial-loop',
      ENTITY_EDIT_URL_AGENT_SCHEMA_ORPHAN: '/x?id={id}',
    });
    expect(config.actionTemplates.editAgentBySchema).toBeUndefined();
  });

  test('warns about a key with only one of its two variables', () => {
    const partial = {
      ...core,
      ENTITY_AGENT_SCHEMA_LOOP: 'https://dial.example.com/dial-loop',
      ENTITY_EDIT_URL_AGENT_SCHEMA_ORPHAN: '/x?id={id}',
    };
    const warnings = findConfigWarnings(loadConfig(partial), partial);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes('key ORPHAN'))).toBe(true);
    expect(warnings.some((w) => w.includes('key LOOP'))).toBe(true);
  });

  test('warns about an unresolvable per-schema template', () => {
    const bad = {
      ...env,
      ENTITY_EDIT_URL_AGENT_SCHEMA_LOOP: 'builder?id={id}',
    };
    expect(findConfigWarnings(loadConfig(bad), bad)).toEqual([
      expect.stringContaining('ENTITY_EDIT_URL_AGENT_SCHEMA_LOOP'),
    ]);
  });

  test.each(['', '-x', 'a.b', 'a b'])(
    'warns about and ignores the invalid key %j',
    (key) => {
      const bad = {
        ...core,
        [`ENTITY_EDIT_URL_AGENT_SCHEMA_${key}`]: '/x?id={id}',
        [`ENTITY_AGENT_SCHEMA_${key}`]: 'https://dial.example.com/s',
      };
      const config = loadConfig(bad);
      expect(config.actionTemplates.editAgentBySchema).toBeUndefined();
      expect(findConfigWarnings(config, bad)).toHaveLength(2);
    },
  );

  test('treats a whitespace-only variable as missing', () => {
    const half = {
      ...core,
      ENTITY_AGENT_SCHEMA_LOOP: 'https://dial.example.com/dial-loop',
      ENTITY_EDIT_URL_AGENT_SCHEMA_LOOP: '   ',
    };
    const config = loadConfig(half);
    expect(config.actionTemplates.editAgentBySchema).toBeUndefined();
    expect(findConfigWarnings(config, half)).toEqual([
      expect.stringContaining('key LOOP'),
    ]);
  });

  test('keys that differ only by case are separate keys', () => {
    const config = loadConfig({
      ...core,
      ENTITY_AGENT_SCHEMA_Loop: 'https://dial.example.com/a',
      ENTITY_EDIT_URL_AGENT_SCHEMA_Loop: '/a?id={id}',
      ENTITY_AGENT_SCHEMA_LOOP: 'https://dial.example.com/b',
      ENTITY_EDIT_URL_AGENT_SCHEMA_LOOP: '/b?id={id}',
    });
    expect(config.actionTemplates.editAgentBySchema).toEqual({
      'https://dial.example.com/a': '/a?id={id}',
      'https://dial.example.com/b': '/b?id={id}',
    });
  });

  test('is silent for a complete configuration', () => {
    expect(findConfigWarnings(loadConfig(env), env)).toEqual([]);
  });
});

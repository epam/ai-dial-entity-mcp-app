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

  test('ignores the removed all-kinds template variables', () => {
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

  test('reads and normalises DIAL_CHAT_URL', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
      DIAL_CHAT_URL: ' https://chat.example.com/ ',
    });
    expect(config.chatBaseUrl).toBe('https://chat.example.com');
  });

  test('leaves chatBaseUrl undefined when unset', () => {
    expect(
      loadConfig({ DIAL_CORE_URL: 'https://core.example.com' }).chatBaseUrl,
    ).toBeUndefined();
  });

  test('throws a named error for a non-http(s) DIAL_CHAT_URL', () => {
    expect(() =>
      loadConfig({
        DIAL_CORE_URL: 'https://core.example.com',
        DIAL_CHAT_URL: 'javascript:alert(1)',
      }),
    ).toThrow(/DIAL_CHAT_URL/);
  });

  test.each([
    'https://chat.example.com/?lang=en',
    'https://chat.example.com/#x',
  ])('rejects DIAL_CHAT_URL with a query or fragment: %s', (value) => {
    expect(() =>
      loadConfig({
        DIAL_CORE_URL: 'https://core.example.com',
        DIAL_CHAT_URL: value,
      }),
    ).toThrow(/DIAL_CHAT_URL/);
  });
});

describe('findConfigWarnings', () => {
  const core = { DIAL_CORE_URL: 'https://core.example.com' };
  const warningsFor = (env: Record<string, string>) =>
    findConfigWarnings(loadConfig({ ...core, ...env }), { ...core, ...env });

  test('is silent for a resolvable configuration', () => {
    expect(
      warningsFor({
        DIAL_CHAT_URL: 'https://chat.example.com',
        ENTITY_EDIT_URL_SKILL: '/skill-editor?id={id}',
        ENTITY_TRY_URL_AGENT: 'https://other.example.com/{id}',
      }),
    ).toEqual([]);
  });

  test('is silent when nothing is configured', () => {
    expect(warningsFor({})).toEqual([]);
  });

  test('warns about a path template without DIAL_CHAT_URL', () => {
    expect(
      warningsFor({ ENTITY_EDIT_URL_SKILL: '/skill-editor?id={id}' }),
    ).toEqual([expect.stringContaining('ENTITY_EDIT_URL_SKILL')]);
  });

  test('warns about a template that is neither a path nor an absolute URL', () => {
    expect(
      warningsFor({
        DIAL_CHAT_URL: 'https://chat.example.com',
        ENTITY_EDIT_URL_TOOLSET: 'toolset-editor?id={id}',
      }),
    ).toEqual([expect.stringContaining('ENTITY_EDIT_URL_TOOLSET')]);
  });

  test('warns about each removed variable and names its replacement', () => {
    const warnings = warningsFor({
      ENTITY_EDIT_URL_TEMPLATE: '/x/{id}',
      ENTITY_TRY_URL_TEMPLATE: '/y/{id}',
    });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('ENTITY_EDIT_URL_TEMPLATE');
    expect(warnings[1]).toContain('ENTITY_TRY_URL_AGENT');
  });
});

import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  test('throws a named error when DIAL_CORE_BASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/DIAL_CORE_BASE_URL/);
  });

  test('defaults port to 8080 and leaves url templates undefined', () => {
    const config = loadConfig({
      DIAL_CORE_BASE_URL: 'https://core.example.com',
    });
    expect(config.port).toBe(8080);
    expect(config.tryUrlTemplate).toBeUndefined();
    expect(config.editUrlTemplate).toBeUndefined();
  });

  test('strips a trailing slash from the base url', () => {
    const config = loadConfig({
      DIAL_CORE_BASE_URL: 'https://core.example.com/',
    });
    expect(config.coreBaseUrl).toBe('https://core.example.com');
  });

  test('never reads credential variables', () => {
    const config = loadConfig({
      DIAL_CORE_BASE_URL: 'https://core.example.com',
      DIAL_API_KEY: 'secret',
      DIAL_USER_JWT: 'secret',
    });
    expect(JSON.stringify(config)).not.toContain('secret');
  });

  test('throws when the base url has no scheme', () => {
    expect(() =>
      loadConfig({ DIAL_CORE_BASE_URL: 'core.example.com' }),
    ).toThrow(/DIAL_CORE_BASE_URL/);
  });

  test('throws when the base url uses a javascript: scheme', () => {
    expect(() =>
      loadConfig({ DIAL_CORE_BASE_URL: 'javascript:alert(1)' }),
    ).toThrow(/DIAL_CORE_BASE_URL/);
  });

  test('throws when the base url uses a file: scheme', () => {
    expect(() =>
      loadConfig({ DIAL_CORE_BASE_URL: 'file:///etc/passwd' }),
    ).toThrow(/DIAL_CORE_BASE_URL/);
  });

  test('accepts a valid https url', () => {
    const config = loadConfig({
      DIAL_CORE_BASE_URL: 'https://core.example.com',
    });
    expect(config.coreBaseUrl).toBe('https://core.example.com');
  });
});

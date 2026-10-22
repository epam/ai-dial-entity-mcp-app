import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  test('throws a named error when DIAL_CORE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/DIAL_CORE_URL/);
  });

  test('defaults port to 8080 and leaves url templates undefined', () => {
    const config = loadConfig({
      DIAL_CORE_URL: 'https://core.example.com',
    });
    expect(config.port).toBe(8080);
    expect(config.tryUrlTemplate).toBeUndefined();
    expect(config.editUrlTemplate).toBeUndefined();
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

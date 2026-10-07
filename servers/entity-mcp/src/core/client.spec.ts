import { afterEach, describe, expect, test, vi } from 'vitest';
import { EntityKind } from './routing.ts';
import { CoreError, fetchEntity } from './client.ts';

const config = {
  coreBaseUrl: 'https://core.example.com',
  port: 8080,
  appHtmlPath: 'x.html',
};

const mockFetch = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe('fetchEntity', () => {
  test('forwards the caller authorization header verbatim', async () => {
    const spy = mockFetch(200, { name: 'x' });
    await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer abc.def',
    });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://core.example.com/v2/skills/b/s');
    expect((init!.headers as Record<string, string>).authorization).toBe(
      'Bearer abc.def',
    );
  });

  test('sends a correlation id', async () => {
    const spy = mockFetch(200, {});
    await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    });
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['x-correlation-id']).toMatch(/[0-9a-f-]{36}/);
  });

  test('maps 401 to an expired-session message', async () => {
    mockFetch(401, { error: 'nope' });
    await expect(
      fetchEntity({
        config,
        kind: EntityKind.Skill,
        id: 'skills/b/s',
        authorization: 'Bearer t',
      }),
    ).rejects.toMatchObject({
      status: 401,
      userMessage: expect.stringMatching(/sign in|session/i),
    });
  });

  test('maps 403 and 404 to distinct messages', async () => {
    mockFetch(403, {});
    const forbidden = await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    }).catch((error: CoreError) => error);
    mockFetch(404, {});
    const missing = await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    }).catch((error: CoreError) => error);
    expect((forbidden as CoreError).userMessage).not.toBe(
      (missing as CoreError).userMessage,
    );
  });

  test('never leaks the Core error body into the user message', async () => {
    mockFetch(500, { error: 'internal stack trace with secrets' });
    const error = await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    }).catch((caught: CoreError) => caught);
    expect((error as CoreError).userMessage).not.toContain('secrets');
  });
});

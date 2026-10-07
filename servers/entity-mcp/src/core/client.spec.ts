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

const KNOWN_USER_MESSAGES = [
  'Your session has expired. Sign in again and retry.',
  "You don't have access to this entity.",
  'That entity no longer exists.',
  'Could not load this entity from DIAL.',
  'DIAL took too long to respond. Please try again.',
];

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
    expect(KNOWN_USER_MESSAGES).toContain((error as CoreError).userMessage);
  });

  test('maps a timed-out request to a CoreError with a timeout message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );
    const error = await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    }).catch((caught: CoreError) => caught);
    expect(error).toBeInstanceOf(CoreError);
    expect((error as CoreError).status).toBe(504);
    expect(KNOWN_USER_MESSAGES).toContain((error as CoreError).userMessage);
  });

  test('maps a 200 response with a non-JSON body to a CoreError with the fallback message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>not json</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const error = await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    }).catch((caught: CoreError) => caught);
    expect(error).toBeInstanceOf(CoreError);
    expect(KNOWN_USER_MESSAGES).toContain((error as CoreError).userMessage);
  });

  test('maps a 200 response with an empty body to a CoreError with the fallback message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );
    const error = await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    }).catch((caught: CoreError) => caught);
    expect(error).toBeInstanceOf(CoreError);
    expect(KNOWN_USER_MESSAGES).toContain((error as CoreError).userMessage);
  });

  test('preserves the original status on a non-2xx CoreError', async () => {
    mockFetch(403, {});
    const error = await fetchEntity({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/s',
      authorization: 'Bearer t',
    }).catch((caught: CoreError) => caught);
    expect((error as CoreError).status).toBe(403);
  });
});

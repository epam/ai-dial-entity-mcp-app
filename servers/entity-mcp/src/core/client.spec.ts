import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  CoreError,
  coreGetJson,
  coreGetRecord,
  type CoreRequest,
} from './client.ts';

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

const readSkill = (request: CoreRequest) =>
  coreGetRecord(request, '/v2/metadata/skills/b/s');

const KNOWN_USER_MESSAGES = [
  'Your session has expired. Sign in again and retry.',
  "You don't have access to this entity.",
  'That entity no longer exists.',
  'Could not load this entity from DIAL.',
  'DIAL took too long to respond. Please try again.',
];

describe('reading a skill record', () => {
  test('forwards a bearer credential as Authorization, verbatim', async () => {
    const spy = mockFetch(200, { name: 'x' });
    await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer abc.def' },
      correlation: { correlationId: 'test-correlation-id' },
    });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://core.example.com/v2/metadata/skills/b/s');
    const headers = init!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer abc.def');
  });

  test('sends the given correlation id verbatim', async () => {
    const spy = mockFetch(200, {});
    await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'given-correlation-id' },
    });
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['x-correlation-id']).toBe('given-correlation-id');
  });

  test('forwards x-request-id and x-trace-id when present on the correlation context', async () => {
    const spy = mockFetch(200, {});
    await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: {
        correlationId: 'given-correlation-id',
        requestId: 'given-request-id',
        traceId: 'given-trace-id',
      },
    });
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['x-request-id']).toBe('given-request-id');
    expect(headers['x-trace-id']).toBe('given-trace-id');
  });

  test('omits x-request-id and x-trace-id when absent from the correlation context', async () => {
    const spy = mockFetch(200, {});
    await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'given-correlation-id' },
    });
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['x-request-id']).toBeUndefined();
    expect(headers['x-trace-id']).toBeUndefined();
  });

  test('maps 401 to an expired-session message', async () => {
    mockFetch(401, { error: 'nope' });
    await expect(
      readSkill({
        config,
        credential: { header: 'Authorization', value: 'Bearer t' },
        correlation: { correlationId: 'test-correlation-id' },
      }),
    ).rejects.toMatchObject({
      status: 401,
      userMessage: expect.stringMatching(/sign in|session/i),
    });
  });

  test('maps 403 and 404 to distinct messages', async () => {
    mockFetch(403, {});
    const forbidden = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
    }).catch((error: CoreError) => error);
    mockFetch(404, {});
    const missing = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
    }).catch((error: CoreError) => error);
    expect((forbidden as CoreError).userMessage).not.toBe(
      (missing as CoreError).userMessage,
    );
  });

  test('never leaks the Core error body into the user message', async () => {
    mockFetch(500, { error: 'internal stack trace with secrets' });
    const error = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
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
    const error = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
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
    const error = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
    }).catch((caught: CoreError) => caught);
    expect(error).toBeInstanceOf(CoreError);
    expect(KNOWN_USER_MESSAGES).toContain((error as CoreError).userMessage);
  });

  test('maps a 200 response with an empty body to a CoreError with the fallback message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );
    const error = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
    }).catch((caught: CoreError) => caught);
    expect(error).toBeInstanceOf(CoreError);
    expect(KNOWN_USER_MESSAGES).toContain((error as CoreError).userMessage);
  });

  test('passes redirect: "error" and maps a redirect response to the fallback CoreError', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, init) => {
        if ((init as RequestInit)?.redirect !== 'error') {
          throw new Error('expected fetch to be called with redirect: "error"');
        }
        return Promise.reject(
          new TypeError('fetch failed: unexpected redirect'),
        );
      });

    const error = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
    }).catch((caught: CoreError) => caught);

    expect(error).toBeInstanceOf(CoreError);
    expect(KNOWN_USER_MESSAGES).toContain((error as CoreError).userMessage);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('preserves the original status on a non-2xx CoreError', async () => {
    mockFetch(403, {});
    const error = await readSkill({
      config,
      credential: { header: 'Authorization', value: 'Bearer t' },
      correlation: { correlationId: 'test-correlation-id' },
    }).catch((caught: CoreError) => caught);
    expect((error as CoreError).status).toBe(403);
  });
});

describe('coreGetJson', () => {
  const request = {
    config,
    credential: { header: 'Authorization' as const, value: 'Bearer t' },
    correlation: { correlationId: 'cid' },
  };

  test('requests the path against the Core base url with forwarded headers', async () => {
    const spy = mockFetch(200, { data: [1] });
    const body = await coreGetJson(request, '/openai/toolsets');
    expect(body).toEqual({ data: [1] });
    expect(spy.mock.calls[0]![0]).toBe(
      'https://core.example.com/openai/toolsets',
    );
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer t');
    expect(headers['x-correlation-id']).toBe('cid');
  });

  test('keeps a query string in the path', async () => {
    const spy = mockFetch(200, {});
    await coreGetJson(
      request,
      '/v2/metadata/skills/b/?recursive=true&limit=1000',
    );
    expect(spy.mock.calls[0]![0]).toBe(
      'https://core.example.com/v2/metadata/skills/b/?recursive=true&limit=1000',
    );
  });

  test('uses a 30 second timeout by default and a custom one when given', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    mockFetch(200, {});
    await coreGetJson(request, '/x');
    mockFetch(200, {});
    await coreGetJson(request, '/x', { timeoutMs: 60_000 });
    expect(timeout.mock.calls).toEqual([[30_000], [60_000]]);
  });

  test('rejects with a timeout CoreError when the caller aborts through request.signal', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () =>
            reject(init!.signal!.reason),
          );
        }),
    );
    const pending = coreGetJson(
      { ...request, signal: controller.signal },
      '/x',
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 504 });
  });

  test('maps a non-success status to a CoreError with the fixed message', async () => {
    mockFetch(403, { secret: 'body' });
    await expect(coreGetJson(request, '/x')).rejects.toMatchObject({
      status: 403,
      userMessage: "You don't have access to this entity.",
    });
  });
});

describe('coreGetRecord', () => {
  const request = {
    config,
    credential: { header: 'Authorization' as const, value: 'Bearer k' },
    correlation: { correlationId: 'cid' },
  };

  test('returns an object body', async () => {
    mockFetch(200, { id: 'a' });
    await expect(coreGetRecord(request, '/x')).resolves.toEqual({ id: 'a' });
  });

  test('rejects a body that is not an object with a 502 CoreError', async () => {
    mockFetch(200, [1, 2]);
    await expect(coreGetRecord(request, '/x')).rejects.toMatchObject({
      status: 502,
    });
  });
});

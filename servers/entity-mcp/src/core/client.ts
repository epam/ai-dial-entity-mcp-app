import type { ServerConfig } from '../config.ts';

const TIMEOUT_MS = 30_000;

const callTimeout = (
  callerSignal: AbortSignal | undefined,
  timeoutMs: number = TIMEOUT_MS,
): AbortSignal => {
  const timeout = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([timeout, callerSignal]) : timeout;
};

export type CoreGetOptions = {
  timeoutMs?: number;
};

const MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Sign in again and retry.',
  403: "You don't have access to this entity.",
  404: 'That entity no longer exists.',
};

export const FALLBACK_MESSAGE = 'Could not load this entity from DIAL.';

const TIMEOUT_MESSAGE = 'DIAL took too long to respond. Please try again.';

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'TimeoutError' || error.name === 'AbortError');

/**
 * Raised when DIAL Core responds with a non-success status. The message
 * shown to end users (`userMessage`) never includes Core's response body.
 */
export class CoreError extends Error {
  readonly status: number;
  readonly userMessage: string;

  constructor(status: number, userMessage: string) {
    super(`DIAL Core responded ${status}`);
    this.status = status;
    this.userMessage = userMessage;
  }
}

/**
 * The caller's forwarded credential, tagged with the exact header it was read
 * from and must be sent back as. `Authorization` carries a bearer token;
 * `Api-Key` carries DIAL's per-request key. Keeping the two variants explicit
 * makes it impossible to forward a value under the wrong header.
 */
export type InboundCredential =
  | { header: 'Authorization'; value: string }
  | { header: 'Api-Key'; value: string };

/**
 * The correlation id established once per inbound request, so this server's
 * logs and DIAL Core's can be joined. `correlationId` is always set — reused
 * from the inbound request when the host sent one, minted otherwise.
 * `requestId` and `traceId` carry the caller's own `X-Request-ID` /
 * `X-Trace-ID` values, if present, independent of what seeded
 * `correlationId`, so an existing trace isn't broken at this hop.
 */
export type CorrelationContext = {
  correlationId: string;
  requestId?: string;
  traceId?: string;
};

export type CoreRequest = {
  config: ServerConfig;
  credential: InboundCredential;
  correlation: CorrelationContext;
  signal?: AbortSignal;
};

/**
 * Reads one JSON document from DIAL Core as the calling user. The caller's
 * credential is forwarded verbatim, under the same header it arrived on; this
 * server holds no credential of its own and never retries under a different
 * identity.
 * @param request - config, forwarded credential and correlation context
 * @param path - Core path with any query string, already URL-encoded
 * @param options - `timeoutMs` overrides the 30 second default for a call known to be slow
 */
export const coreGetJson = async (
  request: CoreRequest,
  path: string,
  options: CoreGetOptions = {},
): Promise<unknown> => {
  const { config, credential, correlation } = request;
  let response: Response;
  try {
    response = await fetch(`${config.coreBaseUrl}${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        [credential.header]: credential.value,
        'x-correlation-id': correlation.correlationId,
        ...(correlation.requestId
          ? { 'x-request-id': correlation.requestId }
          : {}),
        ...(correlation.traceId ? { 'x-trace-id': correlation.traceId } : {}),
      },
      signal: callTimeout(request.signal, options.timeoutMs),
      // The fetch spec strips `Authorization` but not a forwarded `Api-Key` on
      // a cross-origin redirect, so a redirect is rejected outright rather
      // than followed.
      redirect: 'error',
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new CoreError(504, TIMEOUT_MESSAGE);
    }
    throw new CoreError(502, FALLBACK_MESSAGE);
  }

  if (!response.ok) {
    throw new CoreError(
      response.status,
      MESSAGES[response.status] ?? FALLBACK_MESSAGE,
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new CoreError(502, FALLBACK_MESSAGE);
  }
};

/**
 * Like `coreGetJson`, but requires the body to be a JSON object.
 * @param request - config, forwarded credential and correlation context
 * @param path - Core path with any query string, already URL-encoded
 */
export const coreGetRecord = async (
  request: CoreRequest,
  path: string,
): Promise<Record<string, unknown>> => {
  const body = await coreGetJson(request, path);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new CoreError(502, FALLBACK_MESSAGE);
  }
  return body as Record<string, unknown>;
};

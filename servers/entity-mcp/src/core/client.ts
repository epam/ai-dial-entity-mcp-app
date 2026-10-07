import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config.ts';
import { EntityKind, coreUrlForEntity } from './routing.ts';

const TIMEOUT_MS = 10_000;

const MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Sign in again and retry.',
  403: "You don't have access to this entity.",
  404: 'That entity no longer exists.',
};

export const FALLBACK_MESSAGE = 'Could not load this entity from DIAL.';

const TIMEOUT_MESSAGE = 'DIAL took too long to respond. Please try again.';

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';

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

export type FetchEntityOptions = {
  config: ServerConfig;
  kind: EntityKind;
  id: string;
  credential: InboundCredential;
};

/**
 * Reads one entity record from DIAL Core as the calling user. The caller's
 * credential is forwarded verbatim, under the same header it arrived on; this
 * server holds no credential of its own and never retries under a different
 * identity.
 * @param options - config, entity coordinates and the forwarded credential
 */
export const fetchEntity = async (
  options: FetchEntityOptions,
): Promise<Record<string, unknown>> => {
  const { config, kind, id, credential } = options;
  const path = coreUrlForEntity(kind, id);

  let response: Response;
  try {
    response = await fetch(`${config.coreBaseUrl}${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        [credential.header]: credential.value,
        'x-correlation-id': randomUUID(),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new CoreError(502, FALLBACK_MESSAGE);
  }
};

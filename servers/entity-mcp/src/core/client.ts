import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config.ts';
import { EntityKind, coreUrlForEntity } from './routing.ts';

const TIMEOUT_MS = 10_000;

const MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Sign in again and retry.',
  403: "You don't have access to this entity.",
  404: 'That entity no longer exists.',
};

const FALLBACK_MESSAGE = 'Could not load this entity from DIAL.';

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

export type FetchEntityOptions = {
  config: ServerConfig;
  kind: EntityKind;
  id: string;
  authorization: string;
};

/**
 * Reads one entity record from DIAL Core as the calling user. The caller's
 * Authorization header is forwarded verbatim; this server holds no credential
 * of its own and never retries under a different identity.
 * @param options - config, entity coordinates and the forwarded credential
 */
export const fetchEntity = async (
  options: FetchEntityOptions,
): Promise<Record<string, unknown>> => {
  const { config, kind, id, authorization } = options;
  const path = coreUrlForEntity(kind, id);
  const response = await fetch(`${config.coreBaseUrl}${path}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization,
      'x-correlation-id': randomUUID(),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new CoreError(
      response.status,
      MESSAGES[response.status] ?? FALLBACK_MESSAGE,
    );
  }
  return (await response.json()) as Record<string, unknown>;
};

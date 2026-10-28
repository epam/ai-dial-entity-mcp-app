import { randomUUID } from 'node:crypto';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import type { CorrelationContext, InboundCredential } from './core/client.ts';

/**
 * Answers the liveness probe. Returns true when the request was handled here
 * and the caller should stop processing it.
 * @param pathname - request path
 * @param res - response to write to
 */
export const handleHealth = (
  pathname: string,
  res: ServerResponse<IncomingMessage>,
): boolean => {
  if (pathname !== '/health') return false;
  res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
  return true;
};

const MAX_BODY_BYTES = 1024 * 1024;
const BEARER = /^Bearer\s+\S/i;
const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_INVALID_REQUEST = -32600;

/**
 * JSON-RPC methods that need the caller's credential; every other method is
 * left to the transport. `tools/call` reads from Core as the caller.
 * `tools/list` lists nothing secret and is here for another reason: DIAL Chat
 * quick apps open a session with `initialize` and then `tools/list`, and read
 * a 401 on that `tools/list` as the signal to prompt the user to sign in,
 * while a 401 on `tools/call` leaves them waiting for a timeout. Core reads
 * the card for a `NONE` toolset with `initialize` and `resources/read` and no
 * credential, so those must stay open. Drop `tools/list` once quick apps
 * detect a missing sign-in some other way.
 *
 * This is a deny-list: a method added later is open until it is listed here.
 * The server serves only tools and resources, so no other method reaches user
 * data. A test pins the server's capabilities; when it fails because a new
 * one was added, decide which of its methods belong here.
 */
const CREDENTIAL_METHODS = new Set(['tools/list', 'tools/call']);

/** A request body that cannot be accepted, with the status to answer. */
export class RequestBodyError extends Error {
  readonly status: number;
  readonly rpcCode: number;

  constructor(status: number, rpcCode: number, message: string) {
    super(message);
    this.status = status;
    this.rpcCode = rpcCode;
  }
}

/**
 * Reads and parses a JSON request body, so the method can be inspected before
 * the MCP transport sees it. The parsed value is handed on to the transport.
 * @param req - inbound request, not yet consumed
 * @throws RequestBodyError - 413 when the body is too large, 400 when it is not JSON
 */
export const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const tooLarge = new RequestBodyError(
    413,
    JSON_RPC_INVALID_REQUEST,
    'Request body too large',
  );
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw tooLarge;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw tooLarge;
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new RequestBodyError(
      400,
      JSON_RPC_PARSE_ERROR,
      'Request body is not valid JSON',
    );
  }
};

/**
 * Answers a rejected body with a JSON-RPC error, as the MCP transport would,
 * and closes the connection so a client still sending is not left half-served.
 * @param res - response to write to
 * @param error - the rejection to report
 */
export const writeBodyError = (
  res: ServerResponse<IncomingMessage>,
  error: RequestBodyError,
): void => {
  res
    .writeHead(error.status, {
      'content-type': 'application/json',
      connection: 'close',
    })
    .end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: error.rpcCode, message: error.message },
        id: null,
      }),
    );
};

/**
 * Tells whether a JSON-RPC message, or any message of a batch, calls a method
 * that needs the caller's credential. A message with no method (a reply, or not
 * a JSON-RPC message at all) is left to the transport to reject.
 * @param body - the parsed request body
 */
export const requiresCredential = (body: unknown): boolean => {
  const messages: unknown[] = Array.isArray(body) ? body : [body];
  return messages.some(
    (message) =>
      typeof message === 'object' &&
      message !== null &&
      'method' in message &&
      typeof message.method === 'string' &&
      CREDENTIAL_METHODS.has(message.method),
  );
};

/**
 * Refuses a request that carries no forwarded credential with HTTP 401 and a
 * `WWW-Authenticate` challenge. Returns true when the request was refused and
 * the caller should stop processing it.
 * @param credential - the credential read off the request, if any
 * @param res - response to write to
 */
export const rejectUnauthenticated = (
  credential: InboundCredential | undefined,
  res: ServerResponse<IncomingMessage>,
): boolean => {
  if (credential) return false;
  res
    .writeHead(401, {
      'content-type': 'text/plain',
      'www-authenticate': 'Bearer',
    })
    .end('Authentication required');
  return true;
};

const firstValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Picks the caller's forwarded credential off the inbound request headers:
 * the `Authorization` header when it carries a bearer token, nothing else.
 * Returns undefined for any other header or scheme, so the caller can fail
 * closed with the sign-in challenge rather than send Core something it will
 * refuse.
 * @param headers - inbound request headers
 */
export const readInboundCredential = (
  headers: IncomingHttpHeaders,
): InboundCredential | undefined => {
  const authorization = firstValue(headers.authorization);
  if (authorization && BEARER.test(authorization)) {
    return { header: 'Authorization', value: authorization };
  }
  return undefined;
};

/**
 * Establishes one correlation id for an inbound request, so this server's
 * logs can be joined with DIAL Core's. Reuses `X-Correlation-ID`, else
 * `X-Request-ID`, else `X-Trace-ID`, and mints a fresh id only when the host
 * sent none of them. `requestId` and `traceId` carry the caller's own values,
 * if present, independent of which header seeded `correlationId`.
 * @param headers - inbound request headers
 */
export const readInboundCorrelation = (
  headers: IncomingHttpHeaders,
): CorrelationContext => {
  const correlationId = firstValue(headers['x-correlation-id']);
  const requestId = firstValue(headers['x-request-id']);
  const traceId = firstValue(headers['x-trace-id']);
  return {
    correlationId: correlationId ?? requestId ?? traceId ?? randomUUID(),
    requestId,
    traceId,
  };
};

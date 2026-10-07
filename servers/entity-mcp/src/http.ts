import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import type { InboundCredential } from './core/client.ts';

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

const firstValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Picks the caller's forwarded credential off the inbound request headers.
 * `Authorization` wins when both are present, matching DIAL's own auth
 * precedence (user JWT, then `Api-Key`). Returns undefined when neither
 * header carries a value, so the caller can fail closed.
 * @param headers - inbound request headers
 */
export const readInboundCredential = (
  headers: IncomingHttpHeaders,
): InboundCredential | undefined => {
  const authorization = firstValue(headers.authorization);
  if (authorization) return { header: 'Authorization', value: authorization };
  const apiKey = firstValue(headers['api-key']);
  if (apiKey) return { header: 'Api-Key', value: apiKey };
  return undefined;
};

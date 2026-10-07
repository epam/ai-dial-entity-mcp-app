import type { IncomingMessage, ServerResponse } from 'node:http';

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

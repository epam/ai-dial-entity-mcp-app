import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ServerConfig } from './config.ts';
import {
  handleHealth,
  describeCredentialCalls,
  hasClientChannel,
  readInboundCorrelation,
  readInboundCredential,
  readJsonBody,
  rejectUnauthenticated,
  RequestBodyError,
  requiresCredential,
  writeBodyError,
} from './http.ts';
import { createMcpServer } from './mcp/server.ts';

/**
 * Builds the HTTP request handler: `/health`, and `/mcp` as a stateless
 * Streamable HTTP MCP endpoint. Unless `customOAuthClient` is explicitly
 * false (the toolset forwards the user's session token) it refuses a
 * credential-less `tools/call` with a 401 challenge. When it is
 * false every method reaches the server, and a tool called without a
 * credential answers with a tool error.
 * @param config - server configuration
 * @param appHtml - the built entity card, served as the `ui://` resource
 */
export const createRequestHandler =
  (config: ServerConfig, appHtml: string) =>
  async (
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
  ): Promise<void> => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (handleHealth(pathname, res)) return;
    if (pathname !== '/mcp') {
      res.writeHead(404).end();
      return;
    }

    let body: unknown;
    if (req.method === 'POST') {
      try {
        body = await readJsonBody(req);
      } catch (error) {
        if (!(error instanceof RequestBodyError)) throw error;
        writeBodyError(res, error);
        return;
      }
    }

    const credential = readInboundCredential(req.headers);
    if (
      config.customOAuthClient !== false &&
      requiresCredential(body) &&
      rejectUnauthenticated(credential, res)
    ) {
      const { correlationId } = readInboundCorrelation(req.headers);
      console.warn(
        `refused unauthenticated ${req.method} /mcp ${describeCredentialCalls(body)} clientChannel=${hasClientChannel(req.headers) ? 'present' : 'absent'} correlationId=${JSON.stringify(correlationId)}`,
      );
      return;
    }

    const server = createMcpServer(
      config,
      appHtml,
      credential,
      readInboundCorrelation(req.headers),
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500).end();
    }
  };

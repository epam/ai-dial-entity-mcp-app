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
import { REGISTERED_TOOL_NAMES, createMcpServer } from './mcp/server.ts';
import { logger } from './telemetry/logger.ts';
import {
  finishWithResponse,
  observeMcpRequest,
} from './telemetry/mcp-metrics.ts';

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

    const observation = observeMcpRequest(REGISTERED_TOOL_NAMES);
    finishWithResponse(observation, res);

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

    observation.setBody(body);

    const credential = readInboundCredential(req.headers);
    if (
      config.customOAuthClient !== false &&
      requiresCredential(body) &&
      rejectUnauthenticated(credential, res)
    ) {
      const { correlationId } = readInboundCorrelation(req.headers);
      logger.warn(
        `refused unauthenticated ${req.method} /mcp ${describeCredentialCalls(body)} clientChannel=${hasClientChannel(req.headers) ? 'present' : 'absent'} correlationId=${JSON.stringify(correlationId)}`,
      );
      return;
    }

    const server = createMcpServer(
      config,
      appHtml,
      credential,
      readInboundCorrelation(req.headers),
      observation.probe,
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
      logger.error(error);
      if (!res.headersSent) res.writeHead(500).end();
    }
  };

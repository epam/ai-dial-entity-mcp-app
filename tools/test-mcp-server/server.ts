import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, join, resolve } from 'node:path';
import {
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const RESOURCE_URI = 'ui://entity-card/index.html';
// DIAL Core rejects the spec's `text/html;profile=mcp-app` resource MIME type.
const RESOURCE_MIME_TYPE = 'text/html';

const repoRoot = resolve(import.meta.dirname, '../..');
const port = Number(process.env.PORT ?? 8080);
const appHtmlPath =
  process.env.APP_HTML ?? join(repoRoot, 'apps/entity-card/dist/index.html');
const fixturesDir =
  process.env.FIXTURES_DIR ?? join(repoRoot, 'apps/entity-card/fixtures');

const appHtml = readFileSync(appHtmlPath, 'utf8');
const fixtures = new Map(
  readdirSync(fixturesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [
      basename(file, '.json'),
      JSON.parse(readFileSync(join(fixturesDir, file), 'utf8')) as Record<
        string,
        unknown
      >,
    ]),
);
const fixtureNames = [...fixtures.keys()];

/**
 * Builds an error tool result, which the app renders as its failed state.
 * @param text - message for the model and the host
 */
const errorResult = (text: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text }],
});

/**
 * Creates an MCP server with the entity card tool and its UI resource.
 * A new one is made per request because the transport is stateless.
 */
const createMcpServer = (): McpServer => {
  const server = new McpServer({
    name: 'entity-card-test-server',
    version: '0.0.0',
  });

  registerAppTool(
    server,
    'show_entity_card',
    {
      title: 'Show entity card',
      description: `Shows an entity card (a skill or an agent) for a test fixture. Pass one of: ${fixtureNames.join(', ')}.`,
      inputSchema: { entity: z.string().optional() },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ entity }) => {
      const payload = entity ? fixtures.get(entity) : undefined;
      if (!payload) {
        return errorResult(
          `Unknown entity "${entity ?? ''}". Use one of: ${fixtureNames.join(', ')}.`,
        );
      }
      return {
        structuredContent: payload,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    },
  );

  registerAppResource(
    server,
    'Entity card',
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: appHtml },
      ],
    }),
  );

  return server;
};

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (path === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  if (path !== '/mcp') {
    res.writeHead(404).end();
    return;
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500).end();
  }
}).listen(port, () => {
  console.log(`Test MCP server on http://localhost:${port}/mcp`);
  console.log(`Fixtures: ${fixtureNames.join(', ')}`);
});

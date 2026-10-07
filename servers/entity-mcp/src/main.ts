import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.ts';
import { handleHealth } from './http.ts';
import { createMcpServer } from './mcp/server.ts';

const config = loadConfig(process.env);
const appHtml = readFileSync(
  resolve(import.meta.dirname, config.appHtmlPath),
  'utf8',
);

createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (handleHealth(pathname, res)) return;
  if (pathname !== '/mcp') {
    res.writeHead(404).end();
    return;
  }

  const server = createMcpServer(config, appHtml, req.headers.authorization);
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
}).listen(config.port, () => {
  console.log(`entity-mcp listening on :${config.port}/mcp`);
});

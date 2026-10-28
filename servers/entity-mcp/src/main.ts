import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { loadConfig } from './config.ts';
import { createRequestHandler } from './handler.ts';

const config = loadConfig(process.env);
const appHtml = readFileSync(
  resolve(import.meta.dirname, config.appHtmlPath),
  'utf8',
);

const httpServer = createServer(createRequestHandler(config, appHtml));

httpServer.listen(config.port, () => {
  console.log(`entity-mcp listening on :${config.port}/mcp`);
});

process.on('SIGTERM', () => {
  console.log('entity-mcp received SIGTERM, shutting down');
  httpServer.close(() => process.exit(0));
  httpServer.closeIdleConnections();
});

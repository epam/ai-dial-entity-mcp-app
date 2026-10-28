import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import {
  ACTION_TEMPLATE_VARS,
  findConfigWarnings,
  loadConfig,
} from './config.ts';
import { createRequestHandler } from './handler.ts';

const config = loadConfig(process.env);
const appHtml = readFileSync(
  resolve(import.meta.dirname, config.appHtmlPath),
  'utf8',
);

for (const warning of findConfigWarnings(config, process.env)) {
  console.warn(`entity-mcp: ${warning}`);
}

const missingButtons = Object.entries(ACTION_TEMPLATE_VARS)
  .filter(
    ([key]) =>
      !config.actionTemplates[key as keyof typeof config.actionTemplates],
  )
  .map(([, name]) => name);
if (missingButtons.length > 0) {
  console.log(
    `entity-mcp: no card button for unset ${missingButtons.join(', ')}`,
  );
}

const httpServer = createServer(createRequestHandler(config, appHtml));

httpServer.listen(config.port, () => {
  console.log(`entity-mcp listening on :${config.port}/mcp`);
});

process.on('SIGTERM', () => {
  console.log('entity-mcp received SIGTERM, shutting down');
  httpServer.close(() => process.exit(0));
  httpServer.closeIdleConnections();
});

import react from '@vitejs/plugin-react';
import type { Connect, Plugin, PluginOption } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Stable path the MCP server fetches the app HTML from, in dev and in production. */
export const MCP_APP_PATH = '/_mcp-app/index.html';

const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
  const [path, query] = (req.url ?? '').split('?');
  if (path === MCP_APP_PATH) req.url = query ? `/?${query}` : '/';
  next();
};

/** Serves the app at `MCP_APP_PATH` on the Vite dev and preview servers. */
export const mcpAppEndpoint = (): Plugin => ({
  name: 'mcp-app-endpoint',
  configureServer: (server) => {
    server.middlewares.use(rewrite);
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(rewrite);
  },
});

/**
 * Vite plugins for an MCP App: React, single-file output (all JS/CSS inlined
 * into `index.html` so hosts need no extra resource domains) and the stable
 * `MCP_APP_PATH` endpoint.
 */
export const mcpAppVite = (): PluginOption[] => [
  react(),
  viteSingleFile(),
  mcpAppEndpoint(),
];

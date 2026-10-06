import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { devHostServer } from './devHostServer';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [devHostServer()],
  define: {
    __MCP_APP_URL__: JSON.stringify(
      process.env.MCP_APP_URL ?? 'http://localhost:4300/_mcp-app/index.html',
    ),
    __MCP_DEFAULT_FIXTURE__: JSON.stringify(
      process.env.MCP_DEFAULT_FIXTURE ?? '',
    ),
  },
  server: {
    port: Number(process.env.MCP_DEV_HOST_PORT ?? 4301),
    strictPort: true,
    open: true,
  },
});

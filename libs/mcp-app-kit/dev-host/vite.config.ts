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
  },
  server: { port: 4301, strictPort: true, open: true },
});

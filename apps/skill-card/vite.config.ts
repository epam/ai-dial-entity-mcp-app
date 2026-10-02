import { mcpAppVite } from '@epam/ai-dial-mcp-app-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: mcpAppVite(),
  server: { port: 4300, strictPort: true },
  preview: { port: 4300, strictPort: true },
});

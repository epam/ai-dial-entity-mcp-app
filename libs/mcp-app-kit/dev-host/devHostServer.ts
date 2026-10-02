import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev-only endpoints the harness page reads: the fixture list and contents
 * from `MCP_FIXTURES_DIR`, and the built single-file app from `MCP_BUILT_FILE`.
 */
export const devHostServer = (): Plugin => ({
  name: 'mcp-dev-host-server',
  configureServer: (server) => {
    const fixturesDir = process.env.MCP_FIXTURES_DIR;
    const builtFile = process.env.MCP_BUILT_FILE;

    server.middlewares.use('/__fixtures', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (!fixturesDir || !existsSync(fixturesDir)) {
        res.end('[]');
        return;
      }
      const name = basename(decodeURIComponent((req.url ?? '/').slice(1)));
      if (!name) {
        const names = readdirSync(fixturesDir).filter((file) =>
          file.endsWith('.json'),
        );
        res.end(JSON.stringify(names));
        return;
      }
      const path = join(fixturesDir, name);
      if (!existsSync(path)) {
        res.statusCode = 404;
        res.end('{}');
        return;
      }
      res.end(readFileSync(path, 'utf8'));
    });

    server.middlewares.use('/__built', (_req, res) => {
      if (!builtFile || !existsSync(builtFile)) {
        res.statusCode = 404;
        res.end('Run the app build first.');
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end(readFileSync(builtFile, 'utf8'));
    });
  },
});

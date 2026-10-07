import { createServer } from 'node:http';
import { loadConfig } from './config.ts';
import { handleHealth } from './http.ts';

const config = loadConfig(process.env);

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (handleHealth(pathname, res)) return;
  res.writeHead(404).end();
}).listen(config.port, () => {
  console.log(`entity-mcp listening on :${config.port}`);
});

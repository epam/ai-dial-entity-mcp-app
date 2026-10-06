import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1024 * 1024;
const dist = join(process.cwd(), 'dist');
const files = readdirSync(dist, { recursive: true }).filter((f) =>
  statSync(join(dist, f)).isFile(),
);

if (files.length !== 1 || files[0] !== 'index.html') {
  console.error(`Expected only dist/index.html, found: ${files.join(', ')}`);
  process.exit(1);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const external = html.match(
  /<script[^>]+src=|<link[^>]+rel="stylesheet"[^>]+href=/g,
);
if (external) {
  console.error(
    `dist/index.html references external assets: ${external.join(', ')}`,
  );
  process.exit(1);
}

const bytes = Buffer.byteLength(html);
const kb = (bytes / 1024).toFixed(0);
if (bytes > MAX_BYTES) {
  console.error(
    `dist/index.html is ${kb} KB (limit 1024 KB) — a heavy dependency (e.g. Monaco) was bundled`,
  );
  process.exit(1);
}
console.log(`single-file build ok: dist/index.html (${kb} KB)`);

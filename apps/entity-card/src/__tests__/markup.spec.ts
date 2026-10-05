// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('..', import.meta.url));

/**
 * Lists the app's source files, skipping tests.
 * @param dir - directory to walk
 */
const sourcesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : sourcesIn(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const files = sourcesIn(srcDir).map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}));

describe('app markup', () => {
  it('uses no ui-kit 1.0 Dial* components', () => {
    files.forEach(({ path, text }) =>
      expect(text, path).not.toMatch(/\bDial[A-Z]\w*/),
    );
  });

  it('uses no rounded-* scale class that ui-kit components share', () => {
    files.forEach(({ path, text }) =>
      expect(text, path).not.toMatch(
        /(?<![\w:[-])rounded(?:-(?:none|xs|sm|md|lg|xl|2xl|3xl|full))?(?![\w[-])/,
      ),
    );
  });

  it('uses no removed 1.0 utilities', () => {
    files.forEach(({ path, text }) =>
      expect(text, path).not.toMatch(
        /\b(bg-layer-[0-4]|text-accent-primary|bg-accent-primary-alpha)\b/,
      ),
    );
  });
});

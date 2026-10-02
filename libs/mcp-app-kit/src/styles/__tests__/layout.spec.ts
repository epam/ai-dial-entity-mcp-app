// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layoutCss = readFileSync(
  fileURLToPath(new URL('../layout.css', import.meta.url)),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('layout.css', () => {
  it('forces the hidden attribute to win over display utilities', () => {
    const rule = layoutCss.match(/(^|\})\s*\[hidden\]\s*\{([^}]*)\}/);
    expect(rule?.[2]).toMatch(/display:\s*none\s*!important/);
  });

  it('keeps the hidden rule outside any cascade layer', () => {
    expect(layoutCss).not.toMatch(/@layer/);
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../host-tokens.css', import.meta.url)),
  'utf8',
);

const MCP_KEYS = new Set([
  '--color-background-primary',
  '--color-background-secondary',
  '--color-background-tertiary',
  '--color-background-inverse',
  '--color-background-ghost',
  '--color-background-info',
  '--color-background-danger',
  '--color-background-success',
  '--color-background-warning',
  '--color-background-disabled',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-text-inverse',
  '--color-text-ghost',
  '--color-text-info',
  '--color-text-danger',
  '--color-text-success',
  '--color-text-warning',
  '--color-text-disabled',
  '--color-border-primary',
  '--color-border-secondary',
  '--color-border-tertiary',
  '--color-border-inverse',
  '--color-border-ghost',
  '--color-border-info',
  '--color-border-danger',
  '--color-border-success',
  '--color-border-warning',
  '--color-border-disabled',
  '--color-ring-primary',
  '--font-sans',
]);

const UI_KIT_KEYS = new Set([
  '--bg-layer-0',
  '--bg-layer-1',
  '--bg-layer-2',
  '--bg-layer-3',
  '--bg-layer-4',
  '--bg-inverted',
  '--bg-error',
  '--bg-warning',
  '--bg-info',
  '--bg-success',
  '--text-primary',
  '--text-secondary',
  '--text-error',
  '--text-warning',
  '--text-info',
  '--text-success',
  '--stroke-primary',
  '--stroke-secondary',
  '--stroke-tertiary',
  '--stroke-error',
  '--stroke-warning',
  '--stroke-info',
  '--stroke-success',
  '--stroke-focus',
  '--controls-bg-disable',
  '--controls-text-disable',
  '--theme-font',
]);

const ACCENT_KEYS = [
  '--text-accent-primary',
  '--bg-accent-primary-alpha',
  '--stroke-accent-primary',
];

const declarations = (block: string) =>
  [...block.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)/g)].map(
    ([, target, source]) => ({
      target: target!,
      source: source!,
    }),
  );

const [rootBlock = '', lightBlock = ''] = css.split(
  ":root[data-theme='light']",
);

describe('host-tokens.css', () => {
  it('maps only known MCP variables onto known ui-kit variables', () => {
    const all = declarations(css);
    expect(all.length).toBeGreaterThan(20);
    all.forEach(({ target, source }) => {
      expect(UI_KIT_KEYS, target).toContain(target);
      expect(MCP_KEYS, source).toContain(source);
    });
  });

  it('has no fallback in the base mapping so ui-kit defaults apply', () => {
    expect(rootBlock).not.toMatch(/var\(--[a-z0-9-]+,/);
  });

  it('light block covers every base mapping with a fallback', () => {
    const base = declarations(rootBlock)
      .map((d) => d.target)
      .sort();
    const light = declarations(lightBlock)
      .map((d) => d.target)
      .sort();
    expect(light).toEqual(base);
    expect(lightBlock).toMatch(/var\(--color-background-primary,\s*#/);
    const mappings = [
      ...lightBlock.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\s*(,)?/g),
    ];
    expect(mappings.length).toBe(light.length);
    mappings.forEach(([, target, , comma]) => {
      expect(comma, target).toBe(',');
    });
  });

  it('gives accent tokens light literals only in the light block', () => {
    ACCENT_KEYS.forEach((key) => {
      expect(lightBlock).toMatch(new RegExp(`${key}:\\s*#[0-9a-f]+;`));
      expect(rootBlock).not.toContain(key);
    });
  });
});

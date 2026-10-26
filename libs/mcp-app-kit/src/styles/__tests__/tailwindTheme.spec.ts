// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8');

const hostTokensCss = read('host-tokens.css');
const themeCss = read('tailwind-theme.css');

/** Theme keys of `tailwind-theme.css` as `{ '--key': 'value' }`. */
const theme = Object.fromEntries(
  [...themeCss.matchAll(/^\s+(--[a-z0-9-]+):\s*([^;]+);/gm)].map(
    ([, key, value]) => [key, value!.replace(/\s+/g, ' ').trim()],
  ),
);
const keys = (prefix: string) =>
  Object.keys(theme).filter((key) => key.startsWith(prefix));

const lightLiteral = (name: string) =>
  hostTokensCss
    .match(
      new RegExp(`${name}:\\s*var\\(--[a-z0-9-]+,\\s*(#[0-9a-f]+)\\)`, 'i'),
    )?.[1]
    ?.toLowerCase();

describe('tailwind theme', () => {
  it('colour fallbacks equal the light block of host-tokens.css', () => {
    const colours = [
      ...keys('--background-color-'),
      ...keys('--text-color-'),
      ...keys('--border-color-'),
    ].map((key) => theme[key]!);
    expect(colours.length).toBe(17);
    colours.forEach((value) => {
      const [, name, literal] = value.match(
        /^var\((--[a-z0-9-]+), (#[0-9a-f]+)\)$/i,
      )!;
      expect(literal!.toLowerCase(), name).toBe(lightLiteral(name!));
    });
  });

  it('drops the 1.0 utilities', () => {
    [
      'layer-0',
      'layer-1',
      'layer-2',
      'layer-3',
      'layer-4',
      'accent-primary-alpha',
    ].forEach((key) =>
      expect(theme).not.toHaveProperty(`--background-color-${key}`),
    );
    expect(theme).not.toHaveProperty('--text-color-accent-primary');
  });

  it.each([
    ['normal', '400'],
    ['medium', '500'],
    ['semibold', '600'],
    ['bold', '700'],
  ])('font-%s reads --font-weight-* with fallback %s', (key, fallback) => {
    expect(theme[`--font-weight-${key}`]).toBe(
      `var(--font-weight-${key}, ${fallback})`,
    );
  });

  it.each([
    ['xs', 'text-xs', '12px', '16px'],
    ['sm', 'text-sm', '14px', '20px'],
    ['base', 'text-md', '16px', '24px'],
    ['md', 'text-md', '16px', '24px'],
    ['lg', 'text-lg', '16px', '26px'],
    ['heading-xs', 'heading-xs', '16px', '24px'],
    ['heading-sm', 'heading-sm', '18px', '26px'],
    ['heading-md', 'heading-md', '20px', '28px'],
    ['heading-lg', 'heading-lg', '22px', '32px'],
    ['heading-xl', 'heading-xl', '28px', '40px'],
    ['heading-2xl', 'heading-2xl', '32px', '48px'],
    ['heading-3xl', 'heading-3xl', '32px', '48px'],
  ])(
    'text-%s reads --font-%s-* with D18 fallbacks',
    (key, token, size, lineHeight) => {
      expect(theme[`--text-${key}`]).toBe(`var(--font-${token}-size, ${size})`);
      expect(theme[`--text-${key}--line-height`]).toBe(
        `var(--font-${token}-line-height, ${lineHeight})`,
      );
    },
  );

  it("radii read MCP tokens with Tailwind's own values as fallbacks", () => {
    expect(keys('--radius')).toEqual([
      '--radius-sm',
      '--radius',
      '--radius-md',
      '--radius-lg',
      '--radius-xl',
      '--radius-full',
    ]);
    expect(theme['--radius-sm']).toBe('var(--border-radius-xs, 0.125rem)');
    expect(theme['--radius']).toBe('var(--border-radius-sm, 0.25rem)');
    expect(theme['--radius-md']).toBe('var(--border-radius-md, 0.375rem)');
    expect(theme['--radius-lg']).toBe('var(--border-radius-lg, 0.5rem)');
    expect(theme['--radius-xl']).toBe('var(--border-radius-xl, 0.75rem)');
    expect(theme['--radius-full']).toBe('var(--border-radius-full, 9999px)');
  });
});

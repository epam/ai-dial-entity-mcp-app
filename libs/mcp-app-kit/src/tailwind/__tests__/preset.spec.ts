// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import preset from '../preset.js';

const hostTokensCss = readFileSync(
  fileURLToPath(new URL('../../styles/host-tokens.css', import.meta.url)),
  'utf8',
);
const lightLiteral = (name: string) =>
  hostTokensCss
    .match(
      new RegExp(`${name}:\\s*var\\(--[a-z0-9-]+,\\s*(#[0-9a-f]+)\\)`, 'i'),
    )?.[1]
    ?.toLowerCase();

const { extend } = preset.theme;

describe('tailwind preset', () => {
  it('colour fallbacks equal the light block of host-tokens.css', () => {
    const colours = [
      ...Object.values(extend.backgroundColor),
      ...Object.values(extend.textColor),
      ...Object.values(extend.borderColor),
    ] as string[];
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
    ].forEach((key) => expect(extend.backgroundColor).not.toHaveProperty(key));
    expect(extend.textColor).not.toHaveProperty('accent-primary');
  });

  it.each([
    ['normal', '400'],
    ['medium', '500'],
    ['semibold', '600'],
    ['bold', '700'],
  ])('font-%s reads --font-weight-* with fallback %s', (key, fallback) => {
    expect(extend.fontWeight[key]).toBe(
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
      expect(extend.fontSize[key]).toEqual([
        `var(--font-${token}-size, ${size})`,
        { lineHeight: `var(--font-${token}-line-height, ${lineHeight})` },
      ]);
    },
  );

  it("radii read MCP tokens with Tailwind's own values as fallbacks", () => {
    expect(extend.borderRadius).toEqual({
      sm: 'var(--border-radius-xs, 0.125rem)',
      DEFAULT: 'var(--border-radius-sm, 0.25rem)',
      md: 'var(--border-radius-md, 0.375rem)',
      lg: 'var(--border-radius-lg, 0.5rem)',
      xl: 'var(--border-radius-xl, 0.75rem)',
      full: 'var(--border-radius-full, 9999px)',
    });
    expect(extend.borderWidth).toEqual({
      DEFAULT: 'var(--border-width-regular, 1px)',
    });
  });
});

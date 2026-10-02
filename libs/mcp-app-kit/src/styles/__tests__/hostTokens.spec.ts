// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type CssRule = { context: string[]; selector: string; body: string };
type Declaration = { name: string; value: string };

const readLocal = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const hostTokensCss = readLocal('../host-tokens.css');
const layoutCss = readLocal('../layout.css');
const presetSource = readLocal('../../tailwind/preset.js');
const uiKitCss = readFileSync(
  createRequire(import.meta.url).resolve('@epam/ai-dial-ui-kit/styles.css'),
  'utf8',
);

/**
 * Splits CSS into rules with balanced braces, so native nesting (as in the
 * ui-kit dist) and at-rules are handled. Each rule records its enclosing
 * selectors / at-rules and its full body, nested rules included.
 * @param css - stylesheet source
 */
const parseRules = (css: string): CssRule[] => {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const stack: Array<{ selector: string; open: number }> = [];
  let start = 0;
  [...source].forEach((char, index) => {
    if (char === '{') {
      stack.push({ selector: source.slice(start, index).trim(), open: index });
      start = index + 1;
    } else if (char === '}') {
      const rule = stack.pop();
      if (rule)
        rules.push({
          context: stack.map((entry) => entry.selector),
          selector: rule.selector,
          body: source.slice(rule.open + 1, index),
        });
      start = index + 1;
    } else if (char === ';') {
      start = index + 1;
    }
  });
  return rules;
};

/**
 * Returns the custom-property declarations of a rule body.
 * @param body - rule body without nested rules
 */
const declarationsOf = (body: string): Declaration[] =>
  [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(
    ([, name, value]) => ({
      name: name!,
      value: value!
        .replace(/\s+/g, ' ')
        .replace(/\(\s/g, '(')
        .replace(/\s\)/g, ')')
        .trim(),
    }),
  );

const findBlock = (selector: string, context: string[] = []) => {
  const rule = parseRules(hostTokensCss).find(
    (candidate) =>
      candidate.selector.replace(/"/g, "'") === selector &&
      candidate.context.join('|') === context.join('|'),
  );
  if (!rule) throw new Error(`host-tokens.css has no ${selector} block`);
  return declarationsOf(rule.body);
};

const lightBlock = findBlock(':root');
const darkBlock = findBlock(":root[data-theme='dark']");
const preferredDarkBlock = findBlock(':root:not([data-theme])', [
  '@media (prefers-color-scheme: dark)',
]);
const themeBlocks = { lightBlock, darkBlock, preferredDarkBlock };

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

/** Accent tokens have no MCP variable, so both blocks set plain literals. */
const ACCENT_LITERALS = [
  '--text-accent-primary',
  '--bg-accent-primary-alpha',
  '--stroke-accent-primary',
];

/** Primary-button colours stay on ui-kit defaults in light, overridden in dark. */
const DARK_ONLY_LITERALS = [
  '--controls-bg-accent-primary',
  '--controls-bg-accent-primary-hover',
  '--controls-bg-accent-primary-active',
];

/** ui-kit variables the app's components read but intentionally leaves to ui-kit defaults. */
const UI_KIT_DEFAULTS = new Set([
  '--controls-text-permanent',
  '--controls-bg-disable-accent',
  '--controls-text-accent-disable',
  '--stroke-focus-black',
]);

const REMOVED_KEYS = ['--bg-inverted', '--controls-text-disable'];

const namesOf = (block: Declaration[]) =>
  block.map((declaration) => declaration.name).sort();

const fallbackOf = (block: Declaration[], name: string) => {
  const value = block.find((declaration) => declaration.name === name)?.value;
  return value
    ?.match(/,\s*([^,()]+)\)+$/)?.[1]
    ?.trim()
    .toLowerCase();
};

describe('host-tokens.css', () => {
  it.each(Object.entries(themeBlocks))(
    '%s gives every var() a fallback',
    (_, block) => {
      expect(block.length).toBeGreaterThan(30);
      block.forEach(({ name, value }) => {
        expect(value, name).not.toMatch(/var\(--[a-z0-9-]+\s*\)/);
      });
    },
  );

  it.each(Object.entries(themeBlocks))(
    '%s reads only MCP standard variables',
    (_, block) => {
      block.forEach(({ name, value }) => {
        [...value.matchAll(/var\((--[a-z0-9-]+)/g)].forEach(([, source]) => {
          expect(MCP_KEYS, `${name} → ${source}`).toContain(source);
        });
      });
    },
  );

  it('light and dark blocks set the same ui-kit variables', () => {
    const darkWithoutExceptions = namesOf(darkBlock).filter(
      (name) => !DARK_ONLY_LITERALS.includes(name),
    );
    expect(namesOf(lightBlock)).toEqual(darkWithoutExceptions);
    DARK_ONLY_LITERALS.forEach((name) => {
      expect(namesOf(darkBlock)).toContain(name);
      expect(namesOf(lightBlock)).not.toContain(name);
    });
  });

  it('repeats the dark block for prefers-color-scheme: dark', () => {
    expect(preferredDarkBlock).toEqual(darkBlock);
  });

  it('sets accent tokens as literals in both themes', () => {
    [lightBlock, darkBlock].forEach((block) =>
      ACCENT_LITERALS.forEach((name) => {
        expect(fallbackOf(block, name) ?? '', name).toBe('');
        expect(
          block.find((declaration) => declaration.name === name)?.value,
          name,
        ).toMatch(/^#[0-9a-f]+$/i);
      }),
    );
  });

  it('drops mappings ui-kit does not read', () => {
    [lightBlock, darkBlock].forEach((block) =>
      REMOVED_KEYS.forEach((name) =>
        expect(namesOf(block)).not.toContain(name),
      ),
    );
  });

  it('keeps the previously invisible controls readable in each theme', () => {
    expect(fallbackOf(lightBlock, '--bg-layer-1')).toBe('#ffffff');
    expect(fallbackOf(darkBlock, '--bg-layer-1')).toBe('#0c101d');
    expect(fallbackOf(lightBlock, '--bg-layer-raised')).toBe('#eef1f7');
    expect(fallbackOf(darkBlock, '--bg-layer-raised')).toBe('#242c42');
    expect(fallbackOf(darkBlock, '--controls-text-neutral')).toBe('#fcfcfc');
    expect(fallbackOf(lightBlock, '--stroke-focus')).toBe('#2764d9');
    expect(fallbackOf(darkBlock, '--stroke-focus')).toBe('#eef1f7');
  });
});

describe('ui-kit coverage guard', () => {
  const GUARDED_SELECTORS = [
    '.dial-primary-solid-button',
    '.dial-neutral-outlined-button',
    '.bg-layer-raised',
  ];

  const readVars = (selector: string) =>
    new Set(
      parseRules(uiKitCss)
        .filter((rule) =>
          rule.selector
            .split(',')
            .some((part) => part.trim().startsWith(selector)),
        )
        .flatMap((rule) =>
          [...rule.body.matchAll(/var\((--[a-z0-9-]+)/g)].map(
            ([, name]) => name!,
          ),
        ),
    );

  it.each(GUARDED_SELECTORS)(
    'host-tokens.css sets every variable %s reads',
    (selector) => {
      const read = [...readVars(selector)];
      expect(read.length).toBeGreaterThan(0);
      read
        .filter((name) => !UI_KIT_DEFAULTS.has(name))
        .forEach((name) => {
          expect(namesOf(darkBlock), `${selector} reads ${name}`).toContain(
            name,
          );
          if (!DARK_ONLY_LITERALS.includes(name))
            expect(namesOf(lightBlock), `${selector} reads ${name}`).toContain(
              name,
            );
        });
    },
  );
});

describe('light defaults outside host-tokens.css', () => {
  it('tailwind preset fallbacks match the light block', () => {
    const fallbacks = [
      ...presetSource.matchAll(/var\((--[a-z0-9-]+),\s*(#[0-9a-f]+)\)/gi),
    ];
    expect(fallbacks.length).toBeGreaterThan(15);
    fallbacks.forEach(([, name, literal]) => {
      const expected =
        fallbackOf(lightBlock, name!) ??
        lightBlock.find((declaration) => declaration.name === name)?.value;
      expect(literal!.toLowerCase(), name).toBe(expected?.toLowerCase());
    });
  });

  it('layout.css body colour falls back to the light text colour', () => {
    expect(layoutCss).toMatch(
      new RegExp(
        `color:\\s*var\\(--text-primary,\\s*${fallbackOf(lightBlock, '--text-primary')}\\)`,
      ),
    );
  });
});

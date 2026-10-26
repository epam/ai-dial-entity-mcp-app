// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STYLE_EXTENSION_VARIABLE_KEYS } from '../../core';
import { MCP_STYLE_VARIABLE_KEYS } from '../../testing';

type CssRule = { context: string[]; selector: string; body: string };
type Declaration = { name: string; value: string };

const readLocal = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const hostTokensCss = readLocal('../host-tokens.css');
const layoutCss = readLocal('../layout.css');
const dialCss = readLocal('./fixtures/dial-mcp-vars.css');
const uiKitCss = readFileSync(
  createRequire(import.meta.url).resolve('@epam/ai-dial-ui-kit/styles.css'),
  'utf8',
);

const MCP_KEYS = new Set<string>(MCP_STYLE_VARIABLE_KEYS);
const DERIVED_SOURCE_KEYS = new Set<string>([
  ...MCP_STYLE_VARIABLE_KEYS,
  ...STYLE_EXTENSION_VARIABLE_KEYS,
]);

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
const derivedBlock = findBlock('html');
const neutralButtonBlock = findBlock('.dial-kit-neutral-solid-button');
const primaryButtonBlock = findBlock('.dial-kit-primary-solid-button');
const toneBlocks = {
  success: findBlock('.mcp-tone-success'),
  warning: findBlock('.mcp-tone-warning'),
  danger: findBlock('.mcp-tone-danger'),
};
const themeBlocks = { lightBlock, darkBlock, preferredDarkBlock };

const namesOf = (block: Declaration[]) =>
  block.map((declaration) => declaration.name).sort();
const valueOf = (block: Declaration[], name: string) =>
  block.find((declaration) => declaration.name === name)?.value;
const sourcesOf = (value: string) =>
  [...value.matchAll(/var\((--[a-z0-9-]+)/g)].map(([, source]) => source!);
const fallbackOf = (block: Declaration[], name: string) =>
  valueOf(block, name)
    ?.match(/,\s*([^,()]+)\)+$/)?.[1]
    ?.trim()
    .toLowerCase();

/** Literal fallbacks ui-kit's own CSS uses for a variable, e.g. `#fcfcfc`. */
const uiKitFallbacks = (name: string) =>
  new Set(
    [
      ...uiKitCss.matchAll(new RegExp(`var\\(${name},(#[0-9a-f]+)\\)`, 'gi')),
    ].map(([, literal]) => literal!.toLowerCase()),
  );

describe('host-tokens.css theme blocks', () => {
  it.each(Object.entries(themeBlocks))(
    '%s gives every var() a fallback and reads only MCP variables',
    (_, block) => {
      expect(block.length).toBe(30);
      block.forEach(({ name, value }) => {
        expect(value, name).not.toMatch(/var\(--[a-z0-9-]+\)/);
        sourcesOf(value).forEach((source) =>
          expect(MCP_KEYS, `${name} → ${source}`).toContain(source),
        );
      });
    },
  );

  it('light and dark blocks set the same ui-kit variables', () => {
    expect(namesOf(lightBlock)).toEqual(namesOf(darkBlock));
  });

  it('repeats the dark block for prefers-color-scheme: dark', () => {
    expect(preferredDarkBlock).toEqual(darkBlock);
  });

  it("light literals are ui-kit's own fallbacks", () => {
    lightBlock.forEach(({ name }) => {
      const fallback = fallbackOf(lightBlock, name);
      if (!fallback?.startsWith('#')) return;
      expect(uiKitFallbacks(name), name).toContain(fallback);
    });
  });

  it('no longer sets the 1.0-only variables', () => {
    const removed = [
      '--bg-layer-0',
      '--bg-layer-1',
      '--bg-layer-2',
      '--bg-layer-3',
      '--bg-layer-4',
      '--controls-text-neutral',
      '--controls-bg-neutral-hover',
      '--controls-bg-neutral-active',
      '--controls-bg-disable',
      '--controls-text-primary-disable',
      '--controls-bg-accent-primary',
      '--stroke-default',
      '--stroke-focus',
      '--text-accent-primary',
      '--bg-accent-primary-alpha',
      '--stroke-accent-primary',
    ];
    [lightBlock, darkBlock, derivedBlock].forEach((block) =>
      removed.forEach((name) => expect(namesOf(block)).not.toContain(name)),
    );
  });
});

describe('round trip with DIAL (D18)', () => {
  /** DIAL variable → MCP keys DIAL derives from it (many-to-one allowed). */
  const dialSources = new Map<string, Set<string>>();
  declarationsOf(
    parseRules(dialCss).find((rule) => rule.selector === ':root')!.body,
  )
    .filter(({ name }) => MCP_KEYS.has(name))
    .forEach(({ name, value }) => {
      const outermost = value.match(/^var\((--[a-z0-9-]+)/)?.[1];
      if (!outermost) return;
      dialSources.set(
        outermost,
        (dialSources.get(outermost) ?? new Set()).add(name),
      );
    });

  it('parses DIAL variables from the fixture', () => {
    expect(dialSources.size).toBe(29);
    expect(dialSources.get('--text-tertiary')).toEqual(
      new Set(['--color-text-tertiary', '--color-text-ghost']),
    );
  });

  it.each([...dialSources.keys()])(
    'maps %s back from an MCP key DIAL derives from it',
    (dialVariable) => {
      [lightBlock, darkBlock].forEach((block) => {
        const value = valueOf(block, dialVariable);
        expect(value, dialVariable).toBeDefined();
        expect(dialSources.get(dialVariable)).toContain(sourcesOf(value!)[0]);
      });
    },
  );
});

describe('theme-independent derivations (html block)', () => {
  it('derives radii with ui-kit shapes as fallbacks', () => {
    expect(valueOf(derivedBlock, '--radius-control')).toBe(
      'var(--button-radius, var(--border-radius-md, 9999px))',
    );
    expect(valueOf(derivedBlock, '--radius-control-small')).toBe(
      'var(--button-radius-small, var(--border-radius-sm, 9999px))',
    );
    expect(valueOf(derivedBlock, '--mcp-card-radius')).toBe(
      'var(--border-radius-xl, 20px)',
    );
  });

  it('paints the primary button from styleExtensions, solid inverse when absent', () => {
    expect(valueOf(derivedBlock, '--bg-gradient-1')).toBe(
      'var(--button-primary-gradient-start, var(--color-background-inverse))',
    );
    expect(valueOf(derivedBlock, '--bg-gradient-2')).toBe(
      'var(--button-primary-gradient-end, var(--color-background-inverse))',
    );
    [
      ['-1', 'start'],
      ['-2', 'end'],
    ].forEach(([stop, side]) => {
      expect(valueOf(derivedBlock, `--bg-gradient${stop}-hover`)).toBe(
        `var(--button-primary-gradient-hover-${side}, color-mix(in srgb, var(--color-background-inverse) 88%, var(--color-text-inverse, #fff)))`,
      );
      expect(valueOf(derivedBlock, `--bg-gradient${stop}-active`)).toBe(
        `var(--button-primary-gradient-active-${side}, color-mix(in srgb, var(--color-background-inverse) 80%, var(--color-text-inverse, #fff)))`,
      );
    });
  });

  it('derives the primary glow from the text colour', () => {
    expect(valueOf(derivedBlock, '--shadow-xs-1')).toBe(
      'color-mix(in srgb, var(--color-text-primary) 10%, transparent)',
    );
    expect(valueOf(derivedBlock, '--shadow-xs-2')).toBe(
      'color-mix(in srgb, var(--color-text-primary) 4%, transparent)',
    );
    expect(valueOf(derivedBlock, '--shadow-md')).toBe(
      'color-mix(in srgb, var(--color-text-primary) 4%, transparent)',
    );
  });

  it('reads only MCP and styleExtensions variables', () => {
    derivedBlock.forEach(({ name, value }) =>
      sourcesOf(value).forEach((source) =>
        expect(DERIVED_SOURCE_KEYS, `${name} → ${source}`).toContain(source),
      ),
    );
  });
});

describe('component-scoped derivations', () => {
  /** Variables ui-kit also reads outside the neutral button, e.g. the Avatar palette. */
  const SCOPED = [
    '--text-accent',
    '--bg-control-accent-alpha',
    '--bg-control-accent-alpha-hover',
    '--bg-control-accent-alpha-active',
    '--stroke-accent-alpha',
  ];

  it('maps nearest slots without fallbacks, so ui-kit defaults apply without host tokens', () => {
    expect(valueOf(neutralButtonBlock, '--bg-control-accent-alpha')).toBe(
      'var(--color-background-tertiary)',
    );
    expect(valueOf(neutralButtonBlock, '--bg-control-accent-alpha-hover')).toBe(
      'color-mix(in srgb, var(--color-background-tertiary) 92%, var(--color-text-primary, #000))',
    );
    expect(
      valueOf(neutralButtonBlock, '--bg-control-accent-alpha-active'),
    ).toBe(
      'color-mix(in srgb, var(--color-background-tertiary) 84%, var(--color-text-primary, #000))',
    );
    expect(valueOf(neutralButtonBlock, '--stroke-accent-alpha')).toBe(
      'var(--color-border-secondary)',
    );
    expect(valueOf(neutralButtonBlock, '--text-accent')).toBe(
      'var(--color-text-primary)',
    );
  });

  it('scopes the primary label colour to the primary button, from styleExtensions', () => {
    expect(valueOf(primaryButtonBlock, '--text-control-permanent')).toBe(
      'var(--button-primary-text, var(--color-text-inverse, #fcfcfc))',
    );
    [lightBlock, darkBlock, preferredDarkBlock].forEach((block) =>
      expect(
        valueOf(block, '--text-control-permanent'),
        'theme blocks keep the plain inverse mapping',
      ).toBe('var(--color-text-inverse, #fcfcfc)'),
    );
  });

  it('maps no Accordion-wide hover (the app removes the header hover)', () => {
    expect(
      parseRules(hostTokensCss).some((rule) =>
        rule.selector.includes('.dial-kit-accordion'),
      ),
    ).toBe(false);
  });

  it('never declares the scoped variables on :root or html', () => {
    [lightBlock, darkBlock, preferredDarkBlock, derivedBlock].forEach((block) =>
      SCOPED.forEach((name) => expect(namesOf(block)).not.toContain(name)),
    );
  });

  it('reads only MCP variables', () => {
    [neutralButtonBlock].forEach((block) =>
      block.forEach(({ name, value }) =>
        sourcesOf(value).forEach((source) =>
          expect(MCP_KEYS, `${name} → ${source}`).toContain(source),
        ),
      ),
    );
  });
});

describe('badge tone classes', () => {
  it.each([
    ['success', '--bg-visual-green-2', '--text-visual-green-1'],
    ['warning', '--bg-visual-brown', '--text-visual-brown-2'],
    ['danger', '--bg-visual-red', '--text-visual-red'],
  ] as const)(
    '%s re-points its badge colours at the host tone',
    (tone, bg, text) => {
      expect(toneBlocks[tone]).toEqual([
        { name: bg, value: `var(--color-background-${tone})` },
        { name: text, value: `var(--color-text-${tone})` },
      ]);
    },
  );

  it('never remaps the visual palette globally (the Avatar shares it)', () => {
    [lightBlock, darkBlock, derivedBlock].forEach((block) =>
      namesOf(block).forEach((name) =>
        expect(name).not.toMatch(/^--(bg|text)-visual-/),
      ),
    );
  });
});

describe('ui-kit coverage guard', () => {
  /** ui-kit selectors the rendered 2.0 components rely on. */
  const GUARDED_SELECTORS = [
    '.dial-kit-primary-solid-button',
    '.dial-kit-neutral-solid-button',
    '.dial-kit-base-button',
    '.bg-layer-raised',
    '.bg-layer-sunken',
    '.bg-error',
    '.bg-warning',
    '.bg-info',
    '.bg-success',
    '.text-primary',
    '.text-secondary',
    '.text-error',
    '.text-warning',
    '.text-info',
    '.text-success',
    '.border-secondary',
    '.border-tertiary',
    '.bg-green-2',
    '.text-green-1',
    '.bg-brown',
    '.text-brown-2',
    '.bg-red',
    '.text-red',
    '.bg-blue',
    '.text-accent',
    '.bg-green-1',
    '.text-green-2',
    '.text-green-3',
    '.bg-violet-1',
    '.bg-violet-2',
    '.text-violet-1',
    '.text-violet-2',
    '.hover\\:bg-control-accent-alpha-hover',
    '.focus-visible\\:outline-focus',
  ];

  /** Read by ui-kit but intentionally left to it: shadowed or wrapped by a variable we set. */
  const isShadowedByOurs = (name: string) =>
    name === '--stroke-focus' ||
    name.startsWith('--bg-control-accent-gradient-') ||
    name.startsWith('--tw-');

  /** The Avatar palette: kept at ui-kit values so initials stay legible on every host. */
  const isAvatarPalette = (name: string) =>
    name === '--text-accent' || /^--(bg|text)-visual-/.test(name);

  const isUiKitDefault = (name: string) =>
    isShadowedByOurs(name) || isAvatarPalette(name);

  const setByUs = new Set([
    ...namesOf(lightBlock),
    ...namesOf(derivedBlock),
    ...namesOf(neutralButtonBlock),
    ...Object.values(toneBlocks).flatMap(namesOf),
  ]);

  const readVars = (selector: string) =>
    new Set(
      parseRules(uiKitCss)
        .filter((rule) =>
          rule.selector.split(',').some((part) => {
            const trimmed = part.trim();
            return trimmed === selector || trimmed.startsWith(`${selector}:`);
          }),
        )
        .flatMap((rule) => sourcesOf(rule.body)),
    );

  it('Avatar palette variables are left to ui-kit (never set on :root/html)', () => {
    const avatarVars = [
      '.bg-blue',
      '.text-accent',
      '.bg-green-1',
      '.text-green-2',
      '.text-green-3',
      '.bg-violet-1',
      '.bg-violet-2',
      '.text-violet-1',
      '.text-violet-2',
    ].flatMap((selector) => [...readVars(selector)]);
    expect(avatarVars.length).toBeGreaterThan(0);
    avatarVars.forEach((name) => {
      expect(isAvatarPalette(name), name).toBe(true);
      [lightBlock, darkBlock, preferredDarkBlock, derivedBlock].forEach(
        (block) => expect(namesOf(block), name).not.toContain(name),
      );
    });
  });

  it.each(GUARDED_SELECTORS)(
    'host-tokens.css covers every variable %s reads',
    (selector) => {
      const read = [...readVars(selector)];
      expect(read.length).toBeGreaterThan(0);
      read
        .filter((name) => !isUiKitDefault(name))
        .forEach((name) =>
          expect(setByUs, `${selector} reads ${name}`).toContain(name),
        );
    },
  );
});

describe('layout.css', () => {
  it('body colour falls back to the light text colour', () => {
    expect(layoutCss).toMatch(
      new RegExp(
        `color:\\s*var\\(--text-primary,\\s*${fallbackOf(lightBlock, '--text-primary')}\\)`,
      ),
    );
  });
});

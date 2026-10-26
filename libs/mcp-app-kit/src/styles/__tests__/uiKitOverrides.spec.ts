// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Declarations = Record<string, string>;

const TYPE_PROPS = ['font-size', 'line-height', 'font-weight'];

/**
 * Collects the declarations of every `.dial-*-text` class, splitting grouped
 * selectors and merging classes declared across several rules (as ui-kit's
 * dist does).
 * @param css - stylesheet source
 */
const textClasses = (css: string): Map<string, Declarations> => {
  const merged = new Map<string, Declarations>();
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selectorList, body] of source.matchAll(
    /([^{}]+)\{([^}]*)\}/g,
  )) {
    const selectors = selectorList!
      .split(',')
      .map((selector) => selector.trim())
      .filter((selector) => /^\.dial-[a-z0-9-]+-text$/.test(selector));
    for (const selector of selectors) {
      const declarations = merged.get(selector) ?? {};
      for (const [, name, value] of body!.matchAll(/([a-z-]+)\s*:\s*([^;]+)/g))
        declarations[name!] = value!.trim();
      merged.set(selector, declarations);
    }
  }
  return merged;
};

const overrides = textClasses(
  readFileSync(
    fileURLToPath(new URL('../ui-kit-overrides.css', import.meta.url)),
    'utf8',
  ),
);
const uiKit = textClasses(
  readFileSync(
    createRequire(import.meta.url).resolve('@epam/ai-dial-ui-kit/styles.css'),
    'utf8',
  ),
);

const fallbackOf = (value: string) =>
  value.match(/^var\(--[a-z0-9-]+,\s*([^()]+)\)$/)?.[1]?.trim();

describe('ui-kit-overrides.css', () => {
  it('covers every ui-kit text class that sets a size or weight', () => {
    const typed = [...uiKit]
      .filter(([, declarations]) =>
        TYPE_PROPS.some((prop) => prop in declarations),
      )
      .map(([selector]) => selector);
    expect(typed.length).toBeGreaterThan(15);
    typed.forEach((selector) =>
      expect([...overrides.keys()], selector).toContain(selector),
    );
  });

  it('only overrides properties ui-kit sets, with ui-kit literals as fallbacks', () => {
    overrides.forEach((declarations, selector) => {
      const original = uiKit.get(selector);
      expect(original, selector).toBeDefined();
      Object.entries(declarations).forEach(([prop, value]) => {
        expect(TYPE_PROPS, `${selector} ${prop}`).toContain(prop);
        expect(fallbackOf(value), `${selector} ${prop}`).toBe(original![prop]);
      });
    });
  });

  it('reads only MCP typography tokens', () => {
    overrides.forEach((declarations, selector) =>
      Object.values(declarations).forEach((value) =>
        expect(value, selector).toMatch(
          /^var\(--font-(weight-(normal|semibold)|(text|heading)-[a-z0-9]+-(size|line-height)),/,
        ),
      ),
    );
  });

  it('paints the primary button gradient under its transparent border', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../ui-kit-overrides.css', import.meta.url)),
      'utf8',
    );
    const rule = css.match(/\.dial-kit-primary-solid-button\s*\{([^}]*)\}/);
    expect(rule, 'primary button rule').not.toBeNull();
    expect(rule![1]).toMatch(/background-origin:\s*border-box/);
  });
});

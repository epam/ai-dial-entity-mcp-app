import {
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import { detectHostKind } from './host/hostKind';
import { resolveSafeArea } from './host/safeArea';

const FONT_STYLE_ATTR = 'data-mcp-host-fonts';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const setFontCss = (css: string): (() => void) => {
  const style = document.createElement('style');
  style.setAttribute(FONT_STYLE_ATTR, '');
  style.textContent = css;
  document.head.appendChild(style);
  return () => style.remove();
};

/**
 * Applies a host context to the document: theme, host CSS variables, host
 * font CSS, display-mode / platform data attributes, container size and
 * safe-area CSS variables. Call the returned function before applying the
 * next context so stale values never linger.
 * @param context - host context from `ui/initialize` or a context-changed notification
 * @param root - element to write to (defaults to `<html>`)
 */
export const applyHostContext = (
  context: McpUiHostContext,
  root: HTMLElement = document.documentElement,
): (() => void) => {
  const cleanups: Array<() => void> = [];
  const setVar = (name: string, value: string) => {
    root.style.setProperty(name, value);
    cleanups.push(() => root.style.removeProperty(name));
  };
  const setData = (key: string, value: string | undefined) => {
    if (!value) return;
    root.dataset[key] = value;
    cleanups.push(() => delete root.dataset[key]);
  };

  if (context.theme) {
    root.setAttribute('data-theme', context.theme);
    root.style.colorScheme = context.theme;
    cleanups.push(() => {
      root.removeAttribute('data-theme');
      root.style.removeProperty('color-scheme');
    });
  }

  const variables = context.styles?.variables;
  if (variables) {
    applyHostStyleVariables(variables, root);
    cleanups.push(() =>
      Object.keys(variables).forEach((name) => root.style.removeProperty(name)),
    );
  }

  const fontCss = context.styles?.css?.fonts;
  if (fontCss) cleanups.push(setFontCss(fontCss));

  setData('displayMode', context.displayMode);
  setData('platform', context.platform);

  const dims = context.containerDimensions;
  const width = dims && 'width' in dims ? dims.width : undefined;
  const height = dims && 'height' in dims ? dims.height : undefined;
  if (typeof width === 'number') setVar('--mcp-container-width', `${width}px`);
  if (typeof height === 'number')
    setVar('--mcp-container-height', `${height}px`);

  const safeArea = resolveSafeArea(context, detectHostKind());
  SIDES.forEach((side) =>
    setVar(`--mcp-safe-area-${side}`, `${safeArea[side]}px`),
  );

  return () =>
    cleanups
      .splice(0)
      .reverse()
      .forEach((cleanup) => cleanup());
};

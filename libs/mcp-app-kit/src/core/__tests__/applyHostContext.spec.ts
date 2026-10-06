import type { McpUiStyles } from '@modelcontextprotocol/ext-apps';
import { afterEach, describe, expect, it } from 'vitest';
import { applyHostContext } from '../applyHostContext';

const root = document.documentElement;

describe('applyHostContext', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('applies theme, style variables and layout attributes', () => {
    cleanup = applyHostContext({
      theme: 'dark',
      displayMode: 'inline',
      platform: 'desktop',
      containerDimensions: { width: 640, maxHeight: 800 },
      styles: { variables: { '--color-text-primary': '#fff' } as McpUiStyles },
    });
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.style.getPropertyValue('--color-text-primary')).toBe('#fff');
    expect(root.dataset.displayMode).toBe('inline');
    expect(root.dataset.platform).toBe('desktop');
    expect(root.style.getPropertyValue('--mcp-container-width')).toBe('640px');
    expect(root.style.getPropertyValue('--mcp-safe-area-top')).toBe('12px');
  });

  it('applies container height and safe-area insets and cleans them up', () => {
    const undo = applyHostContext({
      containerDimensions: { height: 480, maxWidth: 900 },
      safeAreaInsets: { top: 12, right: 4, bottom: 20, left: 0 },
    });
    expect(root.style.getPropertyValue('--mcp-container-height')).toBe('480px');
    expect(root.style.getPropertyValue('--mcp-safe-area-top')).toBe('12px');
    expect(root.style.getPropertyValue('--mcp-safe-area-right')).toBe('4px');
    expect(root.style.getPropertyValue('--mcp-safe-area-bottom')).toBe('20px');
    expect(root.style.getPropertyValue('--mcp-safe-area-left')).toBe('0px');

    undo();
    [
      '--mcp-container-height',
      '--mcp-safe-area-top',
      '--mcp-safe-area-right',
      '--mcp-safe-area-bottom',
      '--mcp-safe-area-left',
    ].forEach((name) => expect(root.style.getPropertyValue(name)).toBe(''));
  });

  it('does not apply host shadow variables, which ui-kit reads as colours', () => {
    root.style.setProperty('--shadow-sm', '#123456');
    cleanup = applyHostContext({
      styles: {
        variables: {
          '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.1)',
          '--color-text-primary': '#fff',
        } as McpUiStyles,
      },
    });
    expect(root.style.getPropertyValue('--shadow-sm')).toBe('#123456');
    expect(root.style.getPropertyValue('--color-text-primary')).toBe('#fff');

    cleanup();
    cleanup = undefined;
    expect(root.style.getPropertyValue('--shadow-sm')).toBe('#123456');
    expect(root.style.getPropertyValue('--color-text-primary')).toBe('');
    root.style.removeProperty('--shadow-sm');
  });

  it('injects host font css into a single managed style element', () => {
    cleanup = applyHostContext({ styles: { css: { fonts: '@font-face{}' } } });
    const styles = document.head.querySelectorAll('style[data-mcp-host-fonts]');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toBe('@font-face{}');
  });

  it('cleanup removes everything it applied', () => {
    applyHostContext({
      theme: 'light',
      displayMode: 'inline',
      styles: {
        variables: { '--color-text-primary': '#000' } as McpUiStyles,
        css: { fonts: '@font-face{}' },
      },
    })();
    expect(root.style.getPropertyValue('--color-text-primary')).toBe('');
    expect(root.dataset.displayMode).toBeUndefined();
    expect(root.style.getPropertyValue('--mcp-safe-area-top')).toBe('');
    expect(
      document.head.querySelector('style[data-mcp-host-fonts]'),
    ).toBeNull();
    expect(root.getAttribute('data-theme')).toBeNull();
  });

  it('writes the theme to a custom root only and cleans it from there', () => {
    const div = document.createElement('div');
    const cleanupDiv = applyHostContext({ theme: 'dark' }, div);
    expect(div.getAttribute('data-theme')).toBe('dark');
    expect(div.style.colorScheme).toBe('dark');
    expect(root.getAttribute('data-theme')).toBeNull();

    cleanupDiv();
    expect(div.getAttribute('data-theme')).toBeNull();
    expect(div.style.colorScheme).toBe('');
  });

  it('cleanup is safe to call twice', () => {
    const cleanupA = applyHostContext({
      theme: 'light',
      displayMode: 'inline',
    });
    cleanupA();
    cleanup = applyHostContext({ theme: 'dark', displayMode: 'inline' });
    cleanupA();
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.style.getPropertyValue('--mcp-safe-area-top')).toBe('12px');
  });
});

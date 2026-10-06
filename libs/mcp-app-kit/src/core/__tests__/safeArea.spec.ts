import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { describe, expect, it } from 'vitest';
import { resolveSafeArea } from '../host/safeArea';

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
const DESKTOP_FALLBACK = { top: 12, right: 12, bottom: 12, left: 12 };
const MOBILE_FALLBACK = { top: 8, right: 8, bottom: 8, left: 8 };

describe('resolveSafeArea', () => {
  it('uses host insets when provided', () => {
    const insets = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(resolveSafeArea({ safeAreaInsets: insets })).toEqual(insets);
  });

  it('respects all-zero host insets in inline mode', () => {
    expect(
      resolveSafeArea({ displayMode: 'inline', safeAreaInsets: ZERO }),
    ).toEqual(ZERO);
  });

  it('fills sides the host left out with 0', () => {
    const insets = { top: 6 } as McpUiHostContext['safeAreaInsets'];
    expect(
      resolveSafeArea({ displayMode: 'inline', safeAreaInsets: insets }),
    ).toEqual({ top: 6, right: 0, bottom: 0, left: 0 });
  });

  it.each<[string, McpUiHostContext, typeof ZERO]>([
    [
      'inline desktop',
      { displayMode: 'inline', platform: 'desktop' },
      DESKTOP_FALLBACK,
    ],
    ['no display mode', {}, DESKTOP_FALLBACK],
    [
      'inline mobile',
      { displayMode: 'inline', platform: 'mobile' },
      MOBILE_FALLBACK,
    ],
    [
      'empty insets',
      {
        displayMode: 'inline',
        safeAreaInsets: {} as McpUiHostContext['safeAreaInsets'],
      },
      DESKTOP_FALLBACK,
    ],
  ])(
    'pads with the inline fallback when the host sends no insets (%s)',
    (_, context, expected) => {
      expect(resolveSafeArea(context)).toEqual(expected);
    },
  );

  it.each<McpUiHostContext>([
    { displayMode: 'fullscreen' },
    { displayMode: 'pip', platform: 'mobile' },
  ])('pads nothing outside inline mode without insets (%o)', (context) => {
    expect(resolveSafeArea(context)).toEqual(ZERO);
  });
});

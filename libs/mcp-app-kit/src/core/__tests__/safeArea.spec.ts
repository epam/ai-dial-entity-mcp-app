import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { describe, expect, it } from 'vitest';
import { resolveSafeArea } from '../host/safeArea';

describe('resolveSafeArea', () => {
  it('uses host insets when provided', () => {
    const insets = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(resolveSafeArea({ safeAreaInsets: insets })).toEqual(insets);
  });

  it.each<McpUiHostContext>([
    { displayMode: 'inline', platform: 'desktop' },
    { displayMode: 'inline', platform: 'mobile' },
    { displayMode: 'fullscreen' },
  ])('pads nothing when the host sends no insets (%o)', (context) => {
    expect(resolveSafeArea(context)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

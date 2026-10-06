import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';

export type SafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const ZERO: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
const INLINE_DESKTOP_FALLBACK: SafeArea = {
  top: 12,
  right: 12,
  bottom: 12,
  left: 12,
};
const INLINE_MOBILE_FALLBACK: SafeArea = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};

/**
 * Resolves the padding the app keeps clear. Host insets always win, even
 * all zeros; a side the host left out is 0. Only when the host sends no
 * insets at all (missing, or no side set) does inline mode fall back to a
 * small padding so content stays off the frame; other modes get none.
 * @param context - current host context
 */
export const resolveSafeArea = (context: McpUiHostContext): SafeArea => {
  const insets: Partial<SafeArea> = context.safeAreaInsets ?? {};
  const hasInsets = SIDES.some((side) => typeof insets[side] === 'number');
  if (hasInsets) {
    return {
      top: insets.top ?? 0,
      right: insets.right ?? 0,
      bottom: insets.bottom ?? 0,
      left: insets.left ?? 0,
    };
  }
  if ((context.displayMode ?? 'inline') !== 'inline') return ZERO;
  return context.platform === 'mobile'
    ? INLINE_MOBILE_FALLBACK
    : INLINE_DESKTOP_FALLBACK;
};

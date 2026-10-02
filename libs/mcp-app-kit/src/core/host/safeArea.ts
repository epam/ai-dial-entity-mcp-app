import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { HostKind } from './hostKind';

export type SafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

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
 * Resolves the padding the app keeps clear. Host insets win when sent.
 * Claude and AI DIAL render inline apps edge-to-edge without sending insets,
 * so a small inline fallback keeps content off the frame; ChatGPT pads its
 * own widget frame, so it gets none.
 * @param context - current host context
 * @param hostKind - detected host family
 */
export const resolveSafeArea = (
  context: McpUiHostContext,
  hostKind: HostKind,
): SafeArea => {
  if (context.safeAreaInsets) return context.safeAreaInsets;
  const isInline = (context.displayMode ?? 'inline') === 'inline';
  if (hostKind === HostKind.ChatGpt || !isInline) return ZERO;
  return context.platform === 'mobile'
    ? INLINE_MOBILE_FALLBACK
    : INLINE_DESKTOP_FALLBACK;
};

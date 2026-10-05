import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';

export type SafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const ZERO: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Resolves the padding the app keeps clear: the host's insets when it sends
 * them, otherwise none. Hosts own their frame padding.
 * @param context - current host context
 */
export const resolveSafeArea = (context: McpUiHostContext): SafeArea =>
  context.safeAreaInsets ?? ZERO;

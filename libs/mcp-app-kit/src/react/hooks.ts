import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  getStructuredContent,
  getToolError,
  type ParseResult,
} from '../core/payload';
import {
  type McpAppSnapshot,
  type McpAppStore,
  McpAppPhase,
} from '../core/types';
import { McpAppContext } from './McpAppProvider';

export enum ToolResultStatus {
  Loading = 'loading',
  Ready = 'ready',
  Invalid = 'invalid',
  Error = 'error',
}

export type ToolResultState<T> =
  | { status: ToolResultStatus.Loading }
  | { status: ToolResultStatus.Ready; data: T }
  | { status: ToolResultStatus.Invalid; error: string }
  | { status: ToolResultStatus.Error; error?: string };

const useStore = (): McpAppStore => {
  const store = useContext(McpAppContext);
  if (!store)
    throw new Error('MCP App hooks must be used inside <McpAppProvider>');
  return store;
};

/** Returns the current MCP App snapshot and re-renders on every change. */
export const useMcpApp = (): McpAppSnapshot => {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
};

/** Returns the latest merged host context, if the handshake has completed. */
export const useHostContext = (): McpUiHostContext | undefined =>
  useMcpApp().hostContext;

/** Returns a function that asks the host to open a URL; it rejects if the host refuses. */
export const useOpenLink = (): ((url: string) => Promise<void>) => {
  const store = useStore();
  return useCallback((url: string) => store.openLink(url), [store]);
};

/**
 * Derives a typed view state from the tool result.
 * @param parse - validates the structured content; must be referentially stable
 */
export const useToolResult = <T>(
  parse: (raw: unknown) => ParseResult<T>,
): ToolResultState<T> => {
  const { phase, toolResult, error } = useMcpApp();
  return useMemo((): ToolResultState<T> => {
    if (phase === McpAppPhase.Error)
      return { status: ToolResultStatus.Error, error };
    if (phase !== McpAppPhase.Ready || toolResult === undefined) {
      return { status: ToolResultStatus.Loading };
    }
    const toolError = getToolError(toolResult);
    if (toolError !== undefined)
      return { status: ToolResultStatus.Error, error: toolError };
    const parsed = parse(getStructuredContent(toolResult));
    return parsed.ok
      ? { status: ToolResultStatus.Ready, data: parsed.data }
      : { status: ToolResultStatus.Invalid, error: parsed.reason };
  }, [phase, toolResult, error, parse]);
};

import {
  createContext,
  type FC,
  type ReactNode,
  useEffect,
  useSyncExternalStore,
} from 'react';
import { applyHostContext } from '../core/applyHostContext';
import { startInlineHeightSync } from '../core/host/inlineHeightSync';
import type { McpAppStore } from '../core/types';

export const McpAppContext = createContext<McpAppStore | null>(null);

type McpAppProviderProps = { app: McpAppStore; children: ReactNode };

/**
 * Provides the MCP App store to hooks, applies the host context to the
 * document on every change, and keeps `<html>` height in sync while inline.
 * @param props.app - store from `createMcpApp`
 */
export const McpAppProvider: FC<McpAppProviderProps> = ({ app, children }) => {
  const hostContext = useSyncExternalStore(
    app.subscribe,
    () => app.getSnapshot().hostContext,
  );
  const isInline = (hostContext?.displayMode ?? 'inline') === 'inline';

  useEffect(
    () => (hostContext ? applyHostContext(hostContext) : undefined),
    [hostContext],
  );
  useEffect(() => (isInline ? startInlineHeightSync() : undefined), [isInline]);

  return (
    <McpAppContext.Provider value={app}>{children}</McpAppContext.Provider>
  );
};

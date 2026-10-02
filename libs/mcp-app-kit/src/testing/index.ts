import {
  type McpAppSnapshot,
  type McpAppStore,
  McpAppError,
  McpAppPhase,
} from '../core/types';

export type FakeMcpApp = McpAppStore & {
  setSnapshot: (next: Partial<McpAppSnapshot>) => void;
  openedLinks: string[];
  failOpenLink: (times?: number) => void;
};

/**
 * In-memory `McpAppStore` for tests of apps built on the kit. No transport,
 * no host: drive it with `setSnapshot` and inspect `openedLinks`.
 * @param initial - snapshot fields to start with (phase defaults to `ready`)
 */
export const createFakeMcpApp = (
  initial: Partial<McpAppSnapshot> = {},
): FakeMcpApp => {
  const listeners = new Set<() => void>();
  let snapshot: McpAppSnapshot = { phase: McpAppPhase.Ready, ...initial };
  let failuresLeft = 0;
  const openedLinks: string[] = [];

  return {
    openedLinks,
    start: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    setSnapshot: (next) => {
      snapshot = { ...snapshot, ...next };
      listeners.forEach((listener) => listener());
    },
    failOpenLink: (times = 1) => {
      failuresLeft = times;
    },
    openLink: async (url) => {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new McpAppError('Host refused to open the link');
      }
      openedLinks.push(url);
    },
    callTool: async () => undefined,
    requestDisplayMode: async (mode) => mode,
    sendMessage: async () => undefined,
  };
};

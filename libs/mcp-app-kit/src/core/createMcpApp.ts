import { App } from '@modelcontextprotocol/ext-apps';
import {
  type CreateMcpAppOptions,
  type McpAppSnapshot,
  type McpAppStore,
  McpAppError,
  McpAppPhase,
} from './types';

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Creates the app-side MCP Apps store: wraps the ext-apps `App`, tracks the
 * handshake / tool lifecycle as an immutable snapshot for
 * `useSyncExternalStore`, and exposes host actions.
 * @param options - app identity, supported display modes (default `['inline']`)
 *   and an optional transport (default: postMessage to `window.parent`)
 */
export const createMcpApp = ({
  name,
  version,
  availableDisplayModes = ['inline'],
  transport,
}: CreateMcpAppOptions): McpAppStore => {
  const listeners = new Set<() => void>();
  let snapshot: McpAppSnapshot = { phase: McpAppPhase.Connecting };
  let sdkApp: App | undefined;
  let connected: Promise<void> | undefined;

  const patch = (next: Partial<McpAppSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const requireApp = async (): Promise<App> => {
    if (!sdkApp) throw new McpAppError('MCP app is not started');
    await connected;
    return sdkApp;
  };

  /**
   * Runs a host request on the connected app and rethrows any host or
   * transport failure as `McpAppError`.
   * @param request - the SDK call to make
   */
  const hostRequest = async <T>(request: (app: App) => Promise<T>) => {
    const app = await requireApp();
    try {
      return await request(app);
    } catch (error) {
      throw new McpAppError(toMessage(error));
    }
  };

  const start = () => {
    if (sdkApp) return;
    const app = new App(
      { name, version },
      { availableDisplayModes },
      { autoResize: true },
    );
    sdkApp = app;

    app.ontoolinput = (params) => {
      patch({
        phase: McpAppPhase.ToolPending,
        toolInput: params.arguments,
        toolResult: undefined,
        error: undefined,
      });
    };
    app.ontoolresult = (params) => {
      patch({ phase: McpAppPhase.Ready, toolResult: params, error: undefined });
    };
    app.ontoolcancelled = (params) => {
      const suffix = params.reason ? `: ${params.reason}` : '';
      patch({ phase: McpAppPhase.Error, error: `Tool cancelled${suffix}` });
    };
    app.onhostcontextchanged = (context) => {
      patch({ hostContext: { ...snapshot.hostContext, ...context } });
    };
    app.onerror = (error) => {
      if (snapshot.phase === McpAppPhase.Connecting) {
        patch({ phase: McpAppPhase.Error, error: toMessage(error) });
        return;
      }
      console.warn('[mcp-app-kit] non-fatal host error:', toMessage(error));
    };
    app.onteardown = () => {
      patch({ phase: McpAppPhase.TornDown });
      return {};
    };

    connected = app
      .connect(transport)
      .then(() => {
        const phase =
          snapshot.phase === McpAppPhase.Connecting
            ? McpAppPhase.ToolPending
            : snapshot.phase;
        patch({
          phase,
          hostContext: { ...app.getHostContext(), ...snapshot.hostContext },
        });
      })
      .catch((error: unknown) => {
        patch({ phase: McpAppPhase.Error, error: toMessage(error) });
      });
  };

  return {
    start,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    openLink: async (url) => {
      const result = await hostRequest((app) => app.openLink({ url }));
      if (result.isError)
        throw new McpAppError('Host refused to open the link');
    },
    callTool: (toolName, args) =>
      hostRequest((app) =>
        app.callServerTool({ name: toolName, arguments: args }),
      ),
    requestDisplayMode: async (mode) => {
      const result = await hostRequest((app) =>
        app.requestDisplayMode({ mode }),
      );
      return result.mode;
    },
    sendMessage: async (text) => {
      await hostRequest((app) =>
        app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text }],
        }),
      );
    },
  };
};

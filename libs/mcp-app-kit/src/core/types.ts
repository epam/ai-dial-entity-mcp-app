import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export enum McpAppPhase {
  Connecting = 'connecting',
  ToolPending = 'tool-pending',
  Ready = 'ready',
  Error = 'error',
  TornDown = 'torndown',
}

export type McpDisplayMode = NonNullable<McpUiHostContext['displayMode']>;

export type McpAppSnapshot = {
  phase: McpAppPhase;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  hostContext?: McpUiHostContext;
  error?: string;
};

export type CreateMcpAppOptions = {
  name: string;
  version: string;
  availableDisplayModes?: McpDisplayMode[];
  transport?: Transport;
};

export type McpAppStore = {
  start: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => McpAppSnapshot;
  openLink: (url: string) => Promise<void>;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  requestDisplayMode: (mode: McpDisplayMode) => Promise<McpDisplayMode>;
  sendMessage: (text: string) => Promise<void>;
};

/** Error raised by kit actions when the host is unavailable or refuses a request. */
export class McpAppError extends Error {
  override name = 'McpAppError';
}

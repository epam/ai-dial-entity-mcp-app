import {
  AppBridge,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { describe, expect, it, vi } from 'vitest';
import { createMcpApp } from '../createMcpApp';
import { McpAppError, McpAppPhase, type McpAppStore } from '../types';

const setup = async (hostContext: McpUiHostContext = { theme: 'dark' }) => {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(
    null,
    { name: 'test-host', version: '0.0.0' },
    { openLinks: {} },
    { hostContext },
  );
  const onInitialized = vi.fn();
  const initialized = new Promise<void>((resolve) => {
    bridge.addEventListener('initialized', () => {
      onInitialized();
      resolve();
    });
  });
  await bridge.connect(hostTransport);
  const store = createMcpApp({
    name: 'test-app',
    version: '1.0.0',
    transport: appTransport,
  });
  return { store, bridge, appTransport, initialized, onInitialized };
};

const waitForPhase = (
  store: { getSnapshot: () => { phase: McpAppPhase } },
  phase: McpAppPhase,
) => vi.waitFor(() => expect(store.getSnapshot().phase).toBe(phase));

describe('createMcpApp', () => {
  it('starts in connecting and declares inline display mode by default', async () => {
    const { store, bridge, initialized } = await setup();
    store.start();
    expect(store.getSnapshot().phase).toBe(McpAppPhase.Connecting);
    await initialized;
    expect(bridge.getAppCapabilities()?.availableDisplayModes).toEqual([
      'inline',
    ]);
  });

  it('moves to tool-pending after the handshake and stores host context', async () => {
    const { store } = await setup({ theme: 'dark', platform: 'web' });
    store.start();
    await waitForPhase(store, McpAppPhase.ToolPending);
    expect(store.getSnapshot().hostContext).toMatchObject({
      theme: 'dark',
      platform: 'web',
    });
  });

  it('becomes ready on tool result and notifies subscribers', async () => {
    const { store, bridge, initialized } = await setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.start();
    await initialized;
    await bridge.sendToolResult({ content: [], structuredContent: { a: 1 } });
    await waitForPhase(store, McpAppPhase.Ready);
    expect(store.getSnapshot().toolResult).toMatchObject({
      structuredContent: { a: 1 },
    });
    expect(listener).toHaveBeenCalled();
  });

  it('goes to error with the first text block when the tool result is an error', async () => {
    const { store, bridge, initialized } = await setup();
    store.start();
    await initialized;
    const result = {
      isError: true,
      content: [{ type: 'text' as const, text: 'skill not found' }],
    };
    await bridge.sendToolResult(result);
    await waitForPhase(store, McpAppPhase.Error);
    expect(store.getSnapshot()).toMatchObject({
      error: 'skill not found',
      toolResult: result,
    });
  });

  it('uses a generic message for an error result without text', async () => {
    const { store, bridge, initialized } = await setup();
    store.start();
    await initialized;
    await bridge.sendToolResult({ isError: true, content: [] });
    await waitForPhase(store, McpAppPhase.Error);
    expect(store.getSnapshot().error).toBe('Tool failed');
  });

  it('clears the previous result on new tool input', async () => {
    const { store, bridge, initialized } = await setup();
    store.start();
    await initialized;
    await bridge.sendToolResult({ content: [], structuredContent: {} });
    await waitForPhase(store, McpAppPhase.Ready);
    await bridge.sendToolInput({ arguments: { q: 1 } });
    await waitForPhase(store, McpAppPhase.ToolPending);
    expect(store.getSnapshot()).toMatchObject({
      toolInput: { q: 1 },
      toolResult: undefined,
    });
  });

  it('goes to error on cancel with the reason', async () => {
    const { store, bridge, initialized } = await setup();
    store.start();
    await initialized;
    await bridge.sendToolCancelled({ reason: 'user' });
    await waitForPhase(store, McpAppPhase.Error);
    expect(store.getSnapshot().error).toBe('Tool cancelled: user');
  });

  it('merges host context changes', async () => {
    const { store, bridge, initialized } = await setup({
      theme: 'dark',
      platform: 'web',
    });
    store.start();
    await initialized;
    bridge.setHostContext({ theme: 'light', platform: 'web' });
    await vi.waitFor(() =>
      expect(store.getSnapshot().hostContext).toMatchObject({
        theme: 'light',
        platform: 'web',
      }),
    );
  });

  it('keeps the card when a non-fatal error happens after the handshake', async () => {
    const { store, bridge, appTransport, initialized } = await setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.start();
    await initialized;
    await bridge.sendToolResult({ content: [], structuredContent: { a: 1 } });
    await waitForPhase(store, McpAppPhase.Ready);
    appTransport.onerror?.(new Error('stray message'));
    expect(store.getSnapshot().phase).toBe(McpAppPhase.Ready);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('goes to error with the message when the handshake fails', async () => {
    const transport: Transport = {
      start: async () => {
        throw new Error('no host');
      },
      send: async () => undefined,
      close: async () => undefined,
    };
    const store = createMcpApp({
      name: 'test-app',
      version: '1.0.0',
      transport,
    });
    store.start();
    await waitForPhase(store, McpAppPhase.Error);
    expect(store.getSnapshot().error).toBe('no host');
  });

  it('treats a transport error during the handshake as fatal', async () => {
    const { store, appTransport, initialized } = await setup();
    store.start();
    appTransport.onerror?.(new Error('bad frame'));
    expect(store.getSnapshot()).toMatchObject({
      phase: McpAppPhase.Error,
      error: 'bad frame',
    });
    await initialized;
    await vi.waitFor(() =>
      expect(store.getSnapshot().hostContext).toBeDefined(),
    );
    expect(store.getSnapshot().phase).toBe(McpAppPhase.Error);
  });

  it('moves to torndown when the host tears the app down', async () => {
    const { store, bridge, initialized } = await setup();
    store.start();
    await initialized;
    await bridge.teardownResource({});
    expect(store.getSnapshot().phase).toBe(McpAppPhase.TornDown);
  });

  it('keeps the snapshot reference stable when nothing changes', async () => {
    const { store } = await setup();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('start is idempotent', async () => {
    const { store, initialized, onInitialized } = await setup();
    store.start();
    store.start();
    await initialized;
    await waitForPhase(store, McpAppPhase.ToolPending);
    expect(onInitialized).toHaveBeenCalledTimes(1);
  });

  it('openLink forwards the url to the host', async () => {
    const { store, bridge } = await setup();
    const onOpenLink = vi.fn(async () => ({}));
    bridge.onopenlink = onOpenLink;
    store.start();
    await store.openLink('https://example.com');
    expect(onOpenLink).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com' }),
      expect.anything(),
    );
  });

  it('openLink throws McpAppError when the host refuses', async () => {
    const { store, bridge } = await setup();
    bridge.onopenlink = async () => ({ isError: true });
    store.start();
    await expect(store.openLink('https://example.com')).rejects.toBeInstanceOf(
      McpAppError,
    );
  });

  it('openLink throws McpAppError when the host request fails', async () => {
    const { store, bridge } = await setup();
    bridge.onopenlink = async () => {
      throw new Error('denied');
    };
    store.start();
    const attempt = store.openLink('https://example.com');
    await expect(attempt).rejects.toBeInstanceOf(McpAppError);
    await expect(attempt).rejects.toThrow(/denied/);
  });

  it('openLink before start throws McpAppError', async () => {
    const { store } = await setup();
    await expect(store.openLink('https://example.com')).rejects.toBeInstanceOf(
      McpAppError,
    );
  });
  it.each([
    ['callTool', (store: McpAppStore) => store.callTool('search', { q: 1 })],
    ['sendMessage', (store: McpAppStore) => store.sendMessage('hi')],
  ])(
    '%s throws McpAppError when the host has no handler',
    async (_, action) => {
      const { store } = await setup();
      store.start();
      await expect(action(store)).rejects.toBeInstanceOf(McpAppError);
    },
  );

  it.each([
    ['callTool', (store: McpAppStore) => store.callTool('search', { q: 1 })],
    [
      'requestDisplayMode',
      (store: McpAppStore) => store.requestDisplayMode('fullscreen'),
    ],
    ['sendMessage', (store: McpAppStore) => store.sendMessage('hi')],
  ])(
    '%s throws McpAppError with the host message when the handler throws',
    async (_, action) => {
      const { store, bridge } = await setup();
      const fail = async () => {
        throw new Error('host exploded');
      };
      bridge.oncalltool = fail;
      bridge.onrequestdisplaymode = fail;
      bridge.onmessage = fail;
      store.start();
      const attempt = action(store);
      await expect(attempt).rejects.toBeInstanceOf(McpAppError);
      await expect(attempt).rejects.toThrow(/host exploded/);
    },
  );
});

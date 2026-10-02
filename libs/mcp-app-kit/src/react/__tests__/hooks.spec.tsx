import { act, render, renderHook, screen } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { McpAppPhase, type ParseResult } from '../../core';
import { createFakeMcpApp } from '../../testing';
import {
  McpAppProvider,
  ToolResultStatus,
  useOpenLink,
  useToolResult,
} from '..';

type Payload = { name: string };

const parse = (raw: unknown): ParseResult<Payload> =>
  typeof raw === 'object' && raw !== null && 'name' in raw
    ? { ok: true, data: raw as Payload }
    : { ok: false, reason: 'no name' };

const withApp = (
  app: ReturnType<typeof createFakeMcpApp>,
): FC<{ children: ReactNode }> => {
  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <McpAppProvider app={app}>{children}</McpAppProvider>
  );
  return Wrapper;
};

describe('useToolResult', () => {
  it('is loading until the result arrives', () => {
    const app = createFakeMcpApp({ phase: McpAppPhase.ToolPending });
    const { result } = renderHook(() => useToolResult(parse), {
      wrapper: withApp(app),
    });
    expect(result.current.status).toBe(ToolResultStatus.Loading);
  });

  it('parses structured content when ready', () => {
    const app = createFakeMcpApp({ phase: McpAppPhase.ToolPending });
    const { result } = renderHook(() => useToolResult(parse), {
      wrapper: withApp(app),
    });
    act(() =>
      app.setSnapshot({
        phase: McpAppPhase.Ready,
        toolResult: { structuredContent: { name: 'x' } },
      }),
    );
    expect(result.current).toEqual({
      status: ToolResultStatus.Ready,
      data: { name: 'x' },
    });
  });

  it('parses a JSON text block when structured content is missing', () => {
    const app = createFakeMcpApp({
      phase: McpAppPhase.Ready,
      toolResult: { content: [{ type: 'text', text: '{"name":"y"}' }] },
    });
    const { result } = renderHook(() => useToolResult(parse), {
      wrapper: withApp(app),
    });
    expect(result.current).toEqual({
      status: ToolResultStatus.Ready,
      data: { name: 'y' },
    });
  });

  it('reports invalid payloads with the reason', () => {
    const app = createFakeMcpApp({
      phase: McpAppPhase.Ready,
      toolResult: { structuredContent: { other: 1 } },
    });
    const { result } = renderHook(() => useToolResult(parse), {
      wrapper: withApp(app),
    });
    expect(result.current).toEqual({
      status: ToolResultStatus.Invalid,
      error: 'no name',
    });
  });

  it('reports errors', () => {
    const app = createFakeMcpApp({ phase: McpAppPhase.Error, error: 'boom' });
    const { result } = renderHook(() => useToolResult(parse), {
      wrapper: withApp(app),
    });
    expect(result.current).toEqual({
      status: ToolResultStatus.Error,
      error: 'boom',
    });
  });
});

describe('useOpenLink', () => {
  it('forwards to the store', async () => {
    const app = createFakeMcpApp();
    const { result } = renderHook(() => useOpenLink(), {
      wrapper: withApp(app),
    });
    await result.current('https://a.test');
    expect(app.openedLinks).toEqual(['https://a.test']);
  });
});

describe('McpAppProvider', () => {
  it('applies host context to the document and follows changes', () => {
    const app = createFakeMcpApp({ hostContext: { theme: 'dark' } });
    render(
      <McpAppProvider app={app}>
        <span>child</span>
      </McpAppProvider>,
    );
    expect(screen.getByText('child')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    act(() => app.setSnapshot({ hostContext: { theme: 'light' } }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('throws a clear error when a hook is used outside the provider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      expect(() => renderHook(() => useOpenLink())).toThrow(/McpAppProvider/);
    } finally {
      consoleError.mockRestore();
    }
  });
});

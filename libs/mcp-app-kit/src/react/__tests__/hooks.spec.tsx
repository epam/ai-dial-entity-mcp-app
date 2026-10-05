import { act, render, renderHook, screen } from '@testing-library/react';
import { type FC, type ReactNode, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { McpAppError, McpAppPhase, type ParseResult } from '../../core';
import { createFakeMcpApp } from '../../testing';
import {
  McpAppProvider,
  ToolResultStatus,
  useHostContext,
  useMcpApp,
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
  it('reports an error result even when the phase is ready', () => {
    const app = createFakeMcpApp({
      phase: McpAppPhase.Ready,
      toolResult: {
        isError: true,
        content: [{ type: 'text', text: 'boom' }],
      },
    });
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

  it('rejects with McpAppError when the host refuses', async () => {
    const app = createFakeMcpApp();
    app.failOpenLink();
    const { result } = renderHook(() => useOpenLink(), {
      wrapper: withApp(app),
    });
    await expect(result.current('https://a.test')).rejects.toBeInstanceOf(
      McpAppError,
    );
    expect(app.openedLinks).toEqual([]);
  });
});

describe('useMcpApp', () => {
  it('returns the store snapshot and follows changes', () => {
    const app = createFakeMcpApp({ phase: McpAppPhase.ToolPending });
    const { result } = renderHook(() => useMcpApp(), {
      wrapper: withApp(app),
    });
    expect(result.current).toBe(app.getSnapshot());
    act(() => app.setSnapshot({ phase: McpAppPhase.Ready }));
    expect(result.current.phase).toBe(McpAppPhase.Ready);
    expect(result.current).toBe(app.getSnapshot());
  });
});

describe('useHostContext', () => {
  it('returns the host context from the snapshot', () => {
    const app = createFakeMcpApp();
    const { result } = renderHook(() => useHostContext(), {
      wrapper: withApp(app),
    });
    expect(result.current).toBeUndefined();
    act(() =>
      app.setSnapshot({ hostContext: { theme: 'dark', platform: 'web' } }),
    );
    expect(result.current).toEqual({ theme: 'dark', platform: 'web' });
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

  it('applies host context before paint, ahead of child effects', () => {
    const app = createFakeMcpApp({ hostContext: { theme: 'dark' } });
    const seenThemes: Array<string | null> = [];
    const ThemeProbe: FC = () => {
      useEffect(() => {
        seenThemes.push(document.documentElement.getAttribute('data-theme'));
      }, []);
      return null;
    };
    render(
      <McpAppProvider app={app}>
        <ThemeProbe />
      </McpAppProvider>,
    );
    expect(seenThemes).toEqual(['dark']);
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

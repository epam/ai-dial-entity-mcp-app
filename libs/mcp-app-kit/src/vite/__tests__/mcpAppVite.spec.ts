import type { Connect, Plugin } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { MCP_APP_PATH, mcpAppEndpoint, mcpAppVite } from '..';

const captureMiddleware = (plugin: Plugin): Connect.NextHandleFunction => {
  let captured: Connect.NextHandleFunction | undefined;
  const server = {
    middlewares: { use: (fn: Connect.NextHandleFunction) => (captured = fn) },
  };
  (plugin.configureServer as (s: unknown) => void)(server);
  return captured!;
};

describe('mcpAppEndpoint', () => {
  it('rewrites the stable MCP app path to the index', () => {
    const middleware = captureMiddleware(mcpAppEndpoint());
    const req = { url: `${MCP_APP_PATH}?v=1` } as Connect.IncomingMessage;
    const next = vi.fn();
    middleware(req, {} as never, next);
    expect(req.url).toBe('/?v=1');
    expect(next).toHaveBeenCalled();
  });

  it('leaves other paths alone', () => {
    const middleware = captureMiddleware(mcpAppEndpoint());
    const req = { url: '/src/main.tsx' } as Connect.IncomingMessage;
    middleware(req, {} as never, vi.fn());
    expect(req.url).toBe('/src/main.tsx');
  });
});

describe('mcpAppVite', () => {
  it('includes react, singlefile and the endpoint plugin', () => {
    const names = mcpAppVite()
      .flat()
      .filter((p): p is Plugin => !!p && typeof p === 'object' && 'name' in p)
      .map((p) => p.name);
    expect(names).toContain('mcp-app-endpoint');
    expect(names.some((n) => n.includes('singlefile'))).toBe(true);
    expect(names.some((n) => n.includes('react'))).toBe(true);
  });
});

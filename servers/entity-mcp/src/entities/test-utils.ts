import { vi } from 'vitest';
import type { EntityContext } from './types.ts';

export const TEST_CTX: EntityContext = {
  config: {
    coreBaseUrl: 'https://core.example.com',
    port: 8080,
    appHtmlPath: 'x.html',
  },
  credential: { header: 'Authorization', value: 'Bearer token' },
  correlation: { correlationId: 'test-correlation-id' },
};

/**
 * Mocks `fetch` so each Core path returns the given JSON. An unknown path is a
 * 404; a route whose value is a number answers with that status.
 * @param routes - map of Core path (with query string) to body or status
 */
export const mockCore = (routes: Record<string, unknown>) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input).replace(TEST_CTX.config.coreBaseUrl, '');
    const route = routes[path];
    if (route === undefined) return new Response('{}', { status: 404 });
    if (typeof route === 'number') {
      return new Response('{}', { status: route });
    }
    return new Response(JSON.stringify(route), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

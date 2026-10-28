import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createRequestHandler } from './handler.ts';

const config = {
  coreBaseUrl: 'https://core.example.com',
  port: 0,
  appHtmlPath: 'x',
};
const CARD_HTML = '<html>card</html>';

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.0' },
  },
};
const readCard = {
  jsonrpc: '2.0',
  id: 2,
  method: 'resources/read',
  params: { uri: 'ui://entity-card/index.html' },
};
const listTools = { jsonrpc: '2.0', id: 3, method: 'tools/list' };
const callTool = {
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: { name: 'render_entity_card', arguments: {} },
};

describe('the MCP request handler', () => {
  const server = createServer(createRequestHandler(config, CARD_HTML));
  let baseUrl = '';

  beforeAll(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await new Promise<void>((done) => server.listen(0, done));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  });

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  test('initializes without a credential', async () => {
    expect((await post(initialize)).status).toBe(200);
  });

  test('serves the card resource without a credential', async () => {
    const response = await post(readCard);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('card');
  });

  test.each([
    ['tools/list', listTools],
    ['tools/call', callTool],
    ['a batch with tools/call', [{ ...readCard }, callTool]],
  ])(
    'refuses %s without a credential with a 401 challenge',
    async (_, body) => {
      const response = await post(body);
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    },
  );

  test.each([
    ['an Api-Key', { 'api-key': 'raw-key' }],
    ['a non-bearer Authorization', { authorization: 'Basic dXNlcjpwYXNz' }],
  ])('refuses tools/list with %s', async (_, headers) => {
    expect((await post(listTools, headers)).status).toBe(401);
  });

  test('lists tools for a caller with a bearer token', async () => {
    const response = await post(listTools, { authorization: 'Bearer abc.def' });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('show_entity_card');
  });

  test('answers invalid JSON with a JSON-RPC parse error', async () => {
    const response = await post('{nope');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: -32700 } });
  });

  test('answers a body declared too large with 413 before reading it', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        `${baseUrl}/mcp`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': String(2 * 1024 * 1024),
          },
        },
        (res) => {
          resolve(res.statusCode ?? 0);
          req.destroy();
        },
      );
      req.on('error', reject);
      req.write('{"pad":"');
    });
    expect(status).toBe(413);
  });

  test('answers /health and unknown paths', async () => {
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/other`)).status).toBe(404);
  });
});

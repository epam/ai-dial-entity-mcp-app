import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseEntityCardPayload } from '@epam/ai-dial-entity-contract';
import type { CorrelationContext } from '../core/client.ts';
import { EntityKind } from '../core/routing.ts';
import { buildCardPayload, createMcpServer } from './server.ts';

const config = {
  coreBaseUrl: 'https://core.example.com',
  port: 8080,
  appHtmlPath: 'x',
  tryUrlTemplate: 'https://chat.example.com/{kind}s/{id}/try',
};

const TEST_CORRELATION: CorrelationContext = {
  correlationId: 'test-correlation-id',
};

describe('buildCardPayload', () => {
  test('produces a payload the card parser accepts, for a skill', () => {
    const payload = buildCardPayload({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/my-skill',
      raw: { attributes: { name: 'my-skill', description: 'Does a thing.' } },
      activeLocale: 'en',
    });
    const parsed = parseEntityCardPayload(payload);
    expect(parsed.ok).toBe(true);
  });

  test('produces a payload the card parser accepts, for an agent', () => {
    const payload = buildCardPayload({
      config,
      kind: EntityKind.Agent,
      id: 'gpt-4o',
      raw: { displayName: 'Inbox Digest', description: 'Summarizes.' },
      activeLocale: 'en',
    });
    expect(parseEntityCardPayload(payload).ok).toBe(true);
    expect(payload.entity.kindLabel).toBe('Agent');
  });

  test('omits initials so the card derives them', () => {
    const payload = buildCardPayload({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/my-skill',
      raw: { attributes: { name: 'good morning', description: 'x' } },
      activeLocale: 'en',
    });
    expect('initials' in payload.entity).toBe(false);
  });

  test('emits empty sections and never a qualityCheck', () => {
    const payload = buildCardPayload({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/my-skill',
      raw: { attributes: { name: 'x', description: 'y' } },
      activeLocale: 'en',
    });
    expect(payload.sections).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain('qualityCheck');
  });
});

describe('createMcpServer', () => {
  afterEach(() => vi.restoreAllMocks());

  const callTool = async (
    kind: EntityKind,
    id: string,
    status: number,
    body: unknown,
  ) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const server = createMcpServer(
      config,
      '<html></html>',
      {
        header: 'Authorization',
        value: 'Bearer token',
      },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { kind, id },
    });

    await client.close();
    await server.close();
    return result;
  };

  test('keeps a malformed id out of the tool result text', async () => {
    const server = createMcpServer(
      config,
      '<html></html>',
      {
        header: 'Authorization',
        value: 'Bearer token',
      },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: EntityKind.Skill, id: 'skills/b/../../UNIQUEMARKER' },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).not.toContain('UNIQUEMARKER');

    await client.close();
    await server.close();
  });

  test('returns the fixed not-found message for a skill on a Core 404', async () => {
    const result = await callTool(EntityKind.Skill, 'skills/b/my-skill', 404, {
      error: 'SECRET_CORE_BODY',
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      'That entity no longer exists.',
    );
    expect(JSON.stringify(result.content)).not.toContain('SECRET_CORE_BODY');
  });

  test('returns the fixed forbidden message for a skill on a Core 403', async () => {
    const result = await callTool(EntityKind.Skill, 'skills/b/my-skill', 403, {
      error: 'SECRET_CORE_BODY',
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      "You don't have access to this entity.",
    );
    expect(JSON.stringify(result.content)).not.toContain('SECRET_CORE_BODY');
  });

  test('returns the fixed not-found message for an agent on a Core 404', async () => {
    const result = await callTool(EntityKind.Agent, 'gpt-4o', 404, {
      error: 'SECRET_CORE_BODY',
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      'That entity no longer exists.',
    );
    expect(JSON.stringify(result.content)).not.toContain('SECRET_CORE_BODY');
  });

  test('returns the fixed forbidden message for an agent on a Core 403', async () => {
    const result = await callTool(EntityKind.Agent, 'gpt-4o', 403, {
      error: 'SECRET_CORE_BODY',
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      "You don't have access to this entity.",
    );
    expect(JSON.stringify(result.content)).not.toContain('SECRET_CORE_BODY');
  });

  test('forwards a bearer credential to Core as Authorization', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ attributes: { name: 'x', description: 'y' } }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const server = createMcpServer(
      config,
      '<html></html>',
      {
        header: 'Authorization',
        value: 'Bearer abc.def',
      },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: EntityKind.Skill, id: 'skills/b/s' },
    });
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer abc.def');
    expect(headers['Api-Key']).toBeUndefined();

    await client.close();
    await server.close();
  });

  test('forwards an api-key credential to Core as Api-Key', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ attributes: { name: 'x', description: 'y' } }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const server = createMcpServer(
      config,
      '<html></html>',
      {
        header: 'Api-Key',
        value: 'raw-key-value',
      },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: EntityKind.Skill, id: 'skills/b/s' },
    });
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Api-Key']).toBe('raw-key-value');
    expect(headers['Authorization']).toBeUndefined();

    await client.close();
    await server.close();
  });

  test('fails closed with the fixed message and makes no Core request when no credential is forwarded', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const server = createMcpServer(
      config,
      '<html></html>',
      undefined,
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: EntityKind.Skill, id: 'skills/b/s' },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      'This tool needs your DIAL identity, which was not forwarded with the request.',
    );
    expect(spy).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });

  test('trims a padded id once, for both the Core fetch and the action urls', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ attributes: { name: 'x', description: 'y' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const server = createMcpServer(
      config,
      '<html></html>',
      {
        header: 'Authorization',
        value: 'Bearer token',
      },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: EntityKind.Skill, id: ' skills/b/x ' },
    });

    expect(spy.mock.calls[0]![0]).toBe(
      'https://core.example.com/v2/metadata/skills/b/x',
    );
    const structured = result.structuredContent as {
      actions: { tryUrl?: string };
    };
    expect(structured.actions.tryUrl).toBe(
      'https://chat.example.com/skills/skills%2Fb%2Fx/try',
    );
    expect(structured.actions.tryUrl).not.toContain('%20');

    await client.close();
    await server.close();
  });

  test('never logs a credential value', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), { status: 403 }),
    );
    const secretBearer = 'Bearer UNIQUE_SECRET_TOKEN';
    const secretApiKey = 'UNIQUE_SECRET_API_KEY';
    const server = createMcpServer(
      config,
      '<html></html>',
      {
        header: 'Authorization',
        value: secretBearer,
      },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: EntityKind.Skill, id: 'skills/b/s' },
    });

    const loggedText = errorSpy.mock.calls.flat().map(String).join('\n');
    expect(loggedText).not.toContain(secretBearer);
    expect(loggedText).not.toContain(secretApiKey);
    expect(loggedText).not.toContain('UNIQUE_SECRET_TOKEN');

    await client.close();
    await server.close();
  });

  test('sanitizes a newline in the id so it cannot forge a log entry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), { status: 403 }),
    );
    const server = createMcpServer(
      config,
      '<html></html>',
      {
        header: 'Authorization',
        value: 'Bearer token',
      },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({
      name: 'show_entity_card',
      arguments: {
        kind: EntityKind.Skill,
        id: 'skills/b/x\nFORGED LOG LINE',
      },
    });

    for (const call of errorSpy.mock.calls) {
      for (const arg of call) {
        if (typeof arg === 'string') {
          expect(arg.split('\n')).toHaveLength(1);
        }
      }
    }

    await client.close();
    await server.close();
  });

  test('logs one completion line with outcome and correlation id on success', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await callTool(EntityKind.Skill, 'skills/b/my-skill', 200, {
      attributes: { name: 'x', description: 'y' },
    });

    expect(result.isError).toBeFalsy();
    const logged = logSpy.mock.calls
      .map((call) => call.map(String).join(' '))
      .filter((line) => line.includes('show_entity_card'));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('succeeded');
    expect(logged[0]).toContain('test-correlation-id');
  });

  test('logs the correlation id alongside the existing diagnostic detail on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await callTool(EntityKind.Skill, 'skills/b/my-skill', 404, {
      error: 'nope',
    });

    const logged = errorSpy.mock.calls
      .map((call) => call.map(String).join(' '))
      .join('\n');
    expect(logged).toContain('test-correlation-id');
    expect(logged).toContain('DIAL Core responded 404');
  });

  test('never logs a credential value on the success path', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const secretBearer = 'Bearer UNIQUE_SUCCESS_SECRET_TOKEN';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ attributes: { name: 'x', description: 'y' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const server = createMcpServer(
      config,
      '<html></html>',
      { header: 'Authorization', value: secretBearer },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: EntityKind.Skill, id: 'skills/b/s' },
    });

    const loggedText = logSpy.mock.calls.flat().map(String).join('\n');
    expect(loggedText).not.toContain(secretBearer);
    expect(loggedText).not.toContain('UNIQUE_SUCCESS_SECRET_TOKEN');

    await client.close();
    await server.close();
  });

  test('sanitizes a newline in the id so it cannot forge a log entry on success', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ attributes: { name: 'x', description: 'y' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const server = createMcpServer(
      config,
      '<html></html>',
      { header: 'Authorization', value: 'Bearer token' },
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({
      name: 'show_entity_card',
      arguments: {
        kind: EntityKind.Skill,
        id: 'skills/b/x\nFORGED LOG LINE',
      },
    });

    for (const call of logSpy.mock.calls) {
      for (const arg of call) {
        if (typeof arg === 'string') {
          expect(arg.split('\n')).toHaveLength(1);
        }
      }
    }

    await client.close();
    await server.close();
  });
});

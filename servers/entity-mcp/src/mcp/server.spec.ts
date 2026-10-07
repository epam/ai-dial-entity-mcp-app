import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseEntityCardPayload } from '@epam/ai-dial-entity-contract';
import { EntityKind } from '../core/routing.ts';
import { buildCardPayload, createMcpServer } from './server.ts';

const config = {
  coreBaseUrl: 'https://core.example.com',
  port: 8080,
  appHtmlPath: 'x',
  tryUrlTemplate: 'https://chat.example.com/{kind}s/{id}/try',
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

    const server = createMcpServer(config, '<html></html>', 'Bearer token');
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
    const server = createMcpServer(config, '<html></html>', 'Bearer token');
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
});

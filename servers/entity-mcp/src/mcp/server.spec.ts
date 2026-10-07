import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, test } from 'vitest';
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
});

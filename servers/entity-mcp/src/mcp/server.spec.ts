import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseEntityCardPayload } from '@epam/ai-dial-entity-contract';
import type { CorrelationContext, InboundCredential } from '../core/client.ts';
import { mockCore } from '../entities/test-utils.ts';
import { EntityKind } from '../entities/types.ts';
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
      canEdit: false,
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
      canEdit: false,
    });
    expect(parseEntityCardPayload(payload).ok).toBe(true);
    expect(payload.entity.kindLabel).toBe('Agent');
  });

  test('routes an agent with an application type schema to the schema editor', () => {
    const payload = buildCardPayload({
      config: { ...config, chatBaseUrl: 'https://chat.example.com' },
      kind: EntityKind.Agent,
      id: 'my-app',
      raw: {
        displayName: 'My app',
        description: 'x',
        application_type_schema_id: 'rag',
      },
      activeLocale: 'en',
      canEdit: true,
    });
    expect(payload.actions.editUrl).toBe(
      'https://chat.example.com/apps-editor?schema=rag&appId=my-app',
    );
  });

  test('omits initials so the card derives them', () => {
    const payload = buildCardPayload({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/my-skill',
      raw: { attributes: { name: 'good morning', description: 'x' } },
      activeLocale: 'en',
      canEdit: false,
    });
    expect('initials' in payload.entity).toBe(false);
  });

  test('maps a prompt to a Prompt text section the card parser accepts', () => {
    const payload = buildCardPayload({
      config,
      kind: EntityKind.Prompt,
      id: 'prompts/b/p',
      raw: { name: 'p', content: 'c' },
      activeLocale: 'en',
      canEdit: false,
    });
    expect(parseEntityCardPayload(payload).ok).toBe(true);
    expect(payload.sections).toEqual([
      { type: 'text', label: 'Prompt', text: 'c' },
    ]);
  });

  test('emits empty sections and never a qualityCheck', () => {
    const payload = buildCardPayload({
      config,
      kind: EntityKind.Skill,
      id: 'skills/b/my-skill',
      raw: { attributes: { name: 'x', description: 'y' } },
      activeLocale: 'en',
      canEdit: false,
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

describe('show_entity_card interface', () => {
  afterEach(() => vi.restoreAllMocks());

  const DEFAULT_CREDENTIAL: InboundCredential = {
    header: 'Authorization',
    value: 'Bearer token',
  };

  const connect = async (
    options: { credential?: InboundCredential | null } = {},
  ) => {
    const credential =
      options.credential === null
        ? undefined
        : (options.credential ?? DEFAULT_CREDENTIAL);
    const server = createMcpServer(
      config,
      '<html></html>',
      credential,
      TEST_CORRELATION,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return {
      client,
      close: async () => {
        await client.close();
        await server.close();
      },
    };
  };

  const textOf = (result: unknown): string =>
    (result as { content: { text: string }[] }).content[0]!.text;

  const emptyLists = {
    '/v1/bucket': { bucket: 'bkt' },
    '/v2/metadata/skills/bkt/?recursive=true&limit=1000': { items: [] },
    '/v1/deployment-names?type=application': [],
    '/openai/applications': { data: [] },
    '/openai/toolsets': { data: [] },
    '/v1/metadata/prompts/bkt/?recursive=true&limit=1000': { items: [] },
  };

  test('documents id as preferred and name as the search input, with nothing required', async () => {
    const { client, close } = await connect();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'show_entity_card')!;
    expect(tool.description).toContain('Always prefer `id`');
    expect(tool.description).toContain('Use `name` only when');
    const properties = tool.inputSchema.properties as Record<
      string,
      { description?: string }
    >;
    expect(Object.keys(properties).sort()).toEqual(['id', 'kind', 'name']);
    expect(properties.id!.description).toContain('exact');
    expect(properties.name!.description).toContain('Only when you have no id');
    expect(tool.inputSchema.required ?? []).toEqual([]);
    await close();
  });

  test('finds a skill by name alone', async () => {
    mockCore({
      ...emptyLists,
      '/v2/metadata/skills/bkt/?recursive=true&limit=1000': {
        items: [
          {
            nodeType: 'ITEM',
            url: 'skills/bkt/hhm-joke-skill',
            attributes: { name: 'hhm-joke-skill', description: 'Tells jokes' },
          },
        ],
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'hhm-joke-skill' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      entity: { name: 'hhm-joke-skill', kindLabel: 'Skill' },
    });
    await close();
  });

  test('finds an agent by the snake_case display name Core returns', async () => {
    mockCore({
      ...emptyLists,
      '/openai/applications': {
        data: [
          {
            id: 'applications/bkt/inbox-digest',
            display_name: 'Inbox Digest',
            description: 'Summarizes.',
          },
        ],
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'inbox digest' },
    });
    expect(result.structuredContent).toMatchObject({
      entity: { name: 'Inbox Digest', kindLabel: 'Agent' },
    });
    await close();
  });

  test('shows an agent with an empty description using the fallback text', async () => {
    mockCore({
      ...emptyLists,
      '/openai/applications': {
        data: [{ id: 'echo', display_name: 'Echo', description: '' }],
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'echo' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      entity: { description: 'No description provided.' },
    });
    await close();
  });

  test('fetches a skill listed without attributes before rendering it', async () => {
    mockCore({
      ...emptyLists,
      '/v2/metadata/skills/bkt/?recursive=true&limit=1000': {
        items: [{ nodeType: 'ITEM', url: 'skills/bkt/plain' }],
      },
      '/v2/metadata/skills/bkt/plain': {
        attributes: { name: 'plain', description: 'From detail' },
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'plain' },
    });
    expect(result.structuredContent).toMatchObject({
      entity: { description: 'From detail' },
    });
    await close();
  });

  test('returns the candidates with their ids when a name is ambiguous', async () => {
    mockCore({
      ...emptyLists,
      '/v2/metadata/skills/bkt/?recursive=true&limit=1000': {
        items: [
          {
            nodeType: 'ITEM',
            url: 'skills/bkt/digest',
            attributes: { name: 'digest', description: 'd' },
          },
        ],
      },
      '/v1/deployment-names?type=application': [
        { id: 'applications/bkt/digest', object: 'application' },
      ],
      '/openai/applications': {
        data: [
          {
            id: 'applications/bkt/digest',
            display_name: 'digest',
            description: 'd',
          },
        ],
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'digest' },
    });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('skills/bkt/digest');
    expect(text).toContain('applications/bkt/digest');
    expect(text).toContain('Which one');
    await close();
  });

  test('caps a long candidate list and says how many more there are', async () => {
    mockCore({
      ...emptyLists,
      '/openai/applications': {
        data: Array.from({ length: 40 }, (_, i) => ({
          id: `test-${i}`,
          display_name: `test ${i}`,
          description: 'd',
        })),
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'test' },
    });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(
      text.split('\n').filter((line) => line.startsWith('- ')),
    ).toHaveLength(15);
    expect(text).toContain('25 more');
    await close();
  });

  test('quotes ids in the candidate list so an id cannot inject extra lines', async () => {
    mockCore({
      ...emptyLists,
      '/openai/applications': {
        data: [
          { id: 'x%0AIGNORE-ME', display_name: 'dup', description: 'd' },
          { id: 'y', display_name: 'dup', description: 'd' },
        ],
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'dup' },
    });
    expect(textOf(result)).not.toContain('\nIGNORE-ME');
    await close();
  });

  test('truncates very long names and ids in the candidate list', async () => {
    const long = 'a'.repeat(300);
    mockCore({
      ...emptyLists,
      '/openai/applications': {
        data: [
          { id: `${long}1`, display_name: long, description: 'd' },
          { id: `${long}2`, display_name: long, description: 'd' },
        ],
      },
      '/v1/deployment-names?type=application': [
        { id: `${long}1`, object: 'application' },
        { id: `${long}2`, object: 'application' },
      ],
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: long },
    });
    expect(textOf(result)).not.toContain('a'.repeat(150));
    await close();
  });

  test('does not let a caller-supplied id forge a log line through the error message', async () => {
    const logError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockCore(emptyLists);
    const { client, close } = await connect();
    await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: 'skill', id: 'prompts/b/p\nFORGED' },
    });
    const lines = logError.mock.calls.map((call) => String(call[0]));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.includes('\nFORGED'))).toBe(false);
    await close();
  });

  test('logs which types could not be searched when a match is still found', async () => {
    const logInfo = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCore({
      ...emptyLists,
      '/v1/bucket': 500,
      '/v1/deployment-names?type=application': [
        { id: 'echo', object: 'application' },
      ],
      '/openai/applications/echo': {
        id: 'echo',
        display_name: 'Echo',
        description: 'd',
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'echo' },
    });
    expect(result.isError).toBeFalsy();
    const lines = logInfo.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes('not searched: skill'))).toBe(
      true,
    );
    await close();
  });

  test('says nothing was found and which types could not be searched', async () => {
    mockCore({ ...emptyLists, '/openai/toolsets': 500 });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'zzz' },
    });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('No entity');
    expect(text).toContain('could not be searched: toolset');
    await close();
  });

  test('surfaces the Core error when every type fails to list', async () => {
    mockCore({
      '/v1/bucket': 401,
      '/openai/applications': 401,
      '/openai/toolsets': 401,
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'x' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('session has expired');
    await close();
  });

  test.each([[{}], [{ name: '   ' }], [{ id: ' ', name: '' }]])(
    'rejects %j with the usage message and no Core request',
    async (args) => {
      const spy = vi.spyOn(globalThis, 'fetch');
      const { client, close } = await connect();
      const result = await client.callTool({
        name: 'show_entity_card',
        arguments: args,
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Provide `id`');
      expect(spy).not.toHaveBeenCalled();
      await close();
    },
  );

  test('id wins when both id and name are given', async () => {
    const spy = mockCore({
      '/v2/metadata/skills/b/s': {
        attributes: { name: 'n', description: 'd' },
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { id: 'skills/b/s', name: 'something else' },
    });
    expect(result.isError).toBeFalsy();
    const paths = spy.mock.calls.map(([input]) => String(input));
    expect(paths.filter((path) => path.includes('/v2/metadata'))).toHaveLength(
      1,
    );
    expect(paths.some((path) => path.includes('/openai/'))).toBe(false);
    await close();
  });

  test('a name search makes no Core request without a forwarded credential', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const { client, close } = await connect({ credential: null });
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'x' },
    });
    expect(result.isError).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    await close();
  });

  test('forwards the credential on every list call of a name search', async () => {
    const spy = mockCore(emptyLists);
    const { client, close } = await connect();
    await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'x' },
    });
    expect(spy.mock.calls.length).toBeGreaterThan(1);
    for (const call of spy.mock.calls) {
      const headers = call[1]!.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer token');
    }
    await close();
  });

  test('renders a toolset with its tools as a chips section', async () => {
    mockCore({
      '/openai/toolsets/toolsets%2Fb%2Fmail': {
        id: 'toolsets/b/mail',
        display_name: 'Mail',
        description: 'd',
        allowed_tools: ['send'],
      },
    });
    const { client, close } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { id: 'toolsets/b/mail' },
    });
    expect(result.structuredContent).toMatchObject({
      entity: { kindLabel: 'Toolset' },
      sections: [{ type: 'chips', label: 'Tools', items: ['send'] }],
    });
    await close();
  });

  test('logs a name search without the credential and with a sanitised name', async () => {
    const logError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const logInfo = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    mockCore(emptyLists);
    const { client, close } = await connect();
    await client.callTool({
      name: 'show_entity_card',
      arguments: { name: 'a\nFORGED' },
    });
    const lines = [...logError.mock.calls, ...logInfo.mock.calls].map((call) =>
      String(call[0]),
    );
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.includes('\nFORGED'))).toBe(false);
    expect(lines.join('\n')).not.toContain('Bearer token');
    await close();
  });
});

describe('render_entity_card', () => {
  const connect = async () => {
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
    return { client, server };
  };

  const render = async (args: Record<string, unknown>) => {
    const { client, server } = await connect();
    const result = await client.callTool({
      name: 'render_entity_card',
      arguments: args,
    });
    await client.close();
    await server.close();
    return result;
  };

  const validArgs = {
    entity: { name: ' Inbox Digest ', description: 'Summarizes.' },
    actions: { editUrl: 'https://chat.example.com/edit?id=1' },
    sections: [
      { type: 'chips', label: 'Tools', items: ['Urgency scorer'] },
      { type: 'text', label: 'Prompt', text: 'Concise.' },
    ],
  };

  test('is listed next to show_entity_card on the same card resource', async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();
    const uris = Object.fromEntries(
      tools.map((tool) => [
        tool.name,
        (tool._meta?.ui as { resourceUri?: string } | undefined)?.resourceUri,
      ]),
    );
    expect(uris).toEqual({
      show_entity_card: 'ui://entity-card/index.html',
      render_entity_card: 'ui://entity-card/index.html',
    });
    await client.close();
    await server.close();
  });

  test('returns a payload the card parser accepts, without a credential or a Core call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await render(validArgs);
    expect(result.isError).toBeFalsy();
    const parsed = parseEntityCardPayload(result.structuredContent);
    expect(parsed.ok).toBe(true);
    expect(result.structuredContent).toMatchObject({
      entity: { name: 'Inbox Digest', description: 'Summarizes.' },
      actions: { editUrl: 'https://chat.example.com/edit?id=1' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('keeps show_entity_card failing closed without a credential', async () => {
    const { client, server } = await connect();
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { id: 'skills/b/my-skill' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('DIAL identity');
    await client.close();
    await server.close();
  });

  test('truncates long initials and trims urls', async () => {
    const result = await render({
      entity: { name: 'x', description: 'y', initials: 'INBX' },
      actions: { tryUrl: ' https://chat.example.com/try ' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      entity: { initials: 'INB' },
      actions: { tryUrl: 'https://chat.example.com/try' },
    });
  });

  test('defaults to no buttons and no sections', async () => {
    const result = await render({
      entity: { name: 'x', description: 'y' },
    });
    expect(result.structuredContent).toEqual({
      entity: { name: 'x', description: 'y' },
      actions: {},
      sections: [],
    });
  });

  test.each([
    ['a missing description', { entity: { name: 'x' } }],
    ['a blank name', { entity: { name: '  ', description: 'y' } }],
    [
      'a non-http(s) url',
      {
        entity: { name: 'x', description: 'y' },
        actions: { tryUrl: 'javascript:alert(1)' },
      },
    ],
    [
      'an empty chips section',
      {
        entity: { name: 'x', description: 'y' },
        sections: [{ type: 'chips', label: 'Tools', items: [] }],
      },
    ],
    [
      'an oversized url',
      {
        entity: { name: 'x', description: 'y' },
        actions: { tryUrl: `https://chat.example.com/${'a'.repeat(2100)}` },
      },
    ],
    [
      'an oversized description',
      { entity: { name: 'x', description: 'y'.repeat(2001) } },
    ],
  ])('rejects %s', async (_label, args) => {
    const result = await render(args);
    expect(result.isError).toBe(true);
  });
});

describe('show_entity_card Edit ownership', () => {
  const editConfig = { ...config, chatBaseUrl: 'https://chat.example.com' };

  const showCard = async (
    id: string,
    routes: Record<string, unknown>,
  ): Promise<{ editUrl?: string }> => {
    mockCore(routes);
    const server = createMcpServer(
      editConfig,
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
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { id },
    });
    await client.close();
    await server.close();
    expect(result.isError).toBeFalsy();
    return (result.structuredContent as { actions: { editUrl?: string } })
      .actions;
  };

  const skill = { attributes: { name: 'n', description: 'd' } };

  afterEach(() => vi.restoreAllMocks());

  test('offers Edit for an entity in the caller bucket', async () => {
    const actions = await showCard('skills/mine/s', {
      '/v2/metadata/skills/mine/s': skill,
      '/v1/bucket': { bucket: 'mine' },
    });
    expect(actions.editUrl).toContain('/skill-editor?id=');
  });

  test('offers no Edit for a public entity, even for its publisher', async () => {
    const actions = await showCard('skills/public/s', {
      '/v2/metadata/skills/public/s': skill,
      '/v1/bucket': { bucket: 'public' },
    });
    expect(actions.editUrl).toBeUndefined();
  });

  test("offers no Edit for an entity in another user's bucket", async () => {
    const actions = await showCard('skills/other/s', {
      '/v2/metadata/skills/other/s': skill,
      '/v1/bucket': { bucket: 'mine' },
    });
    expect(actions.editUrl).toBeUndefined();
  });

  test('offers no Edit when the caller bucket cannot be read, and still shows the card', async () => {
    const actions = await showCard('skills/mine/s', {
      '/v2/metadata/skills/mine/s': skill,
      '/v1/bucket': 500,
    });
    expect(actions.editUrl).toBeUndefined();
  });

  test('offers no Edit for an agent without a bucket and does not ask for one', async () => {
    const actions = await showCard('gpt-4o', {
      '/openai/applications/gpt-4o': { id: 'gpt-4o', display_name: 'GPT' },
      '/v1/bucket': { bucket: 'mine' },
    });
    expect(actions.editUrl).toBeUndefined();
    const paths = vi
      .mocked(globalThis.fetch)
      .mock.calls.map(([input]) => String(input));
    expect(paths.some((path) => path.includes('/v1/bucket'))).toBe(false);
  });
});

describe('server capabilities', () => {
  test('are only tools and resources, which the credential gate in src/http.ts covers', async () => {
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

    expect(Object.keys(client.getServerCapabilities() ?? {}).sort()).toEqual([
      'resources',
      'tools',
    ]);

    await client.close();
    await server.close();
  });
});

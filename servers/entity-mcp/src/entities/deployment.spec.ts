import { afterEach, describe, expect, test, vi } from 'vitest';
import { agentType } from './agent.ts';
import { InvalidEntityId } from './ids.ts';
import { IncompleteEntity } from './shared.ts';
import { TEST_CTX, mockCore } from './test-utils.ts';
import { toolsetType } from './toolset.ts';
import { EntityKind } from './types.ts';

afterEach(() => vi.restoreAllMocks());

describe('agentType', () => {
  test('matchesId only for the applications/ prefix', () => {
    expect(agentType.matchesId('applications/b/x')).toBe(true);
    expect(agentType.matchesId('gpt-4o')).toBe(false);
  });

  test('fetch encodes the whole id as one segment', async () => {
    const spy = mockCore({ '/openai/applications/applications%2Fb%2Fx': {} });
    await agentType.fetch(TEST_CTX, 'applications/b/x');
    expect(String(spy.mock.calls[0]![0])).toBe(
      'https://core.example.com/openai/applications/applications%2Fb%2Fx',
    );
  });

  test('fetch rejects a traversal id', () => {
    expect(() => agentType.fetch(TEST_CTX, 'a/../b')).toThrow(InvalidEntityId);
  });

  test('map reads Core snake_case display_name and description', () => {
    expect(
      agentType.map(
        {
          id: 'a',
          display_name: { en: 'Inbox Digest' },
          description: 'Summarizes.',
        },
        'en',
      ),
    ).toEqual({
      name: 'Inbox Digest',
      description: 'Summarizes.',
      kindLabel: 'Agent',
      sections: [],
    });
  });

  test('map still accepts the camelCase displayName spelling', () => {
    expect(
      agentType.map(
        { id: 'a', displayName: 'Inbox Digest', description: 'd' },
        'en',
      ).name,
    ).toBe('Inbox Digest');
  });

  test('map resolves a localized display name for the active locale', () => {
    expect(
      agentType.map(
        { display_name: { fr: 'Boite', en: 'Inbox' }, description: 'x' },
        'fr',
      ).name,
    ).toBe('Boite');
  });

  test('map falls back to the id when there is no display name', () => {
    expect(agentType.map({ id: 'gpt-4o', description: 'd' }, 'en').name).toBe(
      'gpt-4o',
    );
  });

  test('map uses a fixed fallback description when Core has none or an empty one', () => {
    expect(
      agentType.map({ id: 'a', display_name: 'A' }, 'en').description,
    ).toBe('No description provided.');
    expect(
      agentType.map({ id: 'a', display_name: 'A', description: '' }, 'en')
        .description,
    ).toBe('No description provided.');
  });

  test('map throws IncompleteEntity when there is no usable name', () => {
    expect(() => agentType.map({ description: 'd' }, 'en')).toThrow(
      IncompleteEntity,
    );
    expect(() =>
      agentType.map({ display_name: {}, description: 'x' }, 'en'),
    ).toThrow(IncompleteEntity);
  });

  test('list reads data[] with the inline record and matches by display name and decoded id tail', async () => {
    mockCore({
      '/openai/applications': {
        data: [
          {
            id: 'applications/b/inbox%20digest',
            display_name: 'Inbox Digest',
            description: 'd',
          },
          { display_name: 'no id' },
        ],
      },
    });
    const candidates = await agentType.list(TEST_CTX);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: EntityKind.Agent,
      id: 'applications/b/inbox digest',
      names: ['Inbox Digest', 'inbox digest'],
    });
    expect(candidates[0]!.raw).toBeDefined();
  });

  test('a listed percent-encoded id is decoded so fetch sends it encoded exactly once', async () => {
    const spy = mockCore({
      '/openai/applications': {
        data: [{ id: 'applications/b/inbox%20digest', description: 'd' }],
      },
      '/openai/applications/applications%2Fb%2Finbox%20digest': {},
    });
    const [candidate] = await agentType.list(TEST_CTX);
    await agentType.fetch(TEST_CTX, candidate!.id);
    expect(String(spy.mock.calls[1]![0])).toBe(
      'https://core.example.com/openai/applications/applications%2Fb%2Finbox%20digest',
    );
  });

  test('listNames reads the cheap id-only endpoint and returns decoded ids without a record', async () => {
    const spy = mockCore({
      '/v1/deployment-names?type=application': [
        { id: 'echo', object: 'application' },
        { id: 'applications/b/MH%20Test__0.0.1', object: 'application' },
        { object: 'application' },
      ],
    });
    const candidates = await agentType.listNames!(TEST_CTX);
    expect(String(spy.mock.calls[0]![0])).toBe(
      'https://core.example.com/v1/deployment-names?type=application',
    );
    expect(candidates).toEqual([
      { kind: EntityKind.Agent, id: 'echo', names: ['echo'] },
      {
        kind: EntityKind.Agent,
        id: 'applications/b/MH Test__0.0.1',
        names: ['MH Test__0.0.1'],
      },
    ]);
  });

  test('listNames is empty when the body is not an array', async () => {
    mockCore({ '/v1/deployment-names?type=application': { nope: 1 } });
    await expect(agentType.listNames!(TEST_CTX)).resolves.toEqual([]);
  });

  test('the full list is allowed a longer timeout than the default', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    mockCore({ '/openai/applications': { data: [] } });
    await agentType.list(TEST_CTX);
    expect(timeout).toHaveBeenCalledWith(60_000);
  });

  test('list is empty when the body has no data array', async () => {
    mockCore({ '/openai/applications': { nope: 1 } });
    await expect(agentType.list(TEST_CTX)).resolves.toEqual([]);
  });
});

describe('toolsetType', () => {
  test('has no names-only fast path (its full list is fast enough)', () => {
    expect(toolsetType.listNames).toBeUndefined();
  });

  test('matchesId only for the toolsets/ prefix', () => {
    expect(toolsetType.matchesId('toolsets/b/x')).toBe(true);
    expect(toolsetType.matchesId('applications/b/x')).toBe(false);
  });

  test('fetch uses /openai/toolsets', async () => {
    const spy = mockCore({ '/openai/toolsets/toolsets%2Fb%2Fx': {} });
    await toolsetType.fetch(TEST_CTX, 'toolsets/b/x');
    expect(String(spy.mock.calls[0]![0])).toBe(
      'https://core.example.com/openai/toolsets/toolsets%2Fb%2Fx',
    );
  });

  test('map puts snake_case allowed_tools into a Tools chips section', () => {
    expect(
      toolsetType.map(
        {
          id: 't',
          display_name: 'Mail',
          description: 'd',
          allowed_tools: ['send', ' ', 'read'],
        },
        'en',
      ),
    ).toEqual({
      name: 'Mail',
      description: 'd',
      kindLabel: 'Toolset',
      sections: [{ type: 'chips', label: 'Tools', items: ['send', 'read'] }],
    });
  });

  test('map still accepts the camelCase allowedTools spelling', () => {
    expect(
      toolsetType.map(
        {
          id: 't',
          displayName: 'Mail',
          description: 'd',
          allowedTools: ['send'],
        },
        'en',
      ).sections,
    ).toEqual([{ type: 'chips', label: 'Tools', items: ['send'] }]);
  });

  test('map has no sections when the tools are empty or absent, and falls back on the description', () => {
    const mapped = toolsetType.map(
      { id: 't', display_name: 'Mail', allowed_tools: [''] },
      'en',
    );
    expect(mapped.sections).toEqual([]);
    expect(mapped.description).toBe('No description provided.');
  });
});

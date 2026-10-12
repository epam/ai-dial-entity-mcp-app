import { afterEach, describe, expect, test, vi } from 'vitest';
import { CoreError } from '../core/client.ts';
import { ENTITY_TYPES, entityTypeFor } from './registry.ts';
import { resolveById, searchByName } from './resolver.ts';
import { TEST_CTX } from './test-utils.ts';
import {
  EntityKind,
  type Candidate,
  type EntityContext,
  type EntityType,
} from './types.ts';

const stubType = (
  kind: EntityKind,
  idPrefix: string,
  candidates: Candidate[] | Error,
  fetched: Record<string, unknown> = { fetched: kind },
): EntityType => ({
  kind,
  matchesId: (id) => id.startsWith(idPrefix),
  fetch: vi.fn(async () => fetched),
  list: vi.fn(async () => {
    if (candidates instanceof Error) throw candidates;
    return candidates;
  }),
  map: () => ({ name: 'n', description: 'd', kindLabel: 'k', sections: [] }),
});

const cand = (
  kind: EntityKind,
  id: string,
  names: string[],
  raw?: Record<string, unknown>,
): Candidate => ({
  kind,
  id,
  names,
  ...(raw ? { raw } : {}),
});

const failing = (kind: EntityKind, status: number): EntityType => ({
  ...stubType(kind, 'zzz/', []),
  fetch: vi.fn(async () => {
    throw new CoreError(status, 'x');
  }),
});

afterEach(() => vi.restoreAllMocks());

describe('registry', () => {
  test('lists skill, agent, toolset, prompt and looks types up by kind', () => {
    expect(ENTITY_TYPES.map((t) => t.kind)).toEqual([
      EntityKind.Skill,
      EntityKind.Agent,
      EntityKind.Toolset,
      EntityKind.Prompt,
    ]);
    expect(entityTypeFor(EntityKind.Prompt).kind).toBe(EntityKind.Prompt);
  });
});

describe('resolveById', () => {
  const skill = stubType(EntityKind.Skill, 'skills/', []);
  const agent = stubType(EntityKind.Agent, 'applications/', []);
  const toolset = stubType(EntityKind.Toolset, 'toolsets/', []);
  const types = [skill, agent, toolset];

  test('routes a prefixed id to its type without listing', async () => {
    const resolved = await resolveById(
      TEST_CTX,
      ' skills/b/x ',
      undefined,
      types,
    );
    expect(resolved).toEqual({
      kind: EntityKind.Skill,
      id: 'skills/b/x',
      raw: { fetched: 'skill' },
    });
    expect(skill.list).not.toHaveBeenCalled();
  });

  test('an explicit kind wins over the prefix', async () => {
    const resolved = await resolveById(
      TEST_CTX,
      'gpt-4o',
      EntityKind.Agent,
      types,
    );
    expect(resolved.kind).toBe(EntityKind.Agent);
  });

  test('a bare id is tried as an agent first', async () => {
    const resolved = await resolveById(TEST_CTX, 'gpt-4o', undefined, types);
    expect(resolved.kind).toBe(EntityKind.Agent);
    expect(toolset.fetch).not.toHaveBeenCalled();
  });

  test('a bare id falls through to a toolset on an agent 404', async () => {
    const resolved = await resolveById(TEST_CTX, 'mail', undefined, [
      skill,
      failing(EntityKind.Agent, 404),
      toolset,
    ]);
    expect(resolved.kind).toBe(EntityKind.Toolset);
  });

  test('a bare id that is nowhere throws the first 404', async () => {
    await expect(
      resolveById(TEST_CTX, 'nope', undefined, [
        failing(EntityKind.Agent, 404),
        failing(EntityKind.Toolset, 404),
      ]),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('a non-404 agent error is not retried as a toolset', async () => {
    const untouched = stubType(EntityKind.Toolset, 'toolsets/', []);
    await expect(
      resolveById(TEST_CTX, 'x', undefined, [
        failing(EntityKind.Agent, 403),
        untouched,
      ]),
    ).rejects.toMatchObject({ status: 403 });
    expect(untouched.fetch).not.toHaveBeenCalled();
  });
});

const withNames = (
  type: EntityType,
  names: Candidate[] | Error,
): EntityType => ({
  ...type,
  listNames: vi.fn(async () => {
    if (names instanceof Error) throw names;
    return names;
  }),
});

describe('searchByName fast path', () => {
  test('matches on the cheap names first and never runs the full list when something matched', async () => {
    const agent = withNames(
      stubType(
        EntityKind.Agent,
        'applications/',
        [cand(EntityKind.Agent, 'applications/b/other', ['other'], {})],
        { display_name: 'Inbox Digest', description: 'd' },
      ),
      [cand(EntityKind.Agent, 'applications/b/inbox-digest', ['inbox-digest'])],
    );
    const outcome = await searchByName(TEST_CTX, 'inbox digest', undefined, [
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { id: 'applications/b/inbox-digest' },
    });
    expect(agent.list).not.toHaveBeenCalled();
    expect(agent.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ credential: TEST_CTX.credential }),
      'applications/b/inbox-digest',
    );
  });

  test('falls back to the full list, and its display names, only when no name matched', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(
          EntityKind.Agent,
          'SmartContractManager_shn',
          ['Smart Contract Manager SHN', 'SmartContractManager_shn'],
          { display_name: 'Smart Contract Manager SHN' },
        ),
      ]),
      [cand(EntityKind.Agent, 'echo', ['echo'])],
    );
    const outcome = await searchByName(
      TEST_CTX,
      'contract manager',
      undefined,
      [agent],
    );
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { id: 'SmartContractManager_shn' },
    });
    expect(agent.listNames).toHaveBeenCalledTimes(1);
    expect(agent.list).toHaveBeenCalledTimes(1);
  });

  test('a partial id match does not stop the fallback and is not offered on its own', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'x-123', ['Digest', 'x-123'], {}),
      ]),
      [
        cand(EntityKind.Agent, 'applications/b/digest-helper', [
          'digest-helper',
        ]),
      ],
    );
    const outcome = await searchByName(TEST_CTX, 'digest', undefined, [agent]);
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { id: 'x-123' },
    });
    expect(agent.list).toHaveBeenCalledTimes(1);
  });

  test('a partial match in another type no longer hides an agent matched by display name', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/digest-helper', ['digest-helper'], {}),
    ]);
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'x-123', ['Digest', 'x-123'], {}),
      ]),
      [],
    );
    const outcome = await searchByName(TEST_CTX, 'digest', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { kind: EntityKind.Agent, id: 'x-123' },
    });
  });

  test('an exact match in any type is decisive, so the slow agent list does not run', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/hhm-joke-skill', ['hhm-joke-skill'], {}),
    ]);
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', []),
      [],
    );
    const outcome = await searchByName(TEST_CTX, 'hhm-joke-skill', undefined, [
      skill,
      agent,
    ]);
    expect(outcome.status).toBe('found');
    expect(agent.list).not.toHaveBeenCalled();
  });

  test('stops the slow fallback at the deadline and reports the type as skipped', async () => {
    const hangingAgent = withNames(
      {
        ...stubType(EntityKind.Agent, 'applications/', []),
        list: vi.fn(
          (ctx: EntityContext) =>
            new Promise<Candidate[]>((_resolve, reject) => {
              ctx.signal?.addEventListener('abort', () =>
                reject(new CoreError(504, 'slow')),
              );
            }),
        ),
      },
      [],
    );
    const skill = stubType(EntityKind.Skill, 'skills/', []);
    const outcome = await searchByName(
      TEST_CTX,
      'zzz',
      undefined,
      [skill, hangingAgent],
      25,
    );
    expect(outcome).toEqual({
      status: 'not_found',
      searched: [EntityKind.Skill, EntityKind.Agent],
      skipped: [EntityKind.Agent],
    });
  });

  test('the same entity listed twice is one match, not an ambiguity', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/a', ['a'], {}),
      cand(EntityKind.Skill, 'skills/b/a', ['a'], {}),
    ]);
    const outcome = await searchByName(TEST_CTX, 'a', undefined, [skill]);
    expect(outcome.status).toBe('found');
  });

  test('a found match still reports the types that could not be searched', async () => {
    const skill = stubType(
      EntityKind.Skill,
      'skills/',
      new CoreError(500, 'x'),
    );
    const agent = stubType(EntityKind.Agent, 'applications/', [
      cand(EntityKind.Agent, 'echo', ['echo'], {}),
    ]);
    const outcome = await searchByName(TEST_CTX, 'echo', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      skipped: [EntityKind.Skill],
    });
  });

  test('does not retry the full list after an auth failure on the names call', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', []),
      new CoreError(401, 'expired'),
    );
    await expect(
      searchByName(TEST_CTX, 'x', undefined, [agent]),
    ).rejects.toMatchObject({ status: 401 });
    expect(agent.list).not.toHaveBeenCalled();
  });

  test('the final detail fetch is bounded by its own signal', async () => {
    const prompt = stubType(
      EntityKind.Prompt,
      'prompts/',
      [cand(EntityKind.Prompt, 'prompts/b/Greeter', ['Greeter'])],
      { name: 'Greeter', content: 'c' },
    );
    await searchByName(TEST_CTX, 'greeter', undefined, [prompt]);
    const fetchCtx = (prompt.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as EntityContext;
    expect(fetchCtx.signal).toBeInstanceOf(AbortSignal);
  });

  test('a failing names call also falls back to the full list', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'echo', ['echo'], {}),
      ]),
      new CoreError(500, 'x'),
    );
    const outcome = await searchByName(TEST_CTX, 'echo', undefined, [agent]);
    expect(outcome).toMatchObject({ status: 'found' });
  });

  test('a failing names call triggers the full list even when another type matched', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/digest', ['digest'], {}),
    ]);
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'applications/b/digest', ['digest'], {}),
      ]),
      new CoreError(500, 'x'),
    );
    const outcome = await searchByName(TEST_CTX, 'digest', undefined, [
      skill,
      agent,
    ]);
    expect(outcome.status).toBe('ambiguous');
  });

  test('reports the type as skipped when the full fallback fails too', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', new CoreError(504, 'slow')),
      [],
    );
    const skill = stubType(EntityKind.Skill, 'skills/', []);
    const outcome = await searchByName(TEST_CTX, 'zzz', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toEqual({
      status: 'not_found',
      searched: [EntityKind.Skill, EntityKind.Agent],
      skipped: [EntityKind.Agent],
    });
  });

  test('throws the Core error when every type fails even after the fallback', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', new CoreError(504, 'slow')),
      new CoreError(504, 'slow'),
    );
    await expect(
      searchByName(TEST_CTX, 'a', undefined, [agent]),
    ).rejects.toMatchObject({ status: 504 });
  });
});

describe('searchByName', () => {
  test('one exact match with an inline record needs no fetch', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/hhm-joke-skill', ['hhm-joke-skill'], {
        attributes: {},
      }),
    ]);
    const outcome = await searchByName(TEST_CTX, 'HHM Joke Skill', undefined, [
      skill,
    ]);
    expect(outcome).toEqual({
      status: 'found',
      resolved: {
        kind: EntityKind.Skill,
        id: 'skills/b/hhm-joke-skill',
        raw: { attributes: {} },
      },
    });
    expect(skill.fetch).not.toHaveBeenCalled();
  });

  test('a match without an inline record is fetched', async () => {
    const prompt = stubType(
      EntityKind.Prompt,
      'prompts/',
      [cand(EntityKind.Prompt, 'prompts/b/Greeter', ['Greeter'])],
      { name: 'Greeter', content: 'c' },
    );
    const outcome = await searchByName(TEST_CTX, 'greeter', undefined, [
      prompt,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { raw: { name: 'Greeter' } },
    });
    expect(prompt.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ credential: TEST_CTX.credential }),
      'prompts/b/Greeter',
    );
  });

  test('a skill listed without attributes is fetched, not rendered from nothing', async () => {
    const skill = stubType(
      EntityKind.Skill,
      'skills/',
      [cand(EntityKind.Skill, 'skills/b/a', ['a'])],
      { attributes: { name: 'a', description: 'd' } },
    );
    const outcome = await searchByName(TEST_CTX, 'a', undefined, [skill]);
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { raw: { attributes: { name: 'a' } } },
    });
  });

  test('an exact match beats partial matches', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/joke', ['joke'], {}),
      cand(EntityKind.Skill, 'skills/b/joke-writer', ['joke-writer'], {}),
    ]);
    const outcome = await searchByName(TEST_CTX, 'joke', undefined, [skill]);
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { id: 'skills/b/joke' },
    });
  });

  test('the same name as two types is ambiguous, never picked silently', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/digest', ['digest'], {}),
    ]);
    const agent = stubType(EntityKind.Agent, 'applications/', [
      cand(EntityKind.Agent, 'applications/b/digest', ['digest'], {}),
    ]);
    const outcome = await searchByName(TEST_CTX, 'digest', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toEqual({
      status: 'ambiguous',
      matches: [
        { kind: EntityKind.Skill, id: 'skills/b/digest', name: 'digest' },
        {
          kind: EntityKind.Agent,
          id: 'applications/b/digest',
          name: 'digest',
        },
      ],
    });
  });

  test('several partial matches are ambiguous', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/joke-a', ['joke-a'], {}),
      cand(EntityKind.Skill, 'skills/b/joke-b', ['joke-b'], {}),
    ]);
    const outcome = await searchByName(TEST_CTX, 'joke', undefined, [skill]);
    expect(outcome.status).toBe('ambiguous');
  });

  test('kind narrows the search to one type', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', []);
    const agent = stubType(EntityKind.Agent, 'applications/', []);
    await searchByName(TEST_CTX, 'x', EntityKind.Agent, [skill, agent]);
    expect(skill.list).not.toHaveBeenCalled();
    expect(agent.list).toHaveBeenCalledTimes(1);
  });

  test('no match reports what was searched', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/a', ['a'], {}),
    ]);
    const outcome = await searchByName(TEST_CTX, 'zzz', undefined, [skill]);
    expect(outcome).toEqual({
      status: 'not_found',
      searched: [EntityKind.Skill],
      skipped: [],
    });
  });

  test('a failing type is skipped and the others still match', async () => {
    const skill = stubType(
      EntityKind.Skill,
      'skills/',
      new CoreError(403, 'no'),
    );
    const agent = stubType(EntityKind.Agent, 'applications/', [
      cand(EntityKind.Agent, 'applications/b/a', ['a'], {}),
    ]);
    const outcome = await searchByName(TEST_CTX, 'a', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      resolved: { kind: EntityKind.Agent },
    });
  });

  test('logs why a type could not be listed, without the credential', async () => {
    const logError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const skill = stubType(
      EntityKind.Skill,
      'skills/',
      new CoreError(504, 'slow'),
    );
    const agent = stubType(EntityKind.Agent, 'applications/', []);
    await searchByName(TEST_CTX, 'a', undefined, [skill, agent]);
    const lines = logError.mock.calls.map((call) => String(call[0]));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('skill');
    expect(lines[0]).toContain('504');
    expect(lines[0]).toContain('test-correlation-id');
    expect(lines[0]).not.toContain('Bearer token');
    logError.mockRestore();
  });

  test('a skipped type is reported when nothing matches', async () => {
    const skill = stubType(
      EntityKind.Skill,
      'skills/',
      new CoreError(500, 'x'),
    );
    const agent = stubType(EntityKind.Agent, 'applications/', []);
    const outcome = await searchByName(TEST_CTX, 'a', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toEqual({
      status: 'not_found',
      searched: [EntityKind.Skill, EntityKind.Agent],
      skipped: [EntityKind.Skill],
    });
  });

  test('when every type fails the first Core error is thrown, not not_found', async () => {
    const skill = stubType(
      EntityKind.Skill,
      'skills/',
      new CoreError(401, 'expired'),
    );
    const agent = stubType(
      EntityKind.Agent,
      'applications/',
      new CoreError(500, 'x'),
    );
    await expect(
      searchByName(TEST_CTX, 'a', undefined, [skill, agent]),
    ).rejects.toMatchObject({ status: 401 });
  });
});

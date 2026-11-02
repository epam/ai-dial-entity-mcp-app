import { afterEach, describe, expect, test, vi } from 'vitest';
import { CoreError } from '../core/client.ts';
import { ENTITY_TYPES, entityTypeFor } from './registry.ts';
import { EntityVisibility, findCandidates, resolveById } from './resolver.ts';
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

const match = (
  kind: EntityKind,
  id: string,
  name: string,
  visibility: EntityVisibility | undefined = EntityVisibility.Private,
) => ({
  kind,
  id,
  name,
  ...(visibility ? { visibility } : {}),
});

describe('findCandidates with both listings', () => {
  test('runs the full list next to the cheap names, so a display name is matched even when the names call matched too', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(
          EntityKind.Agent,
          'applications/b/other',
          ['Inbox Digest', 'other'],
          {},
        ),
      ]),
      [cand(EntityKind.Agent, 'applications/b/inbox-digest', ['inbox-digest'])],
    );
    const outcome = await findCandidates(TEST_CTX, 'inbox digest', undefined, [
      agent,
    ]);
    expect(outcome).toEqual({
      status: 'found',
      matches: [
        match(EntityKind.Agent, 'applications/b/other', 'Inbox Digest'),
      ],
      exact: true,
    });
    expect(agent.list).toHaveBeenCalledTimes(1);
    expect(agent.listNames).toHaveBeenCalledTimes(1);
    expect(agent.fetch).not.toHaveBeenCalled();
  });

  test('matches a display name that differs from the id, which only the full list carries', async () => {
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
    const outcome = await findCandidates(
      TEST_CTX,
      'contract manager',
      undefined,
      [agent],
    );
    expect(outcome).toMatchObject({
      status: 'found',
      matches: [{ id: 'SmartContractManager_shn' }],
      exact: false,
    });
    expect(agent.listNames).toHaveBeenCalledTimes(1);
    expect(agent.list).toHaveBeenCalledTimes(1);
  });

  test('an exact display-name match from the full list beats a partial id match from the names call', async () => {
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
    const outcome = await findCandidates(TEST_CTX, 'digest', undefined, [
      agent,
    ]);
    expect(outcome).toEqual({
      status: 'found',
      matches: [{ kind: EntityKind.Agent, id: 'x-123', name: 'Digest' }],
      exact: true,
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
    const outcome = await findCandidates(TEST_CTX, 'digest', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      matches: [{ kind: EntityKind.Agent, id: 'x-123' }],
    });
  });

  test('an exact match in one type does not hide an agent matched by display name', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/hhm-joke-skill', ['hhm-joke-skill'], {}),
    ]);
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'x-123', ['HHM Joke Skill', 'x-123'], {}),
      ]),
      [],
    );
    const outcome = await findCandidates(
      TEST_CTX,
      'hhm-joke-skill',
      undefined,
      [skill, agent],
    );
    expect(outcome).toMatchObject({ status: 'found', exact: true });
    expect(
      outcome.status === 'found' && outcome.matches.map((m) => m.id),
    ).toEqual(['skills/b/hhm-joke-skill', 'x-123']);
    expect(agent.list).toHaveBeenCalledTimes(1);
  });

  test('stops a slow full list at the deadline and still matches that type by id', async () => {
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
      [cand(EntityKind.Agent, 'applications/b/zzz-helper', ['zzz-helper'])],
    );
    const skill = stubType(EntityKind.Skill, 'skills/', []);
    const outcome = await findCandidates(
      TEST_CTX,
      'zzz',
      undefined,
      [skill, hangingAgent],
      25,
    );
    expect(outcome).toEqual({
      status: 'found',
      matches: [
        match(EntityKind.Agent, 'applications/b/zzz-helper', 'zzz-helper'),
      ],
      exact: false,
      idOnly: [EntityKind.Agent],
    });
  });

  test('a type whose full list and names both fail is skipped', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', new CoreError(504, 'slow')),
      new CoreError(504, 'slow'),
    );
    const skill = stubType(EntityKind.Skill, 'skills/', []);
    const outcome = await findCandidates(TEST_CTX, 'zzz', undefined, [
      skill,
      agent,
    ]);
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
    const outcome = await findCandidates(TEST_CTX, 'a', undefined, [skill]);
    expect(outcome).toMatchObject({
      status: 'found',
      matches: [{ id: 'skills/b/a' }],
    });
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
    const outcome = await findCandidates(TEST_CTX, 'echo', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      skipped: [EntityKind.Skill],
    });
  });

  test('a failing names call does not matter while the full list works', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'echo', ['echo'], {}),
      ]),
      new CoreError(401, 'expired'),
    );
    const outcome = await findCandidates(TEST_CTX, 'echo', undefined, [agent]);
    expect(outcome).toMatchObject({ status: 'found' });
    expect(outcome).not.toHaveProperty('idOnly');
  });

  test('a failing names call does not stop the full list from matching', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'echo', ['echo'], {}),
      ]),
      new CoreError(500, 'x'),
    );
    const outcome = await findCandidates(TEST_CTX, 'echo', undefined, [agent]);
    expect(outcome).toMatchObject({ status: 'found' });
  });

  test('a failing names call does not hide a type matched through its full list', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/digest', ['digest'], {}),
    ]);
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', [
        cand(EntityKind.Agent, 'applications/b/digest', ['digest'], {}),
      ]),
      new CoreError(500, 'x'),
    );
    const outcome = await findCandidates(TEST_CTX, 'digest', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toMatchObject({ status: 'found' });
    expect(outcome.status === 'found' && outcome.matches).toHaveLength(2);
  });

  test('reports the type as matched by id only when the full list fails and the names work', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', new CoreError(504, 'slow')),
      [],
    );
    const skill = stubType(EntityKind.Skill, 'skills/', []);
    const outcome = await findCandidates(TEST_CTX, 'zzz', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toEqual({
      status: 'not_found',
      searched: [EntityKind.Skill, EntityKind.Agent],
      skipped: [],
      idOnly: [EntityKind.Agent],
    });
  });

  test('throws the Core error when every type fails even after the fallback', async () => {
    const agent = withNames(
      stubType(EntityKind.Agent, 'applications/', new CoreError(504, 'slow')),
      new CoreError(504, 'slow'),
    );
    await expect(
      findCandidates(TEST_CTX, 'a', undefined, [agent]),
    ).rejects.toMatchObject({ status: 504 });
  });
});

describe('findCandidates', () => {
  test('one exact match is reported as exact and nothing is fetched', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/hhm-joke-skill', ['hhm-joke-skill'], {
        attributes: {},
      }),
    ]);
    const outcome = await findCandidates(
      TEST_CTX,
      'HHM Joke Skill',
      undefined,
      [skill],
    );
    expect(outcome).toEqual({
      status: 'found',
      matches: [
        match(EntityKind.Skill, 'skills/b/hhm-joke-skill', 'hhm-joke-skill'),
      ],
      exact: true,
    });
    expect(skill.fetch).not.toHaveBeenCalled();
  });

  test('a single partial match is reported as not exact', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/inbox-digest', ['inbox-digest'], {}),
    ]);
    const outcome = await findCandidates(TEST_CTX, 'digest', undefined, [
      skill,
    ]);
    expect(outcome).toMatchObject({ status: 'found', exact: false });
  });

  test('an exact match beats partial matches', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/joke', ['joke'], {}),
      cand(EntityKind.Skill, 'skills/b/joke-writer', ['joke-writer'], {}),
    ]);
    const outcome = await findCandidates(TEST_CTX, 'joke', undefined, [skill]);
    expect(outcome).toMatchObject({
      matches: [{ id: 'skills/b/joke' }],
      exact: true,
    });
  });

  test('the same name as two types lists both', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/digest', ['digest'], {}),
    ]);
    const agent = stubType(EntityKind.Agent, 'applications/', [
      cand(EntityKind.Agent, 'applications/b/digest', ['digest'], {}),
    ]);
    const outcome = await findCandidates(TEST_CTX, 'digest', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toEqual({
      status: 'found',
      matches: [
        match(EntityKind.Skill, 'skills/b/digest', 'digest'),
        match(EntityKind.Agent, 'applications/b/digest', 'digest'),
      ],
      exact: true,
    });
  });

  test('a non-public match and its public copy are both listed and marked', async () => {
    const agent = stubType(EntityKind.Agent, 'applications/', [
      cand(EntityKind.Agent, 'applications/abc/my-agent', ['my-agent'], {}),
      cand(
        EntityKind.Agent,
        'applications/public/hhm/my-agent__1.0.0',
        ['my-agent'],
        {},
      ),
    ]);
    const outcome = await findCandidates(TEST_CTX, 'my-agent', undefined, [
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      matches: [
        { id: 'applications/abc/my-agent', visibility: 'private' },
        { id: 'applications/public/hhm/my-agent__1.0.0', visibility: 'public' },
      ],
    });
  });

  test('an id without a bucket gets no visibility, since it is neither owned nor published', async () => {
    const agent = stubType(EntityKind.Agent, 'applications/', [
      cand(EntityKind.Agent, 'echo', ['Echo', 'echo'], {}),
    ]);
    const outcome = await findCandidates(TEST_CTX, 'echo', undefined, [agent]);
    expect(outcome).toEqual({
      status: 'found',
      matches: [{ kind: EntityKind.Agent, id: 'echo', name: 'Echo' }],
      exact: true,
    });
  });

  test('several partial matches are all listed', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/joke-a', ['joke-a'], {}),
      cand(EntityKind.Skill, 'skills/b/joke-b', ['joke-b'], {}),
    ]);
    const outcome = await findCandidates(TEST_CTX, 'joke', undefined, [skill]);
    expect(outcome).toMatchObject({ exact: false });
    expect(outcome.status === 'found' && outcome.matches).toHaveLength(2);
  });

  test('kind narrows the search to one type', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', []);
    const agent = stubType(EntityKind.Agent, 'applications/', []);
    await findCandidates(TEST_CTX, 'x', EntityKind.Agent, [skill, agent]);
    expect(skill.list).not.toHaveBeenCalled();
    expect(agent.list).toHaveBeenCalledTimes(1);
  });

  test('no match reports what was searched', async () => {
    const skill = stubType(EntityKind.Skill, 'skills/', [
      cand(EntityKind.Skill, 'skills/b/a', ['a'], {}),
    ]);
    const outcome = await findCandidates(TEST_CTX, 'zzz', undefined, [skill]);
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
    const outcome = await findCandidates(TEST_CTX, 'a', undefined, [
      skill,
      agent,
    ]);
    expect(outcome).toMatchObject({
      status: 'found',
      matches: [{ kind: EntityKind.Agent }],
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
    await findCandidates(TEST_CTX, 'a', undefined, [skill, agent]);
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
    const outcome = await findCandidates(TEST_CTX, 'a', undefined, [
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
      findCandidates(TEST_CTX, 'a', undefined, [skill, agent]),
    ).rejects.toMatchObject({ status: 401 });
  });
});

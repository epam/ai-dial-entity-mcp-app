import { afterEach, describe, expect, test, vi } from 'vitest';
import { IncompleteEntity } from './shared.ts';
import { skillType } from './skill.ts';
import { TEST_CTX, mockCore } from './test-utils.ts';
import { EntityKind } from './types.ts';

afterEach(() => vi.restoreAllMocks());

describe('skillType.matchesId', () => {
  test('matches the skills/ prefix only', () => {
    expect(skillType.matchesId('skills/b/x')).toBe(true);
    expect(skillType.matchesId('prompts/b/x')).toBe(false);
    expect(skillType.matchesId('gpt-4o')).toBe(false);
  });
});

describe('skillType.fetch', () => {
  test('reads the metadata endpoint with encoded segments', async () => {
    const spy = mockCore({
      '/v2/metadata/skills/b/my%20skill': {
        attributes: { name: 'n', description: 'd' },
      },
    });
    await skillType.fetch(TEST_CTX, 'skills/b/my skill');
    expect(String(spy.mock.calls[0]![0])).toBe(
      'https://core.example.com/v2/metadata/skills/b/my%20skill',
    );
  });
});

describe('skillType.map', () => {
  test('maps name and description from attributes, with no sections', () => {
    expect(
      skillType.map({ attributes: { name: ' n ', description: 'd' } }, 'en'),
    ).toEqual({
      name: 'n',
      description: 'd',
      kindLabel: 'Skill',
      sections: [],
    });
  });

  test('throws IncompleteEntity when attributes are absent entirely', () => {
    expect(() => skillType.map({}, 'en')).toThrow(IncompleteEntity);
  });

  test('throws IncompleteEntity without a description', () => {
    expect(() => skillType.map({ attributes: { name: 'n' } }, 'en')).toThrow(
      IncompleteEntity,
    );
  });
});

describe('skillType.list', () => {
  const listPath = '/v2/metadata/skills/bkt/?recursive=true&limit=1000';

  test('lists items of the caller bucket with names from path and attributes', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      [listPath]: {
        items: [
          {
            nodeType: 'ITEM',
            url: 'skills/bkt/hhm-joke-skill',
            attributes: { name: 'Joke Skill', description: 'Tells jokes' },
          },
          { nodeType: 'FOLDER', url: 'skills/bkt/group' },
        ],
      },
    });
    const candidates = await skillType.list(TEST_CTX);
    expect(candidates).toEqual([
      {
        kind: EntityKind.Skill,
        id: 'skills/bkt/hhm-joke-skill',
        names: ['hhm-joke-skill', 'Joke Skill'],
        raw: { attributes: { name: 'Joke Skill', description: 'Tells jokes' } },
      },
    ]);
  });

  test('omits raw when the item has no complete attributes, so the resolver fetches it', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      [listPath]: {
        items: [
          { nodeType: 'ITEM', url: 'skills/bkt/a' },
          { nodeType: 'ITEM', url: 'skills/bkt/b', attributes: { name: 'B' } },
        ],
      },
    });
    const candidates = await skillType.list(TEST_CTX);
    expect(candidates).toEqual([
      { kind: EntityKind.Skill, id: 'skills/bkt/a', names: ['a'] },
      { kind: EntityKind.Skill, id: 'skills/bkt/b', names: ['b', 'B'] },
    ]);
  });

  test('decodes a percent-encoded url into an id that fetch re-encodes identically', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      [listPath]: {
        items: [{ nodeType: 'ITEM', url: 'skills/bkt/my%20skill' }],
      },
      '/v2/metadata/skills/bkt/my%20skill': {
        attributes: { name: 'n', description: 'd' },
      },
    });
    const [candidate] = await skillType.list(TEST_CTX);
    expect(candidate!.id).toBe('skills/bkt/my skill');
    expect(candidate!.names).toContain('my skill');
    await expect(
      skillType.fetch(TEST_CTX, candidate!.id),
    ).resolves.toBeDefined();
  });

  test('lists an item whose url has a trailing slash under an id fetch accepts', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      [listPath]: {
        items: [{ nodeType: 'ITEM', url: 'skills/bkt/hhm-joke-skill/' }],
      },
      '/v2/metadata/skills/bkt/hhm-joke-skill': {
        attributes: { name: 'n', description: 'd' },
      },
    });
    const [candidate] = await skillType.list(TEST_CTX);
    expect(candidate!.id).toBe('skills/bkt/hhm-joke-skill');
    await expect(
      skillType.fetch(TEST_CTX, candidate!.id),
    ).resolves.toBeDefined();
  });

  test('follows pages', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      [listPath]: {
        items: [{ nodeType: 'ITEM', url: 'skills/bkt/a' }],
        nextToken: 'n',
      },
      [`${listPath}&token=n`]: {
        items: [{ nodeType: 'ITEM', url: 'skills/bkt/b' }],
      },
    });
    const ids = (await skillType.list(TEST_CTX)).map((c) => c.id);
    expect(ids).toEqual(['skills/bkt/a', 'skills/bkt/b']);
  });

  test('skips items without a string url', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      [listPath]: { items: [{ nodeType: 'ITEM' }] },
    });
    await expect(skillType.list(TEST_CTX)).resolves.toEqual([]);
  });
});

describe('skillType.fetch routing', () => {
  test('keeps nested skill paths and uses the metadata endpoint, not the ZIP download', async () => {
    const spy = mockCore({
      '/v2/metadata/skills/abc123/folder/my-skill': {
        attributes: { name: 'n', description: 'd' },
      },
    });
    await skillType.fetch(TEST_CTX, 'skills/abc123/folder/my-skill');
    expect(String(spy.mock.calls[0]![0])).toBe(
      'https://core.example.com/v2/metadata/skills/abc123/folder/my-skill',
    );
  });
});

describe('skillType.list public bucket', () => {
  test('also lists public skills', async () => {
    mockCore({
      '/v1/bucket': { bucket: 'bkt' },
      '/v2/metadata/skills/bkt/?recursive=true&limit=1000': { items: [] },
      '/v2/metadata/skills/public/?recursive=true&limit=1000': {
        items: [{ nodeType: 'ITEM', url: 'skills/public/email-drafter' }],
      },
    });
    const ids = (await skillType.list(TEST_CTX)).map((c) => c.id);
    expect(ids).toEqual(['skills/public/email-drafter']);
  });
});

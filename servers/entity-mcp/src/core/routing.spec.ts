import { describe, expect, test } from 'vitest';
import { EntityKind, InvalidEntityId, coreUrlForEntity } from './routing.ts';

describe('coreUrlForEntity', () => {
  test('routes a skill id to the v2 prefix', () => {
    expect(coreUrlForEntity(EntityKind.Skill, 'skills/abc123/my-skill')).toBe(
      '/v2/skills/abc123/my-skill',
    );
  });

  test('keeps nested skill paths', () => {
    expect(
      coreUrlForEntity(EntityKind.Skill, 'skills/abc123/folder/my-skill'),
    ).toBe('/v2/skills/abc123/folder/my-skill');
  });

  test('routes an agent id to the openai applications endpoint', () => {
    expect(coreUrlForEntity(EntityKind.Agent, 'gpt-4o')).toBe(
      '/openai/applications/gpt-4o',
    );
  });

  test('encodes an agent id that is a resource path', () => {
    expect(
      coreUrlForEntity(EntityKind.Agent, 'applications/abc123/my-agent'),
    ).toBe('/openai/applications/applications%2Fabc123%2Fmy-agent');
  });

  test('rejects a skill id that is not skills/<bucket>/<path>', () => {
    expect(() => coreUrlForEntity(EntityKind.Skill, 'prompts/abc/x')).toThrow(
      InvalidEntityId,
    );
    expect(() => coreUrlForEntity(EntityKind.Skill, 'skills/abc')).toThrow(
      InvalidEntityId,
    );
  });

  test('rejects traversal segments instead of encoding them', () => {
    expect(() =>
      coreUrlForEntity(EntityKind.Skill, 'skills/abc123/../../v1/keys'),
    ).toThrow(InvalidEntityId);
    expect(() => coreUrlForEntity(EntityKind.Agent, '../v1/keys')).toThrow(
      InvalidEntityId,
    );
  });

  test('rejects an empty id', () => {
    expect(() => coreUrlForEntity(EntityKind.Agent, '  ')).toThrow(
      InvalidEntityId,
    );
  });
});

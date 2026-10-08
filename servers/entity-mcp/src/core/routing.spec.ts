import { describe, expect, test } from 'vitest';
import { EntityKind, InvalidEntityId, coreUrlForEntity } from './routing.ts';

describe('coreUrlForEntity', () => {
  test('routes a skill id to the v2 metadata endpoint', () => {
    expect(coreUrlForEntity(EntityKind.Skill, 'skills/abc123/my-skill')).toBe(
      '/v2/metadata/skills/abc123/my-skill',
    );
  });

  test('keeps nested skill paths', () => {
    expect(
      coreUrlForEntity(EntityKind.Skill, 'skills/abc123/folder/my-skill'),
    ).toBe('/v2/metadata/skills/abc123/folder/my-skill');
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

  test('rejects a skill id with an empty path segment from a double slash', () => {
    expect(() =>
      coreUrlForEntity(EntityKind.Skill, 'skills/abc123//my-skill'),
    ).toThrow(InvalidEntityId);
  });

  test('rejects a skill id with a trailing slash', () => {
    expect(() =>
      coreUrlForEntity(EntityKind.Skill, 'skills/abc123/my-skill/'),
    ).toThrow(InvalidEntityId);
  });

  test('percent-encodes backslashes instead of treating them as separators', () => {
    expect(coreUrlForEntity(EntityKind.Agent, '..\\v1\\keys')).toBe(
      '/openai/applications/..%5Cv1%5Ckeys',
    );
  });

  test('does not let a percent-encoded traversal decode to ..', () => {
    expect(coreUrlForEntity(EntityKind.Agent, '%2e%2e')).toBe(
      '/openai/applications/%252e%252e',
    );
  });

  test('collapses a scheme-like agent id into one opaque segment', () => {
    expect(coreUrlForEntity(EntityKind.Agent, 'http://evil/x')).toBe(
      '/openai/applications/http%3A%2F%2Fevil%2Fx',
    );
  });

  test('collapses a protocol-relative agent id into one opaque segment', () => {
    expect(coreUrlForEntity(EntityKind.Agent, '//evil/x')).toBe(
      '/openai/applications/%2F%2Fevil%2Fx',
    );
  });

  test('routes a skill read through the metadata endpoint, not the ZIP download endpoint', () => {
    expect(coreUrlForEntity(EntityKind.Skill, 'skills/abc123/my-skill')).toBe(
      '/v2/metadata/skills/abc123/my-skill',
    );
  });

  test('keeps the offending id out of userMessage while message stays developer-facing', () => {
    expect.assertions(3);
    try {
      coreUrlForEntity(EntityKind.Skill, 'skills/b/../../UNIQUEMARKER');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEntityId);
      const invalidEntityId = error as InvalidEntityId;
      expect(invalidEntityId.message).toContain('UNIQUEMARKER');
      expect(invalidEntityId.userMessage).not.toContain('UNIQUEMARKER');
    }
  });
});

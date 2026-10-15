import { describe, expect, test } from 'vitest';
import {
  InvalidEntityId,
  decodeResourceUrl,
  encodeDeploymentId,
  parseBucketId,
} from './ids.ts';

describe('parseBucketId', () => {
  test('splits and encodes bucket and path', () => {
    expect(parseBucketId('skills', 'skills/b/my skill/x')).toEqual({
      bucket: 'b',
      path: 'my%20skill/x',
    });
  });

  test.each([
    ['', 'empty'],
    ['skills/b', 'no path'],
    ['prompts/b/p', 'wrong prefix'],
    ['skills//p', 'empty bucket'],
    ['skills/b/a//c', 'empty segment'],
    ['skills/b/../c', 'traversal'],
    ['skills/b/./c', 'dot segment'],
  ])('rejects %s (%s)', (id) => {
    expect(() => parseBucketId('skills', id)).toThrow(InvalidEntityId);
  });

  test('the user message never repeats the id', () => {
    expect.assertions(1);
    try {
      parseBucketId('skills', 'skills/b/../UNIQUEMARKER');
    } catch (error) {
      expect((error as InvalidEntityId).userMessage).not.toContain(
        'UNIQUEMARKER',
      );
    }
  });
});

describe('encodeDeploymentId', () => {
  test('encodes the whole id as one path segment', () => {
    expect(encodeDeploymentId('applications/b/my app')).toBe(
      'applications%2Fb%2Fmy%20app',
    );
  });

  test('rejects empty and traversal ids', () => {
    expect(() => encodeDeploymentId('  ')).toThrow(InvalidEntityId);
    expect(() => encodeDeploymentId('a/../b')).toThrow(InvalidEntityId);
  });
});

describe('decodeResourceUrl', () => {
  test('decodes each segment', () => {
    expect(decodeResourceUrl('skills/b/my%20skill')).toBe('skills/b/my skill');
  });

  test('drops the trailing slash Core puts on resource item urls', () => {
    expect(decodeResourceUrl('skills/b/my-skill/')).toBe('skills/b/my-skill');
  });

  test('leaves an undecodable segment as is', () => {
    expect(decodeResourceUrl('skills/b/100%')).toBe('skills/b/100%');
  });
});

describe('ported routing cases', () => {
  test('rejects a skill id with a trailing slash', () => {
    expect(() => parseBucketId('skills', 'skills/abc123/my-skill/')).toThrow(
      InvalidEntityId,
    );
  });

  test('rejects traversal in a skill id and in an agent id', () => {
    expect(() =>
      parseBucketId('skills', 'skills/abc123/../../v1/keys'),
    ).toThrow(InvalidEntityId);
    expect(() => encodeDeploymentId('../v1/keys')).toThrow(InvalidEntityId);
  });

  test('percent-encodes backslashes instead of treating them as separators', () => {
    expect(encodeDeploymentId('..\\v1\\keys')).toBe('..%5Cv1%5Ckeys');
  });

  test('does not let a percent-encoded traversal decode to ..', () => {
    expect(encodeDeploymentId('%2e%2e')).toBe('%252e%252e');
  });

  test('collapses scheme-like and protocol-relative agent ids into one opaque segment', () => {
    expect(encodeDeploymentId('http://evil/x')).toBe('http%3A%2F%2Fevil%2Fx');
    expect(encodeDeploymentId('//evil/x')).toBe('%2F%2Fevil%2Fx');
  });

  test('keeps the offending id in the developer message but out of userMessage', () => {
    expect.assertions(3);
    try {
      parseBucketId('skills', 'skills/b/../../UNIQUEMARKER');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEntityId);
      expect((error as InvalidEntityId).message).toContain('UNIQUEMARKER');
      expect((error as InvalidEntityId).userMessage).not.toContain(
        'UNIQUEMARKER',
      );
    }
  });
});

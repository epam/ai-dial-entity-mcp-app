import { afterEach, describe, expect, test, vi } from 'vitest';
import { isOwnEntity, isPublicId, ownerBucket } from './ownership.ts';
import { TEST_CTX, mockCore } from './test-utils.ts';

afterEach(() => vi.restoreAllMocks());

describe('ownerBucket', () => {
  test.each([
    ['skills/b/s', 'b'],
    ['applications/b/folder/app__1.0.0', 'b'],
    ['toolsets/b/t', 'b'],
    ['prompts/b/p', 'b'],
    ['b/copied-toolset', 'b'],
    [' skills/b/s ', 'b'],
  ])('reads the bucket of %s', (id, bucket) => {
    expect(ownerBucket(id)).toBe(bucket);
  });

  test.each(['gpt-4o', '', 'skills', 'skills/b', 'skills//s'])(
    'finds no bucket in %j',
    (id) => {
      expect(ownerBucket(id)).toBeUndefined();
    },
  );
});

describe('isPublicId', () => {
  test('is true only for the public bucket', () => {
    expect(isPublicId('applications/public/a/x__1.0.0')).toBe(true);
    expect(isPublicId('skills/public/digest')).toBe(true);
    expect(isPublicId('skills/mine/digest')).toBe(false);
    expect(isPublicId('public')).toBe(false);
  });
});

describe('isOwnEntity', () => {
  test('is true when the id bucket is the caller bucket', async () => {
    mockCore({ '/v1/bucket': { bucket: 'mine' } });
    expect(await isOwnEntity(TEST_CTX, 'skills/mine/s')).toBe(true);
  });

  test("is false in another user's bucket", async () => {
    mockCore({ '/v1/bucket': { bucket: 'mine' } });
    expect(await isOwnEntity(TEST_CTX, 'skills/other/s')).toBe(false);
  });

  test('is false for a public id and asks Core nothing', async () => {
    const spy = mockCore({ '/v1/bucket': { bucket: 'public' } });
    expect(await isOwnEntity(TEST_CTX, 'skills/public/s')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test('is false for an id without a bucket and asks Core nothing', async () => {
    const spy = mockCore({ '/v1/bucket': { bucket: 'mine' } });
    expect(await isOwnEntity(TEST_CTX, 'gpt-4o')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test.each([
    ['a Core error', 500],
    ['an unauthorized caller', 401],
    ['a missing bucket field', {}],
    ['a blank bucket', { bucket: '  ' }],
  ])('is false on %s', async (_label, answer) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCore({ '/v1/bucket': answer });
    expect(await isOwnEntity(TEST_CTX, 'skills/mine/s')).toBe(false);
  });
});

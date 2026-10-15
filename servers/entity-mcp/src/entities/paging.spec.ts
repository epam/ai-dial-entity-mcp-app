import { afterEach, describe, expect, test, vi } from 'vitest';
import { listAllPages, withToken } from './paging.ts';
import { TEST_CTX, mockCore } from './test-utils.ts';

afterEach(() => vi.restoreAllMocks());

describe('withToken', () => {
  test('is empty without a token and url-encodes one', () => {
    expect(withToken(undefined)).toBe('');
    expect(withToken('a b')).toBe('&token=a%20b');
  });
});

describe('listAllPages', () => {
  const build = (token?: string) => `/list?limit=1000${withToken(token)}`;

  test('follows nextToken until it is absent', async () => {
    mockCore({
      '/list?limit=1000': { items: [{ n: 1 }], nextToken: 't2' },
      '/list?limit=1000&token=t2': { items: [{ n: 2 }] },
    });
    await expect(listAllPages(TEST_CTX, build)).resolves.toEqual([
      { n: 1 },
      { n: 2 },
    ]);
  });

  test('stops when Core keeps returning the same token', async () => {
    const spy = mockCore({
      '/list?limit=1000': { items: [{ n: 1 }], nextToken: 't' },
      '/list?limit=1000&token=t': { items: [{ n: 2 }], nextToken: 't' },
    });
    await expect(listAllPages(TEST_CTX, build)).resolves.toEqual([
      { n: 1 },
      { n: 2 },
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('stops on a token cycle, not only on an immediately repeated token', async () => {
    const spy = mockCore({
      '/list?limit=1000': { items: [{ n: 1 }], nextToken: 'a' },
      '/list?limit=1000&token=a': { items: [{ n: 2 }], nextToken: 'b' },
      '/list?limit=1000&token=b': { items: [{ n: 3 }], nextToken: 'a' },
    });
    await expect(listAllPages(TEST_CTX, build)).resolves.toEqual([
      { n: 1 },
      { n: 2 },
      { n: 3 },
    ]);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  test('ignores a body without items', async () => {
    mockCore({ '/list?limit=1000': { nope: true } });
    await expect(listAllPages(TEST_CTX, build)).resolves.toEqual([]);
  });
});

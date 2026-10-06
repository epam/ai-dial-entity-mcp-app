import { describe, expect, it } from 'vitest';
import failing from '../../fixtures/failing.json';
import malformed from '../../fixtures/malformed.json';
import passing from '../../fixtures/passing.json';
import withFailures from '../../fixtures/with-failures.json';
import { parseQualityCheckPayload } from '../contract';

const ok = (raw: unknown) => {
  const result = parseQualityCheckPayload(raw);
  if (!result.ok) throw new Error(result.reason);
  return result.data;
};

describe('parseQualityCheckPayload', () => {
  it('parses the fixture with a failed item', () => {
    const data = ok(withFailures);
    expect(data.passedPercent).toBe(92);
    expect(data.items).toHaveLength(6);
    expect(data.items[1]).toMatchObject({
      passed: false,
      hint: expect.any(String),
    });
  });

  it('parses the passing and failing fixtures', () => {
    expect(ok(passing).passedPercent).toBe(100);
    expect(ok(failing).passedPercent).toBe(40);
  });

  it('rejects the malformed fixture with a reason', () => {
    expect(parseQualityCheckPayload(malformed)).toEqual({
      ok: false,
      reason: 'qualityCheck.passedPercent must be a number',
    });
  });

  it.each([[null], ['x'], [42], [[]], [{}], [{ qualityCheck: null }]])(
    'rejects payload %j',
    (raw) => {
      expect(parseQualityCheckPayload(raw).ok).toBe(false);
    },
  );

  it.each([
    [91.666, 92],
    [-5, 0],
    [130, 100],
  ])('rounds and clamps passedPercent %d → %d', (input, expected) => {
    const data = ok({ qualityCheck: { passedPercent: input, items: [] } });
    expect(data.passedPercent).toBe(expected);
  });

  it('rejects a non-numeric passedPercent', () => {
    expect(
      parseQualityCheckPayload({
        qualityCheck: { passedPercent: '92', items: [] },
      }),
    ).toEqual({
      ok: false,
      reason: 'qualityCheck.passedPercent must be a number',
    });
  });

  it('rejects non-array items', () => {
    expect(
      parseQualityCheckPayload({
        qualityCheck: { passedPercent: 50, items: {} },
      }),
    ).toEqual({ ok: false, reason: 'qualityCheck.items must be an array' });
  });

  it('rejects an invalid item with its index', () => {
    expect(
      parseQualityCheckPayload({
        qualityCheck: { passedPercent: 50, items: [{ id: 'a', label: 'A' }] },
      }),
    ).toEqual({ ok: false, reason: 'qualityCheck.items[0] is invalid' });
  });

  it('ignores unknown fields and an empty hint', () => {
    const data = ok({
      extra: true,
      qualityCheck: {
        passedPercent: 50,
        items: [{ id: 'a', label: 'A', passed: false, hint: '' }],
      },
    });
    expect(data.items[0]).toEqual({ id: 'a', label: 'A', passed: false });
  });
});

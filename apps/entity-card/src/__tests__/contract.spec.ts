import { describe, expect, it } from 'vitest';
import malformed from '../../fixtures/malformed.json';
import missingUrls from '../../fixtures/missing-urls.json';
import noQualityCheck from '../../fixtures/no-quality-check.json';
import passing from '../../fixtures/passing.json';
import withFailures from '../../fixtures/with-failures.json';
import { deriveInitials, parseSkillCardPayload } from '../contract';

const ok = (raw: unknown) => {
  const result = parseSkillCardPayload(raw);
  if (!result.ok) throw new Error(result.reason);
  return result.data;
};

describe('deriveInitials', () => {
  it.each([
    ['good-morning-breakfast', 'GM'],
    ['weekly report', 'WR'],
    ['single', 'S'],
    ['Щоденний звіт', 'ЩЗ'],
    ['  spaced  out  ', 'SO'],
    ['---', '?'],
  ])('%s → %s', (name, expected) => {
    expect(deriveInitials(name)).toBe(expected);
  });
});

describe('parseSkillCardPayload', () => {
  it('parses the screenshot fixture', () => {
    const data = ok(withFailures);
    expect(data.skill).toMatchObject({
      name: 'good-morning-breakfast',
      initials: 'GM',
      kindLabel: 'Skill',
    });
    expect(data.qualityCheck?.items).toHaveLength(6);
    expect(data.qualityCheck?.items[1]).toMatchObject({
      passed: false,
      hint: expect.any(String),
    });
  });

  it('parses the passing fixture', () => {
    expect(ok(passing).qualityCheck?.passedPercent).toBe(100);
  });

  it('allows a missing quality check', () => {
    expect(ok(noQualityCheck).qualityCheck).toBeUndefined();
  });

  it('drops non-http urls and keeps explicit initials', () => {
    const data = ok(missingUrls);
    expect(data.actions).toEqual({});
    expect(data.skill.initials).toBe('OS');
  });

  it.each([
    [' https://a.test/x ', 'https://a.test/x'],
    ['HTTPS://A.test', 'https://a.test/'],
  ])('normalises the url %j to %j', (raw, expected) => {
    const data = ok({
      ...withFailures,
      actions: { tryUrl: raw, editUrl: raw },
    });
    expect(data.actions).toEqual({ tryUrl: expected, editUrl: expected });
  });

  it('rejects the malformed fixture with a reason', () => {
    expect(parseSkillCardPayload(malformed)).toEqual({
      ok: false,
      reason: 'skill.name must be a non-empty string',
    });
  });

  it.each([[null], ['x'], [42], [[]]])(
    'rejects non-object payload %j',
    (raw) => {
      expect(parseSkillCardPayload(raw).ok).toBe(false);
    },
  );

  it.each([
    [91.666, 92],
    [-5, 0],
    [130, 100],
  ])('rounds and clamps passedPercent %d → %d', (input, expected) => {
    const data = ok({
      ...withFailures,
      qualityCheck: { passedPercent: input, items: [] },
    });
    expect(data.qualityCheck?.passedPercent).toBe(expected);
  });

  it('rejects a non-numeric passedPercent', () => {
    const result = parseSkillCardPayload({
      ...withFailures,
      qualityCheck: { passedPercent: '92', items: [] },
    });
    expect(result).toEqual({
      ok: false,
      reason: 'qualityCheck.passedPercent must be a number',
    });
  });

  it('rejects an invalid quality check item with its index', () => {
    const result = parseSkillCardPayload({
      ...withFailures,
      qualityCheck: { passedPercent: 50, items: [{ id: 'a', label: 'A' }] },
    });
    expect(result).toEqual({
      ok: false,
      reason: 'qualityCheck.items[0] is invalid',
    });
  });

  it('ignores unknown fields and an empty hint', () => {
    const data = ok({
      ...withFailures,
      extra: true,
      qualityCheck: {
        passedPercent: 50,
        items: [{ id: 'a', label: 'A', passed: false, hint: '' }],
      },
    });
    expect(data.qualityCheck?.items[0]).toEqual({
      id: 'a',
      label: 'A',
      passed: false,
    });
  });
});

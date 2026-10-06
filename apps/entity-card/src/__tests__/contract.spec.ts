import { describe, expect, it } from 'vitest';
import malformed from '../../fixtures/malformed.json';
import missingUrls from '../../fixtures/missing-urls.json';
import withFailures from '../../fixtures/default.json';
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
  });

  it('ignores a legacy qualityCheck field', () => {
    const data = ok({
      ...withFailures,
      qualityCheck: { passedPercent: 'bad', items: null },
    });
    expect(data).not.toHaveProperty('qualityCheck');
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

  it('ignores unknown fields', () => {
    expect(ok({ ...withFailures, extra: true }).skill.name).toBe(
      'good-morning-breakfast',
    );
  });
});

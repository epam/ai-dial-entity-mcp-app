import { describe, expect, it } from 'vitest';
import malformed from '../../fixtures/malformed.json';
import missingUrls from '../../fixtures/missing-urls.json';
import agent from '../../fixtures/agent.json';
import sectionsEdge from '../../fixtures/sections-edge.json';
import withFailures from '../../fixtures/default.json';
import {
  deriveInitials,
  parseEntityCardPayload,
  SectionType,
} from '../contract';

const ok = (raw: unknown) => {
  const result = parseEntityCardPayload(raw);
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

describe('parseEntityCardPayload', () => {
  it('parses the screenshot fixture', () => {
    const data = ok(withFailures);
    expect(data.entity).toMatchObject({
      name: 'good-morning-breakfast',
      initials: 'GM',
      kindLabel: 'Skill',
    });
  });

  it('drops non-http urls and keeps explicit initials', () => {
    const data = ok(missingUrls);
    expect(data.actions).toEqual({});
    expect(data.entity.initials).toBe('OS');
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
    expect(parseEntityCardPayload(malformed)).toEqual({
      ok: false,
      reason: 'entity.name must be a non-empty string',
    });
  });

  it.each([[null], ['x'], [42], [[]]])(
    'rejects non-object payload %j',
    (raw) => {
      expect(parseEntityCardPayload(raw).ok).toBe(false);
    },
  );

  it('ignores unknown fields', () => {
    expect(ok({ ...withFailures, extra: true }).entity.name).toBe(
      'good-morning-breakfast',
    );
  });

  it('rejects a payload without entity', () => {
    expect(parseEntityCardPayload({ actions: {} })).toEqual({
      ok: false,
      reason: 'entity must be an object',
    });
  });
});

describe('parseEntityCardPayload sections', () => {
  it('parses the agent fixture with four sections in order', () => {
    const data = ok(agent);
    expect(data.entity).toMatchObject({
      name: 'Inbox Digest',
      kindLabel: 'Agent',
      initials: 'ID',
    });
    expect(data.sections.map((section) => section.label)).toEqual([
      'Your data',
      'Tools',
      'Prompt',
      'Schedule',
    ]);
    expect(data.sections[0]).toEqual({
      type: SectionType.Chips,
      label: 'Your data',
      items: ['Gmail', 'vip-contacts.csv'],
    });
    expect(data.sections[2]).toEqual({
      type: SectionType.Text,
      label: 'Prompt',
      text: 'Concise, neutral tone. No fluff.',
    });
  });

  it('has no sections for a skill payload', () => {
    expect(ok(withFailures).sections).toEqual([]);
  });

  it('keeps valid sections and drops or skips the invalid ones', () => {
    const data = ok(sectionsEdge);
    expect(data.sections).toEqual([
      { type: SectionType.Chips, label: 'Kept', items: ['ok', 'padded'] },
      {
        type: SectionType.Text,
        label: 'Multi-line',
        text: 'line one\nline two',
      },
      {
        type: SectionType.Chips,
        label: 'Long label',
        items: [expect.stringContaining('an-extremely-long')],
      },
    ]);
  });

  it.each([[null], ['sections'], [{ type: 'text' }], [42]])(
    'treats non-array sections %j as absent',
    (sections) => {
      const data = ok({ ...agent, sections });
      expect(data.sections).toEqual([]);
      expect(data.entity.name).toBe('Inbox Digest');
    },
  );

  it('still fails the card when the name is missing, whatever the sections', () => {
    expect(
      parseEntityCardPayload({
        entity: { description: 'No name.' },
        sections: agent.sections,
      }),
    ).toEqual({ ok: false, reason: 'entity.name must be a non-empty string' });
  });

  it('trims section labels, text and chip items', () => {
    const data = ok({
      entity: { name: 'n', description: 'd' },
      sections: [
        { type: 'text', label: '  Prompt ', text: '  hi\n' },
        { type: 'chips', label: ' Tools ', items: [' a '] },
      ],
    });
    expect(data.sections).toEqual([
      { type: SectionType.Text, label: 'Prompt', text: 'hi' },
      { type: SectionType.Chips, label: 'Tools', items: ['a'] },
    ]);
  });
});

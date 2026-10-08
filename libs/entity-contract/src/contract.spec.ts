import { describe, expect, it } from 'vitest';
import {
  deriveInitials,
  parseEntityCardPayload,
  SectionType,
} from './contract.ts';

const skillPayload = {
  entity: {
    name: 'good-morning-breakfast',
    description:
      'Evaluates investment opportunities against firm criteria. Analyzes deal summaries across key dimensions including market size, founding team quality, product-market fit signals, financial metrics, competitive positioning, and valuation.',
  },
  actions: {
    tryUrl: 'https://example.com/skills/good-morning-breakfast/try',
    editUrl: 'https://example.com/skills/good-morning-breakfast/edit',
  },
};

const malformedPayload = {
  entity: { description: 'Name is missing.' },
  actions: {},
};

const missingUrlsPayload = {
  entity: {
    name: 'orphan-skill',
    description: 'No links available.',
    initials: 'OS',
  },
  actions: { tryUrl: 'javascript:alert(1)' },
};

const agentPayload = {
  entity: {
    name: 'Inbox Digest',
    description:
      'Summarizes your inbox every morning and flags anything urgent, using your calendar and VIP list for context.',
    kindLabel: 'Agent',
    initials: 'ID',
  },
  actions: {
    tryUrl: 'https://example.com/agents/inbox-digest/try',
    editUrl: 'https://example.com/agents/inbox-digest/edit',
  },
  sections: [
    {
      type: 'chips',
      label: 'Your data',
      items: ['Gmail', 'vip-contacts.csv'],
    },
    {
      type: 'chips',
      label: 'Tools',
      items: ['Urgency scorer', 'Thread summarizer'],
    },
    {
      type: 'text',
      label: 'Prompt',
      text: 'Concise, neutral tone. No fluff.',
    },
    {
      type: 'chips',
      label: 'Schedule',
      items: ['Docs Assistant Schedule'],
    },
  ],
};

const edgeSectionsPayload = {
  entity: {
    name: 'edge-cases',
    description: 'Sections that exercise the drop and skip rules.',
    kindLabel: 'Agent',
  },
  actions: {},
  sections: [
    { type: 'chips', label: 'Kept', items: ['ok', 42, '', '  padded  '] },
    { type: 'chips', label: 'No items', items: [] },
    { type: 'chips', label: 'Items not an array', items: 'oops' },
    { type: 'text', label: 'Empty text', text: '   ' },
    { type: 'text', label: '', text: 'No label' },
    { type: 'table', label: 'Unknown type', rows: [] },
    'not an object',
    { type: 'text', label: 'Multi-line', text: 'line one\nline two' },
    {
      type: 'chips',
      label: 'Long label',
      items: [
        'an-extremely-long-unbroken-file-name-that-must-not-overflow-the-card-because-it-truncates-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.csv',
      ],
    },
  ],
};

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
  it('parses a basic skill payload', () => {
    const data = ok(skillPayload);
    expect(data.entity).toMatchObject({
      name: 'good-morning-breakfast',
      initials: 'GM',
      kindLabel: 'Skill',
    });
  });

  it('drops non-http urls and keeps explicit initials', () => {
    const data = ok(missingUrlsPayload);
    expect(data.actions).toEqual({});
    expect(data.entity.initials).toBe('OS');
  });

  it.each([
    [' https://a.test/x ', 'https://a.test/x'],
    ['HTTPS://A.test', 'https://a.test/'],
  ])('normalises the url %j to %j', (raw, expected) => {
    const data = ok({
      ...skillPayload,
      actions: { tryUrl: raw, editUrl: raw },
    });
    expect(data.actions).toEqual({ tryUrl: expected, editUrl: expected });
  });

  it('rejects a malformed payload with a reason', () => {
    expect(parseEntityCardPayload(malformedPayload)).toEqual({
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
    expect(ok({ ...skillPayload, extra: true }).entity.name).toBe(
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
  it('parses an agent payload with four sections in order', () => {
    const data = ok(agentPayload);
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
    expect(ok(skillPayload).sections).toEqual([]);
  });

  it('keeps valid sections and drops or skips the invalid ones', () => {
    const data = ok(edgeSectionsPayload);
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
      const data = ok({ ...agentPayload, sections });
      expect(data.sections).toEqual([]);
      expect(data.entity.name).toBe('Inbox Digest');
    },
  );

  it('still fails the card when the name is missing, whatever the sections', () => {
    expect(
      parseEntityCardPayload({
        entity: { description: 'No name.' },
        sections: agentPayload.sections,
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

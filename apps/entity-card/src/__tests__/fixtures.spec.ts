import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseEntityCardPayload,
  SectionType,
} from '@epam/ai-dial-entity-contract';

const fixturesDir = path.join(import.meta.dirname, '../../fixtures');

/**
 * Per-fixture assertions, keyed by file name, describing the outcome each
 * fixture is meant to produce through `parseEntityCardPayload`.
 * @param raw - the fixture's parsed JSON contents
 */
const expectations: Record<string, (raw: unknown) => void> = {
  'agent.json': (raw) => {
    const result = parseEntityCardPayload(raw);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.entity).toMatchObject({
      name: 'Inbox Digest',
      kindLabel: 'Agent',
      initials: 'ID',
    });
    expect(result.data.sections.map((section) => section.label)).toEqual([
      'Your data',
      'Tools',
      'Prompt',
      'Schedule',
    ]);
  },
  'default.json': (raw) => {
    const result = parseEntityCardPayload(raw);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.entity).toMatchObject({
      name: 'good-morning-breakfast',
      initials: 'GM',
      kindLabel: 'Skill',
    });
    expect(result.data.sections).toEqual([]);
  },
  'malformed.json': (raw) => {
    expect(parseEntityCardPayload(raw)).toEqual({
      ok: false,
      reason: 'entity.name must be a non-empty string',
    });
  },
  'missing-urls.json': (raw) => {
    const result = parseEntityCardPayload(raw);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.actions).toEqual({});
    expect(result.data.entity.initials).toBe('OS');
  },
  'sections-edge.json': (raw) => {
    const result = parseEntityCardPayload(raw);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.sections).toEqual([
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
  },
};

describe('fixture payloads', () => {
  const files = readdirSync(fixturesDir).filter((file) =>
    file.endsWith('.json'),
  );

  it('has an assertion registered for every fixture file', () => {
    expect(files.sort()).toEqual(Object.keys(expectations).sort());
  });

  it.each(files)('%s parses as expected', (file) => {
    const raw: unknown = JSON.parse(
      readFileSync(path.join(fixturesDir, file), 'utf-8'),
    );
    const assertion = expectations[file];
    if (!assertion) throw new Error(`No assertion registered for ${file}`);
    assertion(raw);
  });
});

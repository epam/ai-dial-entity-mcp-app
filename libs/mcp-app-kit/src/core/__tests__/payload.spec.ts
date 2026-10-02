import { describe, expect, it } from 'vitest';
import { getStructuredContent } from '../payload';

describe('getStructuredContent', () => {
  it('returns structuredContent from a flat result', () => {
    expect(getStructuredContent({ structuredContent: { a: 1 } })).toEqual({
      a: 1,
    });
  });

  it('returns structured_content (snake case) from a flat result', () => {
    expect(getStructuredContent({ structured_content: { a: 2 } })).toEqual({
      a: 2,
    });
  });

  it('unwraps a nested result envelope', () => {
    expect(
      getStructuredContent({ result: { structuredContent: { a: 3 } } }),
    ).toEqual({ a: 3 });
  });

  it('falls back to parsing the first text block as JSON', () => {
    expect(
      getStructuredContent({
        content: [
          { type: 'image', data: 'x' },
          { type: 'text', text: '{"a":4}' },
        ],
      }),
    ).toEqual({ a: 4 });
  });

  it('returns undefined when the text block is not JSON', () => {
    expect(
      getStructuredContent({ content: [{ type: 'text', text: 'hello' }] }),
    ).toBeUndefined();
  });

  it('returns undefined for non-objects', () => {
    expect(getStructuredContent(null)).toBeUndefined();
    expect(getStructuredContent('x')).toBeUndefined();
  });

  it('prefers structuredContent over the text block', () => {
    expect(
      getStructuredContent({
        structuredContent: { a: 5 },
        content: [{ type: 'text', text: '{"a":6}' }],
      }),
    ).toEqual({ a: 5 });
  });
});

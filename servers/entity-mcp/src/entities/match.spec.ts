import { describe, expect, test } from 'vitest';
import { MatchRank, lastSegment, rankMatch } from './match.ts';

describe('rankMatch', () => {
  test('exact match ignoring case', () => {
    expect(rankMatch('Inbox Digest', ['inbox digest'])).toBe(MatchRank.Exact);
  });

  test('treats hyphen, underscore and space as the same separator', () => {
    expect(rankMatch('Inbox Digest', ['inbox-digest'])).toBe(MatchRank.Exact);
    expect(rankMatch('inbox_digest', ['Inbox Digest'])).toBe(MatchRank.Exact);
  });

  test('partial match when the query is contained in a name', () => {
    expect(rankMatch('joke', ['hhm-joke-skill'])).toBe(MatchRank.Partial);
  });

  test('best rank across several names wins', () => {
    expect(rankMatch('joke', ['hhm-joke-skill', 'joke'])).toBe(MatchRank.Exact);
  });

  test('no match', () => {
    expect(rankMatch('weather', ['hhm-joke-skill'])).toBe(MatchRank.None);
  });

  test('an empty or whitespace query never matches', () => {
    expect(rankMatch('   ', ['anything'])).toBe(MatchRank.None);
  });
});

describe('lastSegment', () => {
  test('returns the final path segment', () => {
    expect(lastSegment('skills/b/group/my-skill')).toBe('my-skill');
  });

  test('returns a bare name unchanged', () => {
    expect(lastSegment('gpt-4o')).toBe('gpt-4o');
  });
});

export const MatchRank = {
  None: 0,
  Partial: 1,
  Exact: 2,
} as const;

export type MatchRank = (typeof MatchRank)[keyof typeof MatchRank];

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();

/**
 * Ranks how well a query matches any of an entity's names. Case, hyphens,
 * underscores and runs of spaces are ignored.
 * @param query - what the caller asked for
 * @param names - candidate names, any of which may match
 */
export const rankMatch = (query: string, names: string[]): MatchRank => {
  const wanted = normalize(query);
  if (!wanted) return MatchRank.None;
  let best: MatchRank = MatchRank.None;
  for (const name of names) {
    const candidate = normalize(name);
    if (candidate === wanted) return MatchRank.Exact;
    if (candidate.includes(wanted)) best = MatchRank.Partial;
  }
  return best;
};

/**
 * Returns the final `/`-separated segment of an id.
 * @param id - full id or bare name
 */
export const lastSegment = (id: string): string =>
  id.split('/').filter(Boolean).pop() ?? id;

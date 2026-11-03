import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { FoundMatch, SearchOutcome } from '../entities/resolver.ts';
import type { EntityKind } from '../entities/types.ts';

export const SHOW_TOOL_NAME = 'show_entity_card';

export const FIND_TOOL_DESCRIPTION = `Finds DIAL entities (skills, agents, toolsets, prompts) by name and tells you which one the user means. It only searches and answers in text; it never shows a card. Use it when the user gave a name and you do not have an entity id. Matching ignores case, hyphens, underscores and extra spaces, and a partial name can match. Set \`kind\` only when the user said which type they mean. The result lists the matches with their ids and ends with the next step: follow it. If you already have an id, do not call this tool; call \`${SHOW_TOOL_NAME}\`.`;

export const FIND_NAME_DESCRIPTION =
  'The entity name as the user wrote it. Case, hyphens, underscores and spaces are ignored; a partial name can match.';

const MAX_LISTED_MATCHES = 15;
const MAX_LISTED_NAME = 100;

/**
 * Shortens a caller-written name for a result line.
 * @param value - the text to shorten
 * @param max - longest length kept before the ellipsis
 */
const clip = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max)}…` : value;

/**
 * Quotes a name as a JSON string, so a decoded newline cannot add a line.
 * @param value - the text to quote
 * @param max - longest length kept before the ellipsis
 */
const quoted = (value: string, max: number): string =>
  JSON.stringify(clip(value, max));

/**
 * Builds the call the model should make for one match. The id is never
 * clipped: a shortened id would not resolve.
 * @param match - the entity to show
 */
const showCall = (match: FoundMatch): string =>
  `\`${SHOW_TOOL_NAME}\` with ${JSON.stringify({ id: match.id, kind: match.kind })}`;

/**
 * Builds one numbered line of the match list.
 * @param match - the entity to describe
 * @param index - position in the list, from zero
 */
const matchLine = (match: FoundMatch, index: number): string => {
  const visibility = match.visibility ? `, ${match.visibility}` : '';
  return `${index + 1}. ${match.kind} ${quoted(match.name, MAX_LISTED_NAME)}, id ${JSON.stringify(match.id)}${visibility}`;
};

/**
 * Wraps text as a successful tool result with no structured content.
 * @param text - the whole result text
 */
const textResult = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
});

/**
 * Builds the sentence that opens the match list.
 * @param name - the quoted query
 * @param count - how many entities matched
 * @param isExact - whether they match the name exactly
 */
const headingFor = (name: string, count: number, isExact: boolean): string => {
  if (count > 1) return `Several entities match ${name}:`;
  if (isExact) return `Found 1 entity matching ${name}:`;
  return `Found 1 entity whose name contains ${name} (not an exact match):`;
};

/**
 * Builds the text that follows the match list: the one static instruction the
 * model should act on. Interpolated names and ids come before it and are
 * quoted, so a crafted name cannot add lines of its own.
 * @param matches - the matches found
 * @param isExact - whether they match the searched name exactly
 * @param isIncomplete - whether some type was not searched in full
 */
const nextStep = (
  matches: FoundMatch[],
  isExact: boolean,
  isIncomplete: boolean,
): string => {
  const [only] = matches;
  if (matches.length === 1 && only && isExact && !isIncomplete) {
    return `Next step: call ${showCall(only)} now so the user sees the card. Do not describe the entity in text instead of showing the card.`;
  }
  if (matches.length === 1 && only && isExact) {
    return `Next step: some types were not searched in full, so another entity with this name may exist. If you are sure this is the one the user meant, call ${showCall(only)}; otherwise tell the user what was not searched in full and ask.`;
  }
  if (matches.length === 1 && only) {
    return `Next step: if this is clearly the entity the user meant, call ${showCall(only)}. If you are not sure, ask the user to confirm first.`;
  }
  return `Next step: do not choose for the user. Ask which one they mean, listing the options by number with kind and name. Do not call any tool until they answer. Then call \`${SHOW_TOOL_NAME}\` with the chosen id and kind.`;
};

/**
 * Describes the types that were not searched in full, or an empty string when
 * every type was.
 * @param skipped - types that could not be searched at all
 * @param idOnly - types matched by id only, display names not checked
 */
const coverageNote = (skipped: EntityKind[], idOnly: EntityKind[]): string => {
  const parts = [
    ...(skipped.length ? [`Not searched: ${skipped.join(', ')}.`] : []),
    ...(idOnly.length
      ? [`Matched by id only, display names not checked: ${idOnly.join(', ')}.`]
      : []),
  ];
  return parts.length ? `(${parts.join(' ')})` : '';
};

/**
 * Builds the `find_entities` result: plain text with the matches and the next
 * step, never a card. Ids, kinds and visibility are listed so the model or the
 * user can choose; descriptions and prompt bodies are never included, since
 * they are written by other users.
 * @param query - the name that was searched
 * @param outcome - the search outcome
 */
export const buildFindResult = (
  query: string,
  outcome: SearchOutcome,
): CallToolResult => {
  const name = quoted(query, MAX_LISTED_NAME);
  if (outcome.status === 'not_found') {
    const note = coverageNote(outcome.skipped, outcome.idOnly ?? []);
    const notSearched = note ? ` ${note}` : '';
    return textResult(
      `No entity named ${name} was found among the ${outcome.searched.join(', ')} entities you can access.${notSearched}\n\nNext step: tell the user nothing was found and ask for another name or the exact id. Do not call \`${SHOW_TOOL_NAME}\`.`,
    );
  }
  const { exact } = outcome;
  const { matches } = outcome;
  const skipped = outcome.skipped ?? [];
  const idOnly = outcome.idOnly ?? [];
  const shown = matches.slice(0, MAX_LISTED_MATCHES);
  const hidden = matches.length - shown.length;
  const more = hidden
    ? `\n...and ${hidden} more; use a more specific name to narrow it down.`
    : '';
  const note = coverageNote(skipped, idOnly);
  const notSearched = note ? `\n${note}` : '';
  return textResult(
    `${headingFor(name, matches.length, exact)}\n${shown.map(matchLine).join('\n')}${more}${notSearched}\n\n${nextStep(matches, exact, skipped.length + idOnly.length > 0)}`,
  );
};

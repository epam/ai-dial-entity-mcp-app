import type { ParseResult } from '@epam/ai-dial-mcp-app-kit';

/** Normalised payload the UI renders. */
export type SkillCardData = {
  skill: {
    name: string;
    description: string;
    initials: string;
    kindLabel: string;
  };
  actions: { tryUrl?: string; editUrl?: string };
};

const DEFAULT_KIND_LABEL = 'Skill';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const fail = (reason: string): ParseResult<never> => ({ ok: false, reason });

const safeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const { protocol, href } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? href : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Builds up to two initials from the first letters of the name's words,
 * splitting on anything that is not a letter or digit.
 * @param name - skill name, e.g. `good-morning-breakfast`
 */
export const deriveInitials = (name: string): string => {
  const initials = name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join('');
  return initials || '?';
};

/**
 * Validates and normalises the skill card tool payload. Unknown fields are
 * ignored; non-http(s) URLs are dropped so their buttons are not rendered.
 * @param raw - structured content from the tool result
 */
export const parseSkillCardPayload = (
  raw: unknown,
): ParseResult<SkillCardData> => {
  if (!isRecord(raw)) return fail('payload must be an object');
  const { skill, actions } = raw;
  if (!isRecord(skill)) return fail('skill must be an object');
  if (!isNonEmptyString(skill.name))
    return fail('skill.name must be a non-empty string');
  if (!isNonEmptyString(skill.description)) {
    return fail('skill.description must be a non-empty string');
  }

  const actionRecord = isRecord(actions) ? actions : {};
  const tryUrl = safeUrl(actionRecord.tryUrl);
  const editUrl = safeUrl(actionRecord.editUrl);

  return {
    ok: true,
    data: {
      skill: {
        name: skill.name.trim(),
        description: skill.description.trim(),
        initials: isNonEmptyString(skill.initials)
          ? skill.initials.trim().slice(0, 3).toLocaleUpperCase()
          : deriveInitials(skill.name),
        kindLabel: isNonEmptyString(skill.kindLabel)
          ? skill.kindLabel.trim()
          : DEFAULT_KIND_LABEL,
      },
      actions: { ...(tryUrl && { tryUrl }), ...(editUrl && { editUrl }) },
    },
  };
};

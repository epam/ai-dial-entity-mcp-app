import type { ParseResult } from '@epam/ai-dial-mcp-app-kit';

export enum SectionType {
  Chips = 'chips',
  Text = 'text',
}

export type ChipsSection = {
  type: SectionType.Chips;
  label: string;
  items: string[];
};

export type TextSection = {
  type: SectionType.Text;
  label: string;
  text: string;
};

export type CardSection = ChipsSection | TextSection;

/** Normalised payload the UI renders. */
export type EntityCardData = {
  entity: {
    name: string;
    description: string;
    initials: string;
    kindLabel: string;
  };
  actions: { tryUrl?: string; editUrl?: string };
  sections: CardSection[];
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
 * @param name - entity name, e.g. `good-morning-breakfast`
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

const parseSection = (raw: unknown): CardSection | undefined => {
  if (!isRecord(raw) || !isNonEmptyString(raw.label)) return undefined;
  const label = raw.label.trim();
  switch (raw.type) {
    case SectionType.Chips: {
      const items = Array.isArray(raw.items)
        ? raw.items.filter(isNonEmptyString).map((item) => item.trim())
        : [];
      return items.length > 0
        ? { type: SectionType.Chips, label, items }
        : undefined;
    }
    case SectionType.Text:
      return isNonEmptyString(raw.text)
        ? { type: SectionType.Text, label, text: raw.text.trim() }
        : undefined;
    default:
      return undefined;
  }
};

const parseSections = (raw: unknown): CardSection[] =>
  Array.isArray(raw)
    ? raw
        .map(parseSection)
        .filter((section): section is CardSection => section !== undefined)
    : [];

/**
 * Validates and normalises the entity card tool payload. Unknown fields are
 * ignored; non-http(s) URLs are dropped so their buttons are not rendered.
 * @param raw - structured content from the tool result
 */
export const parseEntityCardPayload = (
  raw: unknown,
): ParseResult<EntityCardData> => {
  if (!isRecord(raw)) return fail('payload must be an object');
  const { entity } = raw;
  if (!isRecord(entity)) return fail('entity must be an object');
  if (!isNonEmptyString(entity.name))
    return fail('entity.name must be a non-empty string');
  if (!isNonEmptyString(entity.description)) {
    return fail('entity.description must be a non-empty string');
  }

  const actionRecord = isRecord(raw.actions) ? raw.actions : {};
  const tryUrl = safeUrl(actionRecord.tryUrl);
  const editUrl = safeUrl(actionRecord.editUrl);

  return {
    ok: true,
    data: {
      entity: {
        name: entity.name.trim(),
        description: entity.description.trim(),
        initials: isNonEmptyString(entity.initials)
          ? entity.initials.trim().slice(0, 3).toLocaleUpperCase()
          : deriveInitials(entity.name),
        kindLabel: isNonEmptyString(entity.kindLabel)
          ? entity.kindLabel.trim()
          : DEFAULT_KIND_LABEL,
      },
      actions: { ...(tryUrl && { tryUrl }), ...(editUrl && { editUrl }) },
      sections: parseSections(raw.sections),
    },
  };
};

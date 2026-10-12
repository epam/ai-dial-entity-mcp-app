import type { CoreRequest } from '../core/client.ts';

export const EntityKind = {
  Skill: 'skill',
  Agent: 'agent',
  Toolset: 'toolset',
  Prompt: 'prompt',
} as const;

export type EntityKind = (typeof EntityKind)[keyof typeof EntityKind];

export type CardSection =
  | { type: 'chips'; label: string; items: string[] }
  | { type: 'text'; label: string; text: string };

export type MappedEntity = {
  name: string;
  description: string;
  kindLabel: string;
  sections: CardSection[];
};

export type EntityContext = CoreRequest;

/**
 * A lightweight list entry. `names` are the strings a name search matches
 * against, best display name first. `raw` is present only when the list
 * response already carries everything `map` needs, so no detail call is
 * required.
 */
export type Candidate = {
  kind: EntityKind;
  id: string;
  names: string[];
  raw?: Record<string, unknown>;
};

export type EntityType = {
  kind: EntityKind;
  matchesId: (id: string) => boolean;
  fetch: (ctx: EntityContext, id: string) => Promise<Record<string, unknown>>;
  list: (ctx: EntityContext) => Promise<Candidate[]>;
  /**
   * Optional cheap listing that returns ids and names only, no record. A name
   * search tries it first and runs the full `list` only when nothing matched.
   */
  listNames?: (ctx: EntityContext) => Promise<Candidate[]>;
  map: (raw: Record<string, unknown>, activeLocale: string) => MappedEntity;
};

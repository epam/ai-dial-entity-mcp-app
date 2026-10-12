import { agentType } from './agent.ts';
import { promptType } from './prompt.ts';
import { skillType } from './skill.ts';
import { toolsetType } from './toolset.ts';
import type { EntityKind, EntityType } from './types.ts';

/**
 * Every entity type the tool can show. Adding a Core entity means adding its
 * module and one line here.
 */
export const ENTITY_TYPES: EntityType[] = [
  skillType,
  agentType,
  toolsetType,
  promptType,
];

/**
 * Looks up the registered type for a kind.
 * @param kind - entity kind
 */
export const entityTypeFor = (kind: EntityKind): EntityType => {
  const type = ENTITY_TYPES.find((candidate) => candidate.kind === kind);
  if (!type) throw new Error(`No entity type registered for ${kind}`);
  return type;
};

import type { ActionTemplates, ServerConfig } from '../config.ts';
import { pickField } from '../entities/shared.ts';
import { EntityKind } from '../entities/types.ts';

export type CardActions = { tryUrl?: string; editUrl?: string };

type Placeholders = { id: string; schemaId?: string };

/**
 * Renders a single action url from a template, substituting the url-encoded
 * id and, when known, the url-encoded application schema id.
 * Returns undefined when there is no template, when the template needs a
 * schema id that is missing, or when the resulting url is malformed or uses a
 * non-http(s) scheme.
 * @param template - url template with `{id}` and `{schemaId}` placeholders
 * @param values - values substituted into the placeholders
 */
const render = (
  template: string | undefined,
  values: Placeholders,
): string | undefined => {
  if (!template) return undefined;
  if (template.includes('{schemaId}') && !values.schemaId) return undefined;
  const url = template
    .replaceAll('{id}', encodeURIComponent(values.id))
    .replaceAll('{schemaId}', encodeURIComponent(values.schemaId ?? ''));
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
};

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Resolves a configured template against the Chat base URL: an absolute
 * template is used as given, a path starting with `/` is appended to the base
 * URL, and anything else yields nothing.
 * @param template - configured template
 * @param chatBaseUrl - `DIAL_CHAT_URL`, if configured
 */
export const resolveTemplate = (
  template: string | undefined,
  chatBaseUrl: string | undefined,
): string | undefined => {
  if (!template) return undefined;
  if (SCHEME.test(template)) return template;
  return template.startsWith('/') && chatBaseUrl
    ? `${chatBaseUrl}${template}`
    : undefined;
};

/**
 * Reads the application type schema id of an agent record, if it has one.
 * @param raw - the Core record of the entity
 */
const readSchemaId = (raw: Record<string, unknown>): string | undefined => {
  const value = pickField(
    raw,
    'application_type_schema_id',
    'applicationTypeSchemaId',
  );
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const EDIT_TEMPLATE: Record<EntityKind, keyof ActionTemplates> = {
  [EntityKind.Skill]: 'editSkill',
  [EntityKind.Prompt]: 'editPrompt',
  [EntityKind.Toolset]: 'editToolset',
  [EntityKind.Agent]: 'editAgent',
};

/**
 * Picks the configured Edit template for an entity: an agent with an
 * application type schema uses the schema template and never falls back to the
 * plain agent one.
 * @param templates - configured action templates
 * @param kind - entity kind
 * @param schemaId - the agent's application type schema id, if it has one
 */
const editTemplate = (
  templates: ActionTemplates,
  kind: EntityKind,
  schemaId?: string,
): string | undefined =>
  templates[
    kind === EntityKind.Agent && schemaId
      ? 'editAgentSchema'
      : EDIT_TEMPLATE[kind]
  ];

/**
 * Builds the card's action URLs from the templates configured per action and
 * entity type. A template is an absolute URL or a path appended to
 * `DIAL_CHAT_URL`. An unset or unusable template yields no URL, which the card
 * renders as no button; there are no built-in routes. Edit is only offered when
 * the caller owns the entity.
 * @param config - server configuration holding the base URL and templates
 * @param kind - entity kind
 * @param id - entity id, url-encoded and substituted for `{id}`
 * @param raw - the Core record, read for the agent's application type schema
 * @param canEdit - whether the caller owns the entity; without it there is no Edit url
 */
export const buildActions = (
  config: ServerConfig,
  kind: EntityKind,
  id: string,
  raw: Record<string, unknown> = {},
  canEdit = false,
): CardActions => {
  const schemaId = kind === EntityKind.Agent ? readSchemaId(raw) : undefined;
  const values = { id, schemaId };
  const { chatBaseUrl, actionTemplates } = config;
  const tryUrl =
    kind === EntityKind.Agent
      ? render(resolveTemplate(actionTemplates.tryAgent, chatBaseUrl), values)
      : undefined;
  const editUrl = canEdit
    ? render(
        resolveTemplate(
          editTemplate(actionTemplates, kind, schemaId),
          chatBaseUrl,
        ),
        values,
      )
    : undefined;
  return { ...(tryUrl && { tryUrl }), ...(editUrl && { editUrl }) };
};

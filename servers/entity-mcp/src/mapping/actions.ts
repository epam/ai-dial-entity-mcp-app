import type { ServerConfig } from '../config.ts';
import { pickField } from '../entities/shared.ts';
import { EntityKind } from '../entities/types.ts';

export type CardActions = { tryUrl?: string; editUrl?: string };

type Placeholders = { kind: string; id: string; schemaId?: string };

/*
 * Default Chat routes, appended to `DIAL_CHAT_URL`. They mirror the
 * routes DIAL Chat's catalog uses for Edit (`ROUTES` in ai-dial-chat). Try
 * relies on Chat's `?isolated-model-id` query parameter, which Chat marks for
 * removal: when it goes, replace the Try path here. Skills, prompts and
 * toolsets have no Try route.
 */
const TRY_PATHS: Partial<Record<EntityKind, string>> = {
  [EntityKind.Agent]: '/?isolated-model-id={id}',
};

const EDIT_PATHS: Record<EntityKind, string> = {
  [EntityKind.Skill]: '/skill-editor?id={id}',
  [EntityKind.Prompt]: '/prompt-editor?id={id}',
  [EntityKind.Toolset]: '/toolset-editor?id={id}',
  [EntityKind.Agent]: '/custom-app-editor?id={id}',
};

const SCHEMA_APP_EDIT_PATH = '/apps-editor?schema={schemaId}&appId={id}';

/**
 * Renders a single action url from a template, substituting the entity kind,
 * the url-encoded id and, when known, the url-encoded application schema id.
 * Returns undefined when there is no template, when the template needs a
 * schema id that is missing, or when the resulting url is malformed or uses a
 * non-http(s) scheme.
 * @param template - url template with `{kind}`, `{id}` and `{schemaId}` placeholders
 * @param values - values substituted into the placeholders
 */
const render = (
  template: string | undefined,
  values: Placeholders,
): string | undefined => {
  if (!template) return undefined;
  if (template.includes('{schemaId}') && !values.schemaId) return undefined;
  const url = template
    .replaceAll('{kind}', values.kind)
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
 * @param template - configured or default template
 * @param chatBaseUrl - `DIAL_CHAT_URL`, if configured
 */
const resolveTemplate = (
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

/**
 * Picks the Edit route for an entity: an agent built from an application type
 * schema opens the schema editor, every other agent opens the custom app editor.
 * @param kind - entity kind
 * @param schemaId - the agent's application type schema id, if it has one
 */
const editPath = (kind: EntityKind, schemaId?: string): string =>
  kind === EntityKind.Agent && schemaId
    ? SCHEMA_APP_EDIT_PATH
    : EDIT_PATHS[kind];

/**
 * Builds the card's action URLs. An explicit `ENTITY_TRY_URL_TEMPLATE` or
 * `ENTITY_EDIT_URL_TEMPLATE` replaces the default Chat route for the entity
 * kind; a template that is a path is appended to `DIAL_CHAT_URL`, an absolute
 * one is used as given. An unset or
 * unusable template yields no URL, which the card renders as no button.
 * @param config - server configuration holding the base URL and templates
 * @param kind - entity kind, substituted for `{kind}`
 * @param id - entity id, url-encoded and substituted for `{id}`
 * @param raw - the Core record, read for the agent's application type schema
 */
export const buildActions = (
  config: ServerConfig,
  kind: EntityKind,
  id: string,
  raw: Record<string, unknown> = {},
): CardActions => {
  const schemaId = kind === EntityKind.Agent ? readSchemaId(raw) : undefined;
  const values = { kind, id, schemaId };
  const { chatBaseUrl } = config;
  const tryUrl = render(
    resolveTemplate(config.tryUrlTemplate ?? TRY_PATHS[kind], chatBaseUrl),
    values,
  );
  const editUrl = render(
    resolveTemplate(
      config.editUrlTemplate ?? editPath(kind, schemaId),
      chatBaseUrl,
    ),
    values,
  );
  return { ...(tryUrl && { tryUrl }), ...(editUrl && { editUrl }) };
};

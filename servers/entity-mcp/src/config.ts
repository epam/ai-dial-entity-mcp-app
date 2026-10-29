import { resolveTemplate } from './mapping/actions.ts';

/**
 * Card button URL templates, one per action and entity type. A template is an
 * absolute URL or a path appended to `CHAT_BASE_URL`, with `{id}` and, for
 * `editAgentSchema`, `{schemaId}` placeholders. An unset template means no
 * button. `editAgentBySchema` maps an application type schema id to the Edit
 * template of agents with exactly that schema.
 */
export type ActionTemplates = {
  editSkill?: string;
  editPrompt?: string;
  editToolset?: string;
  editAgent?: string;
  editAgentSchema?: string;
  editAgentBySchema?: Record<string, string>;
  tryAgent?: string;
  trySkill?: string;
  tryPrompt?: string;
};

type SingleActionKey = Exclude<keyof ActionTemplates, 'editAgentBySchema'>;

export type ServerConfig = {
  coreBaseUrl: string;
  chatBaseUrl?: string;
  actionTemplates: ActionTemplates;
  port: number;
  appHtmlPath: string;
};

const DEFAULT_PORT = 8080;
const DEFAULT_APP_HTML = '../../../apps/entity-card/dist/index.html';
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const MAX_PORT = 65535;

export const ACTION_TEMPLATE_VARS: Record<SingleActionKey, string> = {
  editSkill: 'ENTITY_EDIT_URL_SKILL',
  editPrompt: 'ENTITY_EDIT_URL_PROMPT',
  editToolset: 'ENTITY_EDIT_URL_TOOLSET',
  editAgent: 'ENTITY_EDIT_URL_AGENT',
  editAgentSchema: 'ENTITY_EDIT_URL_AGENT_SCHEMA',
  tryAgent: 'ENTITY_TRY_URL_AGENT',
  trySkill: 'ENTITY_TRY_URL_SKILL',
  tryPrompt: 'ENTITY_TRY_URL_PROMPT',
};

const SCHEMA_ID_PREFIX = 'ENTITY_AGENT_SCHEMA_';
const SCHEMA_EDIT_PREFIX = 'ENTITY_EDIT_URL_AGENT_SCHEMA_';

const SCHEMA_KEY = /^[A-Za-z0-9_]+$/;

type SchemaEntry = { schemaId?: string; template?: string };

/**
 * Collects the per-schema variables by key: `ENTITY_AGENT_SCHEMA_<KEY>` holds
 * a schema id, `ENTITY_EDIT_URL_AGENT_SCHEMA_<KEY>` the Edit template for it.
 * A key is letters, digits and `_`; other names with these prefixes are
 * returned as `invalid`.
 * @param env - process environment to read from
 */
const readSchemaEntries = (
  env: NodeJS.ProcessEnv,
): { entries: Map<string, SchemaEntry>; invalid: string[] } => {
  const fields: [string, keyof SchemaEntry][] = [
    [SCHEMA_ID_PREFIX, 'schemaId'],
    [SCHEMA_EDIT_PREFIX, 'template'],
  ];
  const entries = new Map<string, SchemaEntry>();
  const invalid: string[] = [];
  for (const name of Object.keys(env).sort()) {
    const value = env[name]?.trim();
    const match = fields.find(([prefix]) => name.startsWith(prefix));
    if (!value || !match) continue;
    const key = name.slice(match[0].length);
    if (!SCHEMA_KEY.test(key)) {
      invalid.push(name);
    } else {
      entries.set(key, { ...entries.get(key), [match[1]]: value });
    }
  }
  return { entries, invalid };
};

/**
 * Reads the card button templates from their environment variables. A key
 * needs both its schema id and its template; two keys must not share a schema.
 * @param env - process environment to read from
 */
const loadActionTemplates = (env: NodeJS.ProcessEnv): ActionTemplates => {
  const single = Object.fromEntries(
    Object.entries(ACTION_TEMPLATE_VARS).flatMap(([key, name]) => {
      const value = env[name]?.trim();
      return value ? [[key, value]] : [];
    }),
  );
  const bySchema = new Map<string, { key: string; template: string }>();
  for (const [key, { schemaId, template }] of readSchemaEntries(env).entries) {
    if (!schemaId || !template) continue;
    const taken = bySchema.get(schemaId);
    if (taken) {
      throw new Error(
        `${SCHEMA_ID_PREFIX}${taken.key} and ${SCHEMA_ID_PREFIX}${key} both set the schema ${schemaId}`,
      );
    }
    bySchema.set(schemaId, { key, template });
  }
  return bySchema.size > 0
    ? {
        ...single,
        editAgentBySchema: Object.fromEntries(
          [...bySchema].map(([schemaId, { template }]) => [schemaId, template]),
        ),
      }
    : single;
};

/**
 * Validates that a base URL variable is a well-formed `http(s)` URL, throwing
 * a startup error naming the variable otherwise, and strips trailing slashes.
 * @param name - variable name, used in the error message
 * @param value - trimmed value of the variable
 */
const parseHttpBaseUrl = (name: string, value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL, got: ${value}`);
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https, got: ${value}`);
  }
  return value.replace(/\/+$/, '');
};

/**
 * Reads the server configuration from the environment. Credentials are
 * deliberately absent: the server forwards the caller's identity and never
 * holds one of its own.
 * @param env - process environment to read from
 */
export const loadConfig = (env: NodeJS.ProcessEnv): ServerConfig => {
  const coreBaseUrl = env.DIAL_CORE_URL?.trim();
  if (!coreBaseUrl) {
    throw new Error('DIAL_CORE_URL is required and was not set');
  }
  const port = Number(env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > MAX_PORT) {
    throw new Error(
      `PORT must be a positive integer no greater than ${MAX_PORT}, got ${env.PORT}`,
    );
  }
  const chatBaseUrl = env.CHAT_BASE_URL?.trim();
  if (chatBaseUrl && /[?#]/.test(chatBaseUrl)) {
    throw new Error(
      `CHAT_BASE_URL must not contain a query or fragment, got: ${chatBaseUrl}`,
    );
  }
  return {
    coreBaseUrl: parseHttpBaseUrl('DIAL_CORE_URL', coreBaseUrl),
    chatBaseUrl: chatBaseUrl
      ? parseHttpBaseUrl('CHAT_BASE_URL', chatBaseUrl)
      : undefined,
    actionTemplates: loadActionTemplates(env),
    port,
    appHtmlPath: env.APP_HTML?.trim() || DEFAULT_APP_HTML,
  };
};

const LEGACY_TEMPLATE_VARS: Record<string, string> = {
  ENTITY_EDIT_URL_TEMPLATE: 'ENTITY_EDIT_URL_<TYPE>',
  ENTITY_TRY_URL_TEMPLATE: 'ENTITY_TRY_URL_AGENT',
  DIAL_CHAT_URL: 'CHAT_BASE_URL',
};

/**
 * Lists startup problems that silently remove a card button: a template that
 * cannot be resolved (a path without `CHAT_BASE_URL`, or neither an absolute
 * URL nor a path starting with `/`), a per-schema key missing its schema id or
 * its template, and the removed variables.
 * @param config - loaded server configuration
 * @param env - process environment the configuration was read from
 */
export const findConfigWarnings = (
  config: ServerConfig,
  env: NodeJS.ProcessEnv,
): string[] => {
  const warnings = Object.entries(ACTION_TEMPLATE_VARS).flatMap(
    ([key, name]) => {
      const template = config.actionTemplates[key as SingleActionKey];
      if (!template || resolveTemplate(template, config.chatBaseUrl)) return [];
      return [
        `${name} is ignored: it must be an absolute http(s) URL, or a path starting with "/" with CHAT_BASE_URL set`,
      ];
    },
  );
  const { entries, invalid } = readSchemaEntries(env);
  for (const name of invalid) {
    warnings.push(
      `${name} is ignored: the key after the prefix must be letters, digits or "_"`,
    );
  }
  for (const [key, { schemaId, template }] of entries) {
    if (!schemaId || !template) {
      warnings.push(
        `${SCHEMA_ID_PREFIX}${key} and ${SCHEMA_EDIT_PREFIX}${key} must both be set; the agent Edit button for key ${key} is ignored`,
      );
    } else if (!resolveTemplate(template, config.chatBaseUrl)) {
      warnings.push(
        `${SCHEMA_EDIT_PREFIX}${key} is ignored: it must be an absolute http(s) URL, or a path starting with "/" with CHAT_BASE_URL set`,
      );
    }
  }
  for (const [legacy, replacement] of Object.entries(LEGACY_TEMPLATE_VARS)) {
    if (env[legacy]?.trim()) {
      warnings.push(`${legacy} is no longer supported, use ${replacement}`);
    }
  }
  return warnings;
};

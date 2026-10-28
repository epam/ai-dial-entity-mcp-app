import { resolveTemplate } from './mapping/actions.ts';

/**
 * Card button URL templates, one per action and entity type. A template is an
 * absolute URL or a path appended to `CHAT_BASE_URL`, with `{id}` and, for
 * `editAgentSchema`, `{schemaId}` placeholders. An unset template means no
 * button.
 */
export type ActionTemplates = {
  editSkill?: string;
  editPrompt?: string;
  editToolset?: string;
  editAgent?: string;
  editAgentSchema?: string;
  tryAgent?: string;
};

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

export const ACTION_TEMPLATE_VARS: Record<keyof ActionTemplates, string> = {
  editSkill: 'ENTITY_EDIT_URL_SKILL',
  editPrompt: 'ENTITY_EDIT_URL_PROMPT',
  editToolset: 'ENTITY_EDIT_URL_TOOLSET',
  editAgent: 'ENTITY_EDIT_URL_AGENT',
  editAgentSchema: 'ENTITY_EDIT_URL_AGENT_SCHEMA',
  tryAgent: 'ENTITY_TRY_URL_AGENT',
};

/**
 * Reads the card button templates from their environment variables.
 * @param env - process environment to read from
 */
const loadActionTemplates = (env: NodeJS.ProcessEnv): ActionTemplates =>
  Object.fromEntries(
    Object.entries(ACTION_TEMPLATE_VARS).flatMap(([key, name]) => {
      const value = env[name]?.trim();
      return value ? [[key, value]] : [];
    }),
  );

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
 * URL nor a path starting with `/`) and the removed variables.
 * @param config - loaded server configuration
 * @param env - process environment the configuration was read from
 */
export const findConfigWarnings = (
  config: ServerConfig,
  env: NodeJS.ProcessEnv,
): string[] => {
  const warnings = Object.entries(ACTION_TEMPLATE_VARS).flatMap(
    ([key, name]) => {
      const template = config.actionTemplates[key as keyof ActionTemplates];
      if (!template || resolveTemplate(template, config.chatBaseUrl)) return [];
      return [
        `${name} is ignored: it must be an absolute http(s) URL, or a path starting with "/" with CHAT_BASE_URL set`,
      ];
    },
  );
  for (const [legacy, replacement] of Object.entries(LEGACY_TEMPLATE_VARS)) {
    if (env[legacy]?.trim()) {
      warnings.push(`${legacy} is no longer supported, use ${replacement}`);
    }
  }
  return warnings;
};

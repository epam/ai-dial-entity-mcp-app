export type ServerConfig = {
  coreBaseUrl: string;
  tryUrlTemplate?: string;
  editUrlTemplate?: string;
  port: number;
  appHtmlPath: string;
};

const DEFAULT_PORT = 8080;
const DEFAULT_APP_HTML = '../../../apps/entity-card/dist/index.html';
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const MAX_PORT = 65535;

/**
 * Validates that `DIAL_CORE_URL` is a well-formed `http(s)` URL, throwing
 * a startup error naming the variable otherwise.
 * @param value - trimmed value of `DIAL_CORE_URL`
 */
const parseCoreBaseUrl = (value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `DIAL_CORE_URL must be an absolute http(s) URL, got: ${value}`,
    );
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`DIAL_CORE_URL must use http or https, got: ${value}`);
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
  return {
    coreBaseUrl: parseCoreBaseUrl(coreBaseUrl),
    tryUrlTemplate: env.ENTITY_TRY_URL_TEMPLATE?.trim() || undefined,
    editUrlTemplate: env.ENTITY_EDIT_URL_TEMPLATE?.trim() || undefined,
    port,
    appHtmlPath: env.APP_HTML?.trim() || DEFAULT_APP_HTML,
  };
};

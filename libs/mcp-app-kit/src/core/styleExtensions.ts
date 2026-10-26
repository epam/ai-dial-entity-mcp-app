import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';

/**
 * Host-context field carrying style variables beyond the MCP Apps standard
 * set. `styles.variables` rejects unknown names, so these travel beside it.
 */
export const STYLE_EXTENSIONS_KEY = 'styleExtensions';

/** Variables a host may send in `styleExtensions.variables`; all optional. */
export const STYLE_EXTENSION_VARIABLE_KEYS = [
  '--button-radius',
  '--button-radius-small',
  '--button-primary-gradient-start',
  '--button-primary-gradient-end',
  '--button-primary-gradient-hover-start',
  '--button-primary-gradient-hover-end',
  '--button-primary-gradient-active-start',
  '--button-primary-gradient-active-end',
  '--button-primary-text',
] as const;

export type StyleExtensionVariableKey =
  (typeof STYLE_EXTENSION_VARIABLE_KEYS)[number];

export type StyleExtensionVariables = Partial<
  Record<StyleExtensionVariableKey, string>
>;

/** Shape of the `styleExtensions` host-context field. */
export interface McpAppStyleExtensions {
  variables?: StyleExtensionVariables;
}

const ALLOWED_KEYS: ReadonlySet<string> = new Set(
  STYLE_EXTENSION_VARIABLE_KEYS,
);

/**
 * Reads the allowed, non-empty string variables from a host context's
 * `styleExtensions` field, ignoring unknown names and non-string values.
 * @param context - host context from `ui/initialize` or a context-changed notification
 */
export const readStyleExtensionVariables = (
  context: McpUiHostContext,
): StyleExtensionVariables => {
  const extensions = context[STYLE_EXTENSIONS_KEY] as
    McpAppStyleExtensions | undefined;
  const variables = extensions?.variables;
  if (!variables || typeof variables !== 'object') return {};
  return Object.fromEntries(
    Object.entries(variables).filter(
      ([name, value]) =>
        ALLOWED_KEYS.has(name) && typeof value === 'string' && value !== '',
    ),
  ) as StyleExtensionVariables;
};

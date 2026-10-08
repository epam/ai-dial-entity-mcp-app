import type { ServerConfig } from '../config.ts';
import type { EntityKind } from '../core/routing.ts';

export type CardActions = { tryUrl?: string; editUrl?: string };

/**
 * Renders a single action url from a template, substituting the entity kind
 * and url-encoded id. Returns undefined when there is no template, or when
 * the resulting url is malformed or uses a non-http(s) scheme.
 * @param template - url template with `{kind}` and `{id}` placeholders
 * @param kind - entity kind, substituted for `{kind}`
 * @param id - entity id, url-encoded and substituted for `{id}`
 */
const render = (
  template: string | undefined,
  kind: EntityKind,
  id: string,
): string | undefined => {
  if (!template) return undefined;
  const url = template
    .replaceAll('{kind}', kind)
    .replaceAll('{id}', encodeURIComponent(id));
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Builds the card's action URLs from the configured templates. An unset or
 * unusable template yields no URL, which the card renders as no button.
 * @param config - server configuration holding the templates
 * @param kind - entity kind, substituted for `{kind}`
 * @param id - entity id, url-encoded and substituted for `{id}`
 */
export const buildActions = (
  config: ServerConfig,
  kind: EntityKind,
  id: string,
): CardActions => {
  const tryUrl = render(config.tryUrlTemplate, kind, id);
  const editUrl = render(config.editUrlTemplate, kind, id);
  return { ...(tryUrl && { tryUrl }), ...(editUrl && { editUrl }) };
};

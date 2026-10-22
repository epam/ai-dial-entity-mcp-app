import {
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { ServerConfig } from '../config.ts';
import {
  CoreError,
  FALLBACK_MESSAGE,
  type CorrelationContext,
  type InboundCredential,
} from '../core/client.ts';
import { InvalidEntityId } from '../entities/ids.ts';
import { entityTypeFor } from '../entities/registry.ts';
import {
  resolveById,
  searchByName,
  type Resolved,
  type SearchOutcome,
} from '../entities/resolver.ts';
import { IncompleteEntity } from '../entities/shared.ts';
import { EntityKind } from '../entities/types.ts';
import { buildActions } from '../mapping/actions.ts';
import {
  RENDER_TOOL_DESCRIPTION,
  buildRenderedPayload,
  renderCardInputSchema,
} from './render-card.ts';

const RESOURCE_URI = 'ui://entity-card/index.html';
// DIAL Core rejects the spec's `text/html;profile=mcp-app` resource MIME type.
const RESOURCE_MIME_TYPE = 'text/html';
const DEFAULT_LOCALE = 'en';

const TOOL_DESCRIPTION =
  "Shows a card for a DIAL entity: a skill, agent, toolset or prompt. Always prefer `id`. If another tool, agent or system gave you the entity's id (for example `skills/{bucket}/{path}`, `prompts/{bucket}/{path}`, `toolsets/{bucket}/{path}` or an agent's deployment id), pass it as `id`: it is looked up directly and is always exactly that entity. Use `name` only when a person typed the name and you have no id. A name search is approximate and can be slower: a single match is shown even if the name matched only in part, so check that the card is the entity you meant; if several entities match, the result lists them with their ids and you call again with the chosen `id`. Add `kind` only when you know the entity type, to narrow the search.";
const ID_DESCRIPTION =
  "The exact entity id, taken from another tool's result, a link, or an earlier result of this tool. Always use it when you have it; no search is done.";
const NAME_DESCRIPTION =
  "Only when you have no id: the entity's name as a person wrote it (case, hyphens, underscores and spaces are ignored, and a partial name can match). If several entities match, the result lists them with their ids; call again with the chosen `id`.";
const KIND_DESCRIPTION =
  'Optional. Restricts a name search to one entity type. Omit it unless the user said which type they mean.';
const MAX_LISTED_MATCHES = 15;
const MAX_LISTED_TEXT = 100;
const USAGE_MESSAGE = 'Provide `id` (exact id) or `name` (entity name).';

/**
 * Renders a caller-controlled value for a log line, as a quoted JSON string
 * so embedded newlines or control characters can't forge extra log entries.
 * @param value - caller-controlled value to log
 */
const sanitizeForLog = (value: string): string => JSON.stringify(value);

export type BuildCardPayloadOptions = {
  config: ServerConfig;
  kind: EntityKind;
  id: string;
  raw: Record<string, unknown>;
  activeLocale: string;
};

/**
 * Builds the entity card payload from a Core record. `initials` is omitted
 * so the card derives them itself.
 * @param options - config, entity coordinates, the Core record and the locale
 */
export const buildCardPayload = (options: BuildCardPayloadOptions) => {
  const { config, kind, id, raw, activeLocale } = options;
  const mapped = entityTypeFor(kind).map(raw, activeLocale);
  return {
    entity: {
      name: mapped.name,
      description: mapped.description,
      kindLabel: mapped.kindLabel,
    },
    actions: buildActions(config, kind, id),
    sections: mapped.sections,
  };
};

/**
 * Builds an error tool result, which the app renders as its failed state.
 * @param text - message for the model and the host
 */
const errorResult = (text: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text }],
});

const clip = (value: string): string =>
  value.length > MAX_LISTED_TEXT
    ? `${value.slice(0, MAX_LISTED_TEXT)}…`
    : value;

/**
 * Builds the result for a name that matches several entities. The card shows
 * an error result's text to the user, so it reads for both the user and the
 * model. Names and ids are JSON-quoted so a decoded newline cannot add lines,
 * clipped to a short length, and the list is capped so a short query cannot
 * return hundreds of entries.
 * @param matches - the matching entities, with the ids to call again with
 */
const ambiguousResult = (
  matches: { kind: EntityKind; id: string; name: string }[],
): CallToolResult => {
  const shown = matches.slice(0, MAX_LISTED_MATCHES);
  const hidden = matches.length - shown.length;
  const more = hidden
    ? `\n...and ${hidden} more; use a more specific name to narrow it down.`
    : '';
  return errorResult(
    `Several entities match that name. Which one do you mean? Call show_entity_card again with the exact \`id\`:\n${shown
      .map(
        (match) =>
          `- ${match.kind} ${JSON.stringify(clip(match.name))}: ${JSON.stringify(clip(match.id))}`,
      )
      .join('\n')}${more}`,
  );
};

/**
 * Builds the result for a name that matches nothing, noting any entity type
 * whose list could not be read.
 * @param outcome - the search outcome with the searched and skipped types
 */
const notFoundResult = (
  outcome: Extract<SearchOutcome, { status: 'not_found' }>,
): CallToolResult => {
  const skipped = outcome.skipped.length
    ? ` These types could not be searched: ${outcome.skipped.join(', ')}.`
    : '';
  return errorResult(
    `No entity with that name was found among the ${outcome.searched.join(', ')} entities you can access.${skipped}`,
  );
};

/**
 * Creates an MCP server exposing the entity card tool and its UI resource.
 * A new one is made per request because the transport is stateless.
 * @param config - server configuration
 * @param appHtml - the built card, inlined as the resource body
 * @param credential - the caller's forwarded credential, if any
 * @param correlation - the correlation id established for this request
 */
export const createMcpServer = (
  config: ServerConfig,
  appHtml: string,
  credential: InboundCredential | undefined,
  correlation: CorrelationContext,
): McpServer => {
  const server = new McpServer({ name: 'entity-mcp', version: '0.0.0' });

  registerAppTool(
    server,
    'show_entity_card',
    {
      title: 'Show entity card',
      description: TOOL_DESCRIPTION,
      inputSchema: {
        id: z.string().optional().describe(ID_DESCRIPTION),
        name: z.string().optional().describe(NAME_DESCRIPTION),
        kind: z.enum(EntityKind).optional().describe(KIND_DESCRIPTION),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ id, name, kind }) => {
      const trimmedId = id?.trim() ?? '';
      const trimmedName = name?.trim() ?? '';
      const startedAt = Date.now();
      const correlationLabel = sanitizeForLog(correlation.correlationId);
      if (!credential) {
        return errorResult(
          'This tool needs your DIAL identity, which was not forwarded with the request.',
        );
      }
      if (!trimmedId && !trimmedName) return errorResult(USAGE_MESSAGE);
      const subject = trimmedId
        ? `${kind ?? 'entity'} ${sanitizeForLog(trimmedId)}`
        : `name ${sanitizeForLog(trimmedName)}`;
      const ctx = { config, credential, correlation };
      try {
        let resolved: Resolved;
        let notSearched = '';
        if (trimmedId) {
          resolved = await resolveById(ctx, trimmedId, kind);
        } else {
          const outcome = await searchByName(ctx, trimmedName, kind);
          if (outcome.status === 'ambiguous') {
            console.log(
              `show_entity_card found ${outcome.matches.length} matches for ${subject} in ${Date.now() - startedAt}ms (correlation ${correlationLabel})`,
            );
            return ambiguousResult(outcome.matches);
          }
          if (outcome.status === 'not_found') {
            console.log(
              `show_entity_card found no match for ${subject} in ${Date.now() - startedAt}ms (correlation ${correlationLabel})`,
            );
            return notFoundResult(outcome);
          }
          resolved = outcome.resolved;
          if (outcome.skipped?.length) {
            notSearched = ` (not searched: ${outcome.skipped.join(', ')})`;
          }
        }
        const payload = buildCardPayload({
          config,
          kind: resolved.kind,
          id: resolved.id,
          raw: resolved.raw,
          activeLocale: DEFAULT_LOCALE,
        });
        console.log(
          `show_entity_card succeeded for ${resolved.kind} ${sanitizeForLog(resolved.id)} in ${Date.now() - startedAt}ms (correlation ${correlationLabel})${notSearched}`,
        );
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        if (error instanceof CoreError) {
          console.error(
            `show_entity_card failed for ${subject} in ${durationMs}ms (correlation ${correlationLabel}): ${error.message}`,
          );
          return errorResult(error.userMessage);
        }
        if (error instanceof IncompleteEntity) {
          console.error(
            `show_entity_card failed for ${subject} in ${durationMs}ms (correlation ${correlationLabel}): ${error.message}`,
          );
          return errorResult(error.userMessage);
        }
        if (error instanceof InvalidEntityId) {
          console.error(
            `show_entity_card failed for ${subject} in ${durationMs}ms (correlation ${correlationLabel}): ${sanitizeForLog(error.message)}`,
          );
          return errorResult(error.userMessage);
        }
        console.error(
          `show_entity_card failed for ${subject} in ${durationMs}ms (correlation ${correlationLabel}) with an unexpected error:`,
          error,
        );
        return errorResult(FALLBACK_MESSAGE);
      }
    },
  );

  registerAppTool(
    server,
    'render_entity_card',
    {
      title: 'Render entity card',
      description: RENDER_TOOL_DESCRIPTION,
      inputSchema: renderCardInputSchema,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    (input) => {
      const payload = buildRenderedPayload(input);
      console.log(
        `render_entity_card succeeded (correlation ${sanitizeForLog(correlation.correlationId)})`,
      );
      return {
        structuredContent: payload,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    },
  );

  registerAppResource(
    server,
    'Entity card',
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: appHtml },
      ],
    }),
  );

  return server;
};

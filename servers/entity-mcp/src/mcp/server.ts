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
  fetchEntity,
  type InboundCredential,
} from '../core/client.ts';
import { EntityKind, InvalidEntityId } from '../core/routing.ts';
import { buildActions } from '../mapping/actions.ts';
import { IncompleteEntity, mapAgent, mapSkill } from '../mapping/entity.ts';

const RESOURCE_URI = 'ui://entity-card/index.html';
// DIAL Core rejects the spec's `text/html;profile=mcp-app` resource MIME type.
const RESOURCE_MIME_TYPE = 'text/html';
const DEFAULT_LOCALE = 'en';

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
 * Builds the entity card payload from a Core record. `sections` is empty in
 * v1 and `initials` is omitted so the card derives them itself.
 * @param options - config, entity coordinates, the Core record and the locale
 */
export const buildCardPayload = (options: BuildCardPayloadOptions) => {
  const { config, kind, id, raw, activeLocale } = options;
  const mapped =
    kind === EntityKind.Skill ? mapSkill(raw) : mapAgent(raw, activeLocale);
  return {
    entity: {
      name: mapped.name,
      description: mapped.description,
      kindLabel: mapped.kindLabel,
    },
    actions: buildActions(config, kind, id),
    sections: [] as [],
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

/**
 * Creates an MCP server exposing the entity card tool and its UI resource.
 * A new one is made per request because the transport is stateless.
 * @param config - server configuration
 * @param appHtml - the built card, inlined as the resource body
 * @param credential - the caller's forwarded credential, if any
 */
export const createMcpServer = (
  config: ServerConfig,
  appHtml: string,
  credential: InboundCredential | undefined,
): McpServer => {
  const server = new McpServer({ name: 'entity-mcp', version: '0.0.0' });

  registerAppTool(
    server,
    'show_entity_card',
    {
      title: 'Show entity card',
      description:
        'Shows a card for a DIAL skill or agent. `kind` selects the entity type; `id` is the exact entity id — `skills/{bucket}/{path}` for a skill, the deployment id for an agent.',
      inputSchema: {
        kind: z.enum([EntityKind.Skill, EntityKind.Agent]),
        id: z.string().min(1),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ kind, id }) => {
      const trimmedId = id.trim();
      if (!credential) {
        return errorResult(
          'This tool needs your DIAL identity, which was not forwarded with the request.',
        );
      }
      try {
        const raw = await fetchEntity({
          config,
          kind,
          id: trimmedId,
          credential,
        });
        const payload = buildCardPayload({
          config,
          kind,
          id: trimmedId,
          raw,
          activeLocale: DEFAULT_LOCALE,
        });
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      } catch (error) {
        if (error instanceof CoreError) {
          console.error(
            `show_entity_card failed for ${kind} ${sanitizeForLog(trimmedId)}: ${error.message}`,
          );
          return errorResult(error.userMessage);
        }
        if (error instanceof IncompleteEntity) {
          console.error(
            `show_entity_card failed for ${kind} ${sanitizeForLog(trimmedId)}: ${error.message}`,
          );
          return errorResult(error.userMessage);
        }
        if (error instanceof InvalidEntityId) {
          console.error(
            `show_entity_card failed for ${kind} ${sanitizeForLog(trimmedId)}: ${error.message}`,
          );
          return errorResult(error.userMessage);
        }
        console.error(
          `show_entity_card failed for ${kind} ${sanitizeForLog(trimmedId)} with an unexpected error:`,
          error,
        );
        return errorResult(FALLBACK_MESSAGE);
      }
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

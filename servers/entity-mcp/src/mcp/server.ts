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
import { isOwnEntity } from '../entities/ownership.ts';
import { entityTypeFor } from '../entities/registry.ts';
import { findCandidates, resolveById } from '../entities/resolver.ts';
import { IncompleteEntity } from '../entities/shared.ts';
import { EntityKind } from '../entities/types.ts';
import { buildActions } from '../mapping/actions.ts';
import { logger } from '../telemetry/logger.ts';
import { createProbe, type McpProbe } from '../telemetry/mcp-metrics.ts';
import {
  FIND_NAME_DESCRIPTION,
  FIND_TOOL_DESCRIPTION,
  SHOW_TOOL_NAME,
  buildFindResult,
} from './find-entities.ts';

const FIND_TOOL_NAME = 'find_entities';

/** The tools this server registers; telemetry labels any other name `unknown`. */
export const REGISTERED_TOOL_NAMES: ReadonlySet<string> = new Set([
  FIND_TOOL_NAME,
  SHOW_TOOL_NAME,
]);

const RESOURCE_URI = 'ui://entity-card/index.html';
// DIAL Core rejects the spec's `text/html;profile=mcp-app` resource MIME type.
const RESOURCE_MIME_TYPE = 'text/html';
const DEFAULT_LOCALE = 'en';
const NO_CREDENTIAL_MESSAGE =
  'This tool needs your DIAL identity, which was not forwarded with the request. An admin must enable forward_auth_token on the toolset and on the quick app that uses it.';

const SHOW_TOOL_DESCRIPTION =
  'Shows the card of one DIAL entity (skill, agent, toolset or prompt), read by its exact id. Use it when you have the id: from the user, a link, another tool, or `find_entities`. It does not search and does not accept a name: if you only have a name, call `find_entities` first, and never make up an id. Pass `kind` when you know the entity type. The card is already shown to the user when this tool returns, so do not repeat its contents (name, description, sections, links) in your reply; at most add one short sentence.';
const ID_DESCRIPTION =
  "The exact entity id, for example `skills/{bucket}/{path}`, `prompts/{bucket}/{path}`, `toolsets/{bucket}/{path}` or an agent's deployment id. Copy it unchanged from its source; never construct one.";
const KIND_DESCRIPTION =
  'Optional entity type. Pass it when you know it; a bare id is otherwise tried as an agent, then as a toolset.';
const FIND_KIND_DESCRIPTION =
  'Optional. Restricts the search to one entity type. Omit it unless the user said which type they mean.';
const SHOW_USAGE_MESSAGE = `Provide the exact id of the entity. If you only have a name, call find_entities first.`;
const FIND_USAGE_MESSAGE = 'Provide the entity name to search for.';

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
  canEdit: boolean;
};

/**
 * Builds the entity card payload from a Core record. `initials` is omitted
 * so the card derives them itself.
 * @param options - config, entity coordinates, the Core record, the locale and whether the caller owns the entity
 */
export const buildCardPayload = (options: BuildCardPayloadOptions) => {
  const { config, kind, id, raw, activeLocale, canEdit } = options;
  const mapped = entityTypeFor(kind).map(raw, activeLocale);
  return {
    entity: {
      name: mapped.name,
      description: mapped.description,
      kindLabel: mapped.kindLabel,
    },
    actions: buildActions(config, kind, id, raw, canEdit),
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

/**
 * Builds a successful tool result carrying the card payload as structured
 * content, with the same JSON as text for hosts that only read content.
 * @param payload - the card payload to return
 */
const cardResult = (payload: object): CallToolResult => ({
  structuredContent: { ...payload },
  content: [{ type: 'text', text: JSON.stringify(payload) }],
});

/**
 * Maps a failure to the tool result the model sees, and logs it with the
 * correlation id. Core and entity errors carry their own fixed user messages;
 * anything else gets the generic fallback.
 * @param tool - tool name, for the log line
 * @param subject - already sanitised description of what was requested
 * @param error - the thrown error
 * @param startedAt - when the call started, in epoch milliseconds
 * @param correlationLabel - already sanitised correlation id
 */
const failureResult = (
  tool: string,
  subject: string,
  error: unknown,
  startedAt: number,
  correlationLabel: string,
): CallToolResult => {
  const durationMs = Date.now() - startedAt;
  const prefix = `${tool} failed for ${subject} in ${durationMs}ms (correlation ${correlationLabel})`;
  if (error instanceof CoreError || error instanceof IncompleteEntity) {
    logger.error(`${prefix}: ${error.message}`);
    return errorResult(error.userMessage);
  }
  if (error instanceof InvalidEntityId) {
    logger.error(`${prefix}: ${sanitizeForLog(error.message)}`);
    return errorResult(error.userMessage);
  }
  logger.error(`${prefix} with an unexpected error:`, error);
  return errorResult(FALLBACK_MESSAGE);
};

/**
 * Creates an MCP server exposing the entity search tool, the entity card tool
 * and the card's UI resource.
 * A new one is made per request because the transport is stateless.
 * @param config - server configuration
 * @param appHtml - the built card, inlined as the resource body
 * @param credential - the caller's forwarded credential, if any
 * @param correlation - the correlation id established for this request
 * @param probe - records whether a tool ran and failed, for request metrics
 */
export const createMcpServer = (
  config: ServerConfig,
  appHtml: string,
  credential: InboundCredential | undefined,
  correlation: CorrelationContext,
  probe: McpProbe = createProbe(),
): McpServer => {
  const server = new McpServer({ name: 'entity-mcp', version: '0.0.0' });

  const tracked =
    <Args>(handler: (args: Args) => Promise<CallToolResult>) =>
    async (args: Args): Promise<CallToolResult> => {
      probe.toolCalled = true;
      probe.toolFailed = true;
      const result = await handler(args);
      probe.toolFailed = result.isError === true;
      return result;
    };

  const ctxFor = (forwarded: InboundCredential) => ({
    config,
    credential: forwarded,
    correlation,
  });
  const correlationLabel = sanitizeForLog(correlation.correlationId);

  server.registerTool(
    FIND_TOOL_NAME,
    {
      title: 'Find entities',
      description: FIND_TOOL_DESCRIPTION,
      inputSchema: {
        name: z.string().describe(FIND_NAME_DESCRIPTION),
        kind: z.enum(EntityKind).optional().describe(FIND_KIND_DESCRIPTION),
      },
    },
    tracked(async ({ name, kind }) => {
      const trimmedName = name.trim();
      const startedAt = Date.now();
      if (!credential) return errorResult(NO_CREDENTIAL_MESSAGE);
      if (!trimmedName) return errorResult(FIND_USAGE_MESSAGE);
      const subject = `name ${sanitizeForLog(trimmedName)}`;
      try {
        const outcome = await findCandidates(
          ctxFor(credential),
          trimmedName,
          kind,
        );
        const found =
          outcome.status === 'found'
            ? `${outcome.matches.length} matches (${outcome.exact ? 'exact' : 'partial'})`
            : 'no match';
        logger.info(
          `find_entities found ${found} for ${subject} in ${Date.now() - startedAt}ms (correlation ${correlationLabel})`,
        );
        return buildFindResult(trimmedName, outcome);
      } catch (error) {
        return failureResult(
          'find_entities',
          subject,
          error,
          startedAt,
          correlationLabel,
        );
      }
    }),
  );

  registerAppTool(
    server,
    SHOW_TOOL_NAME,
    {
      title: 'Show entity card',
      description: SHOW_TOOL_DESCRIPTION,
      inputSchema: {
        id: z.string().describe(ID_DESCRIPTION),
        kind: z.enum(EntityKind).optional().describe(KIND_DESCRIPTION),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    tracked(async ({ id, kind }) => {
      const trimmedId = id.trim();
      const startedAt = Date.now();
      if (!credential) return errorResult(NO_CREDENTIAL_MESSAGE);
      if (!trimmedId) return errorResult(SHOW_USAGE_MESSAGE);
      const subject = `${kind ?? 'entity'} ${sanitizeForLog(trimmedId)}`;
      const ctx = ctxFor(credential);
      try {
        const resolved = await resolveById(ctx, trimmedId, kind);
        const payload = buildCardPayload({
          config,
          kind: resolved.kind,
          id: resolved.id,
          raw: resolved.raw,
          activeLocale: DEFAULT_LOCALE,
          canEdit: await isOwnEntity(ctx, resolved.id),
        });
        logger.info(
          `show_entity_card succeeded for ${resolved.kind} ${sanitizeForLog(resolved.id)} in ${Date.now() - startedAt}ms (correlation ${correlationLabel})`,
        );
        return cardResult(payload);
      } catch (error) {
        return failureResult(
          SHOW_TOOL_NAME,
          subject,
          error,
          startedAt,
          correlationLabel,
        );
      }
    }),
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

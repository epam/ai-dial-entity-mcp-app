import type { ServerResponse } from 'node:http';
import {
  SpanStatusCode,
  metrics,
  trace,
  type Attributes,
} from '@opentelemetry/api';

export const McpOutcome = {
  Ok: 'ok',
  ToolError: 'tool_error',
  Unauthorized: 'unauthorized',
  Error: 'error',
} as const;

export type McpOutcome = (typeof McpOutcome)[keyof typeof McpOutcome];

/** Label value for a method or tool name that is not in the known sets. */
export const UNKNOWN_LABEL = 'unknown';
/** Label value for `tool` on a method that is not a tool call. */
export const NO_TOOL_LABEL = 'none';

/**
 * JSON-RPC methods an MCP client can send. Anything else is labelled
 * `unknown`, so a client cannot create metric series with its own strings.
 */
const KNOWN_METHODS = new Set([
  'initialize',
  'ping',
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/read',
  'resources/templates/list',
  'resources/subscribe',
  'resources/unsubscribe',
  'prompts/list',
  'prompts/get',
  'completion/complete',
  'logging/setLevel',
  'notifications/initialized',
  'notifications/cancelled',
  'notifications/progress',
  'notifications/roots/list_changed',
]);

const ATTR_METHOD = 'mcp.method.name';
const ATTR_TOOL = 'mcp.tool.name';
const ATTR_OUTCOME = 'mcp.outcome';
const BATCH_LABEL = 'batch';
const METER_NAME = 'ai-dial-entity-mcp-server';

/**
 * Runs telemetry work so a failure in it can never reach the request path.
 * @param work - the metric or span call to run
 */
const safely = (work: () => void): void => {
  try {
    work();
  } catch {
    // Telemetry is best effort: dropping a data point beats failing a request.
  }
};

/** The bounded labels of one MCP request. */
export type McpLabels = { method: string; tool: string };

/**
 * Derives the bounded `method` and `tool` labels from a parsed request body.
 * A method outside the known set becomes `unknown`; a tool name outside
 * `knownTools` becomes `unknown`; a batch becomes `batch`. Raw client strings
 * are never returned.
 * @param body - parsed JSON-RPC body, or undefined when there is none
 * @param knownTools - names of the tools this server registers
 */
export const labelMcpRequest = (
  body: unknown,
  knownTools: ReadonlySet<string>,
): McpLabels => {
  if (Array.isArray(body)) {
    return { method: BATCH_LABEL, tool: NO_TOOL_LABEL };
  }
  if (typeof body !== 'object' || body === null || !('method' in body)) {
    return { method: UNKNOWN_LABEL, tool: NO_TOOL_LABEL };
  }
  const method =
    typeof body.method === 'string' && KNOWN_METHODS.has(body.method)
      ? body.method
      : UNKNOWN_LABEL;
  if (method !== 'tools/call') return { method, tool: NO_TOOL_LABEL };
  const params = 'params' in body ? body.params : undefined;
  const name =
    typeof params === 'object' && params !== null && 'name' in params
      ? params.name
      : undefined;
  return {
    method,
    tool:
      typeof name === 'string' && knownTools.has(name) ? name : UNKNOWN_LABEL,
  };
};

const instruments = () => {
  const meter = metrics.getMeter(METER_NAME);
  return {
    requests: meter.createCounter('mcp.server.requests', {
      description:
        'MCP requests handled, by JSON-RPC method, tool and outcome.',
      unit: '{request}',
    }),
    duration: meter.createHistogram('mcp.server.request.duration', {
      description:
        'Duration of MCP requests, by JSON-RPC method, tool and outcome.',
      unit: 's',
    }),
    coreDuration: meter.createHistogram('dial.core.client.duration', {
      description: 'Duration of outbound DIAL Core calls, by outcome.',
      unit: 's',
    }),
  };
};

/**
 * What one MCP request recorded, so the HTTP layer can tell a tool that ran
 * and failed apart from one that succeeded.
 */
export type McpProbe = { toolCalled: boolean; toolFailed: boolean };

/** Creates a fresh probe for one request. */
export const createProbe = (): McpProbe => ({
  toolCalled: false,
  toolFailed: false,
});

/** One observed MCP request: records its metrics once, whichever path ends it. */
export type McpObservation = {
  /** Sets the labels from the parsed body and tags the active span. */
  setBody: (body: unknown) => void;
  /** Records the request, once; later calls are ignored. */
  finish: (outcome: McpOutcome) => void;
  /** Records the request from what the transport wrote and the tools reported. */
  finishResponse: (statusCode: number, completed: boolean) => void;
  probe: McpProbe;
};

/**
 * Starts observing one `/mcp` request. Metrics go to the global meter, so with
 * the SDK disabled this is a no-op. Attaches the same attributes to the active
 * server span.
 * @param knownTools - names of the tools this server registers
 */
export const observeMcpRequest = (
  knownTools: ReadonlySet<string>,
): McpObservation => {
  const startedAt = performance.now();
  const span = trace.getActiveSpan();
  const probe = createProbe();
  let labels: McpLabels = { method: UNKNOWN_LABEL, tool: NO_TOOL_LABEL };
  let finished = false;
  const finish = (outcome: McpOutcome) => safely(() => record(outcome));
  const record = (outcome: McpOutcome) => {
    if (finished) return;
    finished = true;
    const attributes: Attributes = {
      [ATTR_METHOD]: labels.method,
      [ATTR_TOOL]: labels.tool,
      [ATTR_OUTCOME]: outcome,
    };
    const { requests, duration } = instruments();
    requests.add(1, attributes);
    duration.record((performance.now() - startedAt) / 1000, attributes);
    span?.setAttribute(ATTR_OUTCOME, outcome);
    if (outcome === McpOutcome.Error) {
      span?.setStatus({ code: SpanStatusCode.ERROR });
    }
  };
  return {
    probe,
    finish,
    finishResponse: (statusCode, completed) =>
      safely(() =>
        record(resolveOutcome(labels, probe, statusCode, completed)),
      ),
    setBody: (body) =>
      safely(() => {
        labels = labelMcpRequest(body, knownTools);
        span?.setAttributes({
          [ATTR_METHOD]: labels.method,
          [ATTR_TOOL]: labels.tool,
        });
      }),
  };
};

/**
 * Records the observation when the response ends. `res.end` is wrapped so this
 * runs before the HTTP instrumentation ends the server span and the span can
 * still take the outcome attribute; `close` covers a connection dropped before
 * the response was written.
 * @param observation - the request's observation
 * @param res - the response being written
 */
export const finishWithResponse = (
  observation: McpObservation,
  res: ServerResponse,
): void => {
  const end = res.end.bind(res) as (...args: unknown[]) => ServerResponse;
  res.end = ((...args: unknown[]) => {
    observation.finishResponse(res.statusCode, true);
    return end(...args);
  }) as typeof res.end;
  res.once('close', () => observation.finishResponse(res.statusCode, false));
};

/**
 * Decides the outcome of a request that reached the MCP transport.
 * @param labels - the request's labels
 * @param probe - what the tool handlers recorded
 * @param statusCode - HTTP status written
 * @param completed - whether the response was fully written before it closed
 */
export const resolveOutcome = (
  labels: McpLabels,
  probe: McpProbe,
  statusCode: number,
  completed: boolean,
): McpOutcome => {
  if (statusCode === 401) return McpOutcome.Unauthorized;
  if (statusCode >= 400 || !completed) return McpOutcome.Error;
  if (labels.method === UNKNOWN_LABEL) return McpOutcome.Error;
  if (labels.method !== 'tools/call') return McpOutcome.Ok;
  if (!probe.toolCalled) return McpOutcome.Error;
  return probe.toolFailed ? McpOutcome.ToolError : McpOutcome.Ok;
};

/**
 * Records one outbound DIAL Core call. Path, query and entity ids are never
 * attributes.
 * @param seconds - call duration in seconds
 * @param outcome - `ok`, `http_error`, `timeout` or `error`
 * @param statusCode - Core's HTTP status for an `http_error`
 */
export const recordCoreCall = (
  seconds: number,
  outcome: 'ok' | 'http_error' | 'timeout' | 'error',
  statusCode?: number,
): void => {
  safely(() =>
    instruments().coreDuration.record(seconds, {
      'dial.core.outcome': outcome,
      ...(statusCode === undefined
        ? {}
        : { 'http.response.status_code': statusCode }),
    }),
  );
};

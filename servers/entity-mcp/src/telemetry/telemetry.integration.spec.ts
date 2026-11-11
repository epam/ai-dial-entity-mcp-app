import { createRequire } from 'node:module';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SpanKind, context, metrics, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type DataPoint,
} from '@opentelemetry/sdk-metrics';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { buildInstrumentations } from './sdk.ts';

const SECRET = 'Bearer s3cr3t-token-value';
const COOKIE = 'session=cookie-secret-value';
const config = {
  coreBaseUrl: '',
  port: 0,
  appHtmlPath: 'x',
  actionTemplates: {},
};

const spanExporter = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.DELTA);
const reader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 3_600_000,
});
const instrumentations = buildInstrumentations();

const readPoints = async (name: string) => {
  await reader.forceFlush();
  return metricExporter
    .getMetrics()
    .flatMap((batch) => batch.scopeMetrics)
    .flatMap((scope) => scope.metrics)
    .filter((metric) => metric.descriptor.name === name)
    .flatMap((metric) => metric.dataPoints as DataPoint<unknown>[]);
};

describe('MCP telemetry through the real request handler', () => {
  let baseUrl = '';
  let server: Server;
  let core: Server;

  beforeAll(async () => {
    context.setGlobalContextManager(
      new AsyncLocalStorageContextManager().enable(),
    );
    trace.setGlobalTracerProvider(
      new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(spanExporter)],
      }),
    );
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
    instrumentations.forEach((instrumentation) => instrumentation.enable());
    const http = createRequire(import.meta.url)(
      'node:http',
    ) as typeof import('node:http');
    server = http.createServer();
    core = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end('[]');
    });
    await new Promise<void>((done) => core.listen(0, '127.0.0.1', done));
    config.coreBaseUrl = `http://127.0.0.1:${(core.address() as AddressInfo).port}`;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { createRequestHandler } = await import('../handler.ts');
    server.on('request', createRequestHandler(config, '<html></html>'));
    await new Promise<void>((done) => server.listen(0, done));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    instrumentations.forEach((instrumentation) => instrumentation.disable());
    server.closeAllConnections();
    core.closeAllConnections();
    await new Promise((done) => server.close(done));
    await new Promise((done) => core.close(done));
    await reader.shutdown();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    spanExporter.reset();
    metricExporter.reset();
  });

  const post = async (body: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify(body),
    });
    await response.text();
    return response;
  };

  test('counts a credential-less tools/call as unauthorized under the bounded labels', async () => {
    const response = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'made-up-by-client', arguments: {} },
    });
    expect(response.status).toBe(401);

    const points = await readPoints('mcp.server.requests');
    expect(points.map((point) => point.attributes)).toContainEqual({
      'mcp.method.name': 'tools/call',
      'mcp.tool.name': 'unknown',
      'mcp.outcome': 'unauthorized',
    });
    const span = spanExporter
      .getFinishedSpans()
      .find((candidate) => candidate.attributes['mcp.outcome']);
    expect(span?.attributes).toMatchObject({
      'mcp.method.name': 'tools/call',
      'mcp.tool.name': 'unknown',
      'mcp.outcome': 'unauthorized',
    });
  });

  test('counts a served tools/list as ok and records its duration', async () => {
    expect(
      (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).status,
    ).toBe(200);
    const durations = await readPoints('mcp.server.request.duration');
    expect(durations.map((point) => point.attributes)).toContainEqual({
      'mcp.method.name': 'tools/list',
      'mcp.tool.name': 'none',
      'mcp.outcome': 'ok',
    });
  });

  test('produces no span and no MCP metric for /health', async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { authorization: SECRET },
    });
    expect(response.status).toBe(200);
    expect(
      spanExporter
        .getFinishedSpans()
        .filter((span) => span.kind === SpanKind.SERVER),
    ).toEqual([]);
    expect(await readPoints('mcp.server.requests')).toEqual([]);
  });

  test('never puts a request header value into a span or metric attribute', async () => {
    await post(
      { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      {
        authorization: SECRET,
        cookie: COOKIE,
        'x-correlation-id': 'correlation-secret',
      },
    );
    await post(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'find_entities', arguments: { name: 'user-input' } },
      },
      { authorization: SECRET, cookie: COOKIE },
    );
    await reader.forceFlush();

    const spans = spanExporter.getFinishedSpans();
    expect(spans.length).toBeGreaterThan(0);
    const corePort = new URL(config.coreBaseUrl).port;
    expect(
      spans.some(
        (span) =>
          span.kind === SpanKind.CLIENT &&
          String(span.attributes['server.port']) === corePort,
      ),
    ).toBe(true);
    const metricAttributes = metricExporter
      .getMetrics()
      .flatMap((batch) => batch.scopeMetrics)
      .flatMap((scope) => scope.metrics)
      .flatMap((metric) => metric.dataPoints as DataPoint<unknown>[])
      .map((point) => point.attributes);
    const everything = JSON.stringify([
      spans.map((span) => ({
        name: span.name,
        attributes: span.attributes,
        events: span.events,
        resource: span.resource.attributes,
      })),
      metricAttributes,
    ]);
    for (const secret of [
      SECRET,
      's3cr3t-token-value',
      COOKIE,
      'cookie-secret-value',
      'correlation-secret',
      'user-input',
    ]) {
      expect(everything).not.toContain(secret);
    }
    expect(
      spans.flatMap((span) => Object.keys(span.attributes)),
    ).not.toContainEqual(expect.stringMatching(/header/i));
  });
});

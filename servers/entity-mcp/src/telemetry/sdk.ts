import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import {
  resourceFromAttributes,
  type Resource,
} from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  type LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  PeriodicExportingMetricReader,
  type IMetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
  MetricsExporter,
  METRICS_ENDPOINT,
  SingleSignalExporter,
  parseOtelConfig,
  type OtelConfig,
} from './config.ts';
import { isExcludedFromTelemetry } from './excluded-paths.ts';
import { setLogExport } from './logger.ts';
import { onShutdown } from './shutdown.ts';

const DEFAULT_SERVICE_NAME = 'ai-dial-entity-mcp-server';

type PackageInfo = { name?: string; version?: string };

/**
 * Reads the nearest `package.json` above `src/`. In the image that is the root
 * manifest, whose version the release workflow stamps; in the repo it is the
 * server's own. Returns an empty object when it is missing or unreadable.
 */
export const readPackageInfo = (): PackageInfo => {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null) return {};
    const { name, version } = parsed as Record<string, unknown>;
    return {
      name: typeof name === 'string' ? name : undefined,
      version: typeof version === 'string' ? version : undefined,
    };
  } catch {
    return {};
  }
};

/**
 * Builds the OTel resource. `service.name` is `OTEL_SERVICE_NAME`, else the
 * package name. `service.version` comes from `package.json`; when it is missing
 * the attribute is left out so `OTEL_RESOURCE_ATTRIBUTES` can supply it.
 * @param env - process environment
 * @param pkg - package info, overridable for tests
 */
export const buildResource = (
  env: NodeJS.ProcessEnv,
  pkg: PackageInfo = readPackageInfo(),
): Resource =>
  resourceFromAttributes({
    [ATTR_SERVICE_NAME]:
      env.OTEL_SERVICE_NAME || pkg.name || DEFAULT_SERVICE_NAME,
    ...(pkg.version ? { [ATTR_SERVICE_VERSION]: pkg.version } : {}),
  });

/**
 * Builds the instrumentations: inbound `node:http` (no header capture, probe
 * and scrape paths ignored) and outbound `fetch`, which propagates
 * `traceparent` to DIAL Core.
 */
export const buildInstrumentations = (): Instrumentation[] => [
  new HttpInstrumentation({
    ignoreIncomingRequestHook: (req) => isExcludedFromTelemetry(req.url),
  }),
  new UndiciInstrumentation(),
];

/**
 * Builds span processors for the selected traces exporter.
 * @param tracesExporter - selected exporter
 */
export const buildSpanProcessors = (
  tracesExporter: SingleSignalExporter,
): SpanProcessor[] =>
  tracesExporter === SingleSignalExporter.None
    ? []
    : [new BatchSpanProcessor(new OTLPTraceExporter())];

/**
 * Builds log record processors for the selected logs exporter.
 * @param logsExporter - selected exporter
 */
export const buildLogRecordProcessors = (
  logsExporter: SingleSignalExporter,
): LogRecordProcessor[] =>
  logsExporter === SingleSignalExporter.None
    ? []
    : [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })];

/**
 * Builds the metric readers. The scrape listener is unauthenticated, so it
 * binds to loopback unless `OTEL_EXPORTER_PROMETHEUS_HOST` opts in.
 * @param config - parsed telemetry configuration
 */
export const buildMetricReaders = (config: OtelConfig): IMetricReader[] =>
  config.metricsExporters.map((exporter) =>
    exporter === MetricsExporter.Prometheus
      ? new PrometheusExporter({
          host: config.prometheusHost,
          port: config.prometheusPort,
          endpoint: METRICS_ENDPOINT,
        })
      : new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
        }),
  );

let sdk: NodeSDK | undefined;

/**
 * Starts the SDK unless `OTEL_SDK_DISABLED` is true (the default).
 * @param env - process environment
 */
export const initializeOpenTelemetry = (
  env: NodeJS.ProcessEnv = process.env,
): void => {
  const config = parseOtelConfig(env);
  if (config.disabled || sdk) return;
  const logRecordProcessors = buildLogRecordProcessors(config.logsExporter);
  sdk = new NodeSDK({
    resource: buildResource(env),
    instrumentations: buildInstrumentations(),
    spanProcessors: buildSpanProcessors(config.tracesExporter),
    logRecordProcessors,
    metricReaders: buildMetricReaders(config),
  });
  sdk.start();
  const started = sdk;
  onShutdown(async () => started.shutdown());
  setLogExport(logRecordProcessors.length > 0);
};

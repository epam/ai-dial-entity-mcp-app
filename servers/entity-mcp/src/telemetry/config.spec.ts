import { describe, expect, test } from 'vitest';
import {
  MetricsExporter,
  SingleSignalExporter,
  parseOtelConfig,
} from './config.ts';
import { isExcludedFromTelemetry } from './excluded-paths.ts';
import { buildResource } from './sdk.ts';

describe('parseOtelConfig', () => {
  test('is off with no OTEL_* variable', () => {
    expect(parseOtelConfig({})).toEqual({
      disabled: true,
      tracesExporter: SingleSignalExporter.Otlp,
      logsExporter: SingleSignalExporter.Otlp,
      metricsExporters: [MetricsExporter.Prometheus],
      prometheusHost: '127.0.0.1',
      prometheusPort: 9464,
    });
  });

  test.each(['false', 'FALSE', '0', 'no'])(
    'enables the SDK for OTEL_SDK_DISABLED=%s',
    (value) => {
      expect(parseOtelConfig({ OTEL_SDK_DISABLED: value }).disabled).toBe(
        false,
      );
    },
  );

  test.each(['true', '1', ''])(
    'keeps the SDK off for OTEL_SDK_DISABLED=%s',
    (value) => {
      expect(parseOtelConfig({ OTEL_SDK_DISABLED: value }).disabled).toBe(true);
    },
  );

  test('reads the UAT scrape-only setup', () => {
    expect(
      parseOtelConfig({
        OTEL_SDK_DISABLED: 'false',
        OTEL_METRICS_EXPORTER: 'prometheus',
        OTEL_EXPORTER_PROMETHEUS_HOST: '0.0.0.0',
        OTEL_TRACES_EXPORTER: 'none',
        OTEL_LOGS_EXPORTER: 'none',
      }),
    ).toEqual({
      disabled: false,
      tracesExporter: SingleSignalExporter.None,
      logsExporter: SingleSignalExporter.None,
      metricsExporters: [MetricsExporter.Prometheus],
      prometheusHost: '0.0.0.0',
      prometheusPort: 9464,
    });
  });

  test('accepts several metrics exporters, ignoring unknown ones and duplicates', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: 'otlp, prometheus,otlp,foo' })
        .metricsExporters,
    ).toEqual([MetricsExporter.Otlp, MetricsExporter.Prometheus]);
  });

  test('a none anywhere turns metrics off', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: 'prometheus,none' })
        .metricsExporters,
    ).toEqual([]);
  });

  test('reads the Prometheus port and falls back on a bad one', () => {
    expect(
      parseOtelConfig({ OTEL_EXPORTER_PROMETHEUS_PORT: '9999' }).prometheusPort,
    ).toBe(9999);
    expect(
      parseOtelConfig({ OTEL_EXPORTER_PROMETHEUS_PORT: 'abc' }).prometheusPort,
    ).toBe(9464);
  });
});

describe('isExcludedFromTelemetry', () => {
  test.each(['/health', '/health?x=1', '/metrics'])('excludes %s', (url) => {
    expect(isExcludedFromTelemetry(url)).toBe(true);
  });

  test.each(['/mcp', '/healthz', '/', undefined])('keeps %s', (url) => {
    expect(isExcludedFromTelemetry(url)).toBe(false);
  });
});

describe('buildResource', () => {
  test('prefers OTEL_SERVICE_NAME over the package name', () => {
    const resource = buildResource(
      { OTEL_SERVICE_NAME: 'entity-mcp' },
      { name: 'pkg', version: '1.2.3' },
    );
    expect(resource.attributes['service.name']).toBe('entity-mcp');
    expect(resource.attributes['service.version']).toBe('1.2.3');
  });

  test('falls back to the package name and leaves the version out when unknown', () => {
    const resource = buildResource({}, { name: 'pkg' });
    expect(resource.attributes['service.name']).toBe('pkg');
    expect(resource.attributes).not.toHaveProperty('service.version');
  });
});

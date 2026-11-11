/** Exporter choice for a signal that has at most one exporter (traces, logs). */
export const SingleSignalExporter = {
  Otlp: 'otlp',
  None: 'none',
} as const;

export type SingleSignalExporter =
  (typeof SingleSignalExporter)[keyof typeof SingleSignalExporter];

/** One active metrics exporter; several may be enabled at once. */
export const MetricsExporter = {
  Otlp: 'otlp',
  Prometheus: 'prometheus',
} as const;

export type MetricsExporter =
  (typeof MetricsExporter)[keyof typeof MetricsExporter];

export type OtelConfig = {
  disabled: boolean;
  tracesExporter: SingleSignalExporter;
  logsExporter: SingleSignalExporter;
  /** Empty means metrics are off: a `none` anywhere in the list disables them. */
  metricsExporters: MetricsExporter[];
  prometheusHost: string;
  prometheusPort: number;
};

export const DEFAULT_PROMETHEUS_HOST = '127.0.0.1';
export const DEFAULT_PROMETHEUS_PORT = 9464;
export const METRICS_ENDPOINT = '/metrics';

const FALSY_VALUES = new Set(['false', '0', 'no']);

const parseBooleanEnv = (
  raw: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (raw == null || raw.trim() === '') return defaultValue;
  return !FALSY_VALUES.has(raw.trim().toLowerCase());
};

const parseSingleSignalExporter = (
  raw: string | undefined,
): SingleSignalExporter =>
  raw?.trim().toLowerCase() === SingleSignalExporter.None
    ? SingleSignalExporter.None
    : SingleSignalExporter.Otlp;

const isMetricsExporter = (token: string): token is MetricsExporter =>
  (Object.values(MetricsExporter) as string[]).includes(token);

const parseMetricsExporters = (raw: string | undefined): MetricsExporter[] => {
  const tokens = (raw ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return [MetricsExporter.Prometheus];
  if (tokens.includes('none')) return [];
  return Array.from(new Set(tokens.filter(isMetricsExporter)));
};

/**
 * Parses the `OTEL_*` environment variables into a typed exporter selection.
 * Pure: no SDK or network access, so it is safe to call before anything is
 * instrumented. Telemetry is off unless `OTEL_SDK_DISABLED=false`.
 * @param env - process environment
 */
export const parseOtelConfig = (env: NodeJS.ProcessEnv): OtelConfig => ({
  disabled: parseBooleanEnv(env.OTEL_SDK_DISABLED, true),
  tracesExporter: parseSingleSignalExporter(env.OTEL_TRACES_EXPORTER),
  logsExporter: parseSingleSignalExporter(env.OTEL_LOGS_EXPORTER),
  metricsExporters: parseMetricsExporters(env.OTEL_METRICS_EXPORTER),
  prometheusHost: env.OTEL_EXPORTER_PROMETHEUS_HOST || DEFAULT_PROMETHEUS_HOST,
  prometheusPort:
    Number(env.OTEL_EXPORTER_PROMETHEUS_PORT) || DEFAULT_PROMETHEUS_PORT,
});

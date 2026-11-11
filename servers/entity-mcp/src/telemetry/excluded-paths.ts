/**
 * Paths that must produce no telemetry: the liveness probe, and the
 * Prometheus scrape path (served by the exporter's own listener).
 */
export const TELEMETRY_EXCLUDED_PATHS = new Set(['/health', '/metrics']);

/**
 * Tells whether a request URL is infrastructure traffic that must not produce
 * telemetry. The query string is ignored.
 * @param url - raw request URL (path with optional query)
 */
export const isExcludedFromTelemetry = (
  url: string | null | undefined,
): boolean => {
  if (url == null) return false;
  const queryStart = url.indexOf('?');
  const path = queryStart === -1 ? url : url.slice(0, queryStart);
  return TELEMETRY_EXCLUDED_PATHS.has(path);
};

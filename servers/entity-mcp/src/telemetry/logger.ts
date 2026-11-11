import { format } from 'node:util';
import { context } from '@opentelemetry/api';
import { SeverityNumber, logs } from '@opentelemetry/api-logs';

const LOGGER_NAME = 'ai-dial-entity-mcp-server';

type Level = 'log' | 'warn' | 'error';

const SEVERITY: Record<Level, { number: SeverityNumber; text: string }> = {
  log: { number: SeverityNumber.INFO, text: 'INFO' },
  warn: { number: SeverityNumber.WARN, text: 'WARN' },
  error: { number: SeverityNumber.ERROR, text: 'ERROR' },
};

let exportEnabled = false;

/**
 * Turns on emitting through the OpenTelemetry Logs API. Called by the SDK
 * bootstrap only when a logs exporter is active, so with telemetry off a log
 * call is exactly a `console` call.
 * @param enabled - whether records are also emitted to OpenTelemetry
 */
export const setLogExport = (enabled: boolean): void => {
  exportEnabled = enabled;
};

const write = (level: Level, args: unknown[]): void => {
  console[level](...args);
  if (!exportEnabled) return;
  try {
    logs.getLogger(LOGGER_NAME).emit({
      severityNumber: SEVERITY[level].number,
      severityText: SEVERITY[level].text,
      body: format(...args),
      context: context.active(),
    });
  } catch {
    // Exporting is best effort: the console line above is already written.
  }
};

/**
 * Process logger. Stdout and stderr output is the same as calling `console`
 * directly; when log export is on, each call is also emitted as an
 * OpenTelemetry log record, correlated with the active span's trace and span id.
 * OpenTelemetry's own diagnostics never go through it.
 */
export const logger = {
  info: (...args: unknown[]): void => write('log', args),
  warn: (...args: unknown[]): void => write('warn', args),
  error: (...args: unknown[]): void => write('error', args),
};

import { logs } from '@opentelemetry/api-logs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { logger, setLogExport } from './logger.ts';

describe('logger', () => {
  afterEach(() => {
    setLogExport(false);
    vi.restoreAllMocks();
  });

  test('writes exactly what console would, at the matching level', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('boom');
    logger.info('listening on :8080');
    logger.warn('entity-mcp: careful');
    logger.error('failed with an unexpected error:', failure);
    expect(log).toHaveBeenCalledExactlyOnceWith('listening on :8080');
    expect(warn).toHaveBeenCalledExactlyOnceWith('entity-mcp: careful');
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'failed with an unexpected error:',
      failure,
    );
  });

  test('emits nothing to OpenTelemetry while export is off', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const getLogger = vi.spyOn(logs, 'getLogger');
    logger.info('hello');
    expect(getLogger).not.toHaveBeenCalled();
  });

  test('also emits a record with the formatted body when export is on', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const emit = vi.fn();
    vi.spyOn(logs, 'getLogger').mockReturnValue({ emit, enabled: () => true });
    setLogExport(true);
    logger.error('failed for %s', 'x');
    expect(emit).toHaveBeenCalledOnce();
    expect(emit.mock.calls[0]?.[0]).toMatchObject({
      severityText: 'ERROR',
      body: 'failed for x',
    });
  });

  test('still writes the console line when emitting throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(logs, 'getLogger').mockImplementation(() => {
      throw new Error('exporter exploded');
    });
    setLogExport(true);
    expect(() => logger.error('failed')).not.toThrow();
    expect(error).toHaveBeenCalledExactlyOnceWith('failed');
  });
});

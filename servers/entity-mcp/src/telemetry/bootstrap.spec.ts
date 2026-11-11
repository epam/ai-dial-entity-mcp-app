import { afterEach, describe, expect, test, vi } from 'vitest';
import { startTelemetry } from './bootstrap.ts';

describe('startTelemetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('runs the start-up and stays quiet when it succeeds', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const start = vi.fn().mockResolvedValue(undefined);
    await startTelemetry(start);
    expect(start).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  test('does not rethrow a failing start-up and warns once with the reason', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      startTelemetry(async () => {
        throw new Error('port 9464 in use');
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'entity-mcp: telemetry disabled: port 9464 in use',
    );
  });
});

import { afterEach, describe, expect, test, vi } from 'vitest';
import { shutdownOpenTelemetry } from './shutdown.ts';

describe('shutdownOpenTelemetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('does nothing when telemetry was never started', async () => {
    await expect(shutdownOpenTelemetry()).resolves.toBeUndefined();
  });

  test('waits for a shutdown that finishes in time', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await shutdownOpenTelemetry(5000, fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  test('gives up on an unreachable collector after the timeout', async () => {
    vi.useFakeTimers();
    const hung = vi.fn(() => new Promise<void>(() => {}));
    let settled = false;
    const done = shutdownOpenTelemetry(5000, hung).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(settled).toBe(true);
  });

  test('swallows a failing shutdown', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('collector down'));
    await expect(shutdownOpenTelemetry(5000, fn)).resolves.toBeUndefined();
  });
});

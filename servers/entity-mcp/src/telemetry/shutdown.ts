export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

let shutdownFn: (() => Promise<void>) | undefined;

/**
 * Registers how to flush and stop telemetry. Kept apart from the SDK module so
 * the server can shut down without loading the SDK when telemetry is off.
 * @param fn - flushes exporters and stops the SDK
 */
export const onShutdown = (fn: () => Promise<void>): void => {
  shutdownFn = fn;
};

/**
 * Flushes and stops telemetry, giving up after `timeoutMs` so an unreachable
 * collector cannot block termination past the orchestrator's grace period.
 * Does nothing when telemetry was never started. Never rejects.
 * @param timeoutMs - maximum wait
 * @param fn - what to run instead of the registered shutdown, for tests
 */
export const shutdownOpenTelemetry = async (
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  fn: (() => Promise<void>) | undefined = shutdownFn,
): Promise<void> => {
  if (!fn) return;
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fn().catch(() => undefined),
      new Promise<void>((done) => {
        timer = setTimeout(done, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

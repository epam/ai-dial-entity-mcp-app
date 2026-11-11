/**
 * Runs the telemetry start-up so a failure in it can never stop the server:
 * one warning goes to `console` (not the OpenTelemetry logger) and the server
 * carries on without telemetry.
 * @param start - loads and starts the SDK
 */
export const startTelemetry = async (
  start: () => Promise<void>,
): Promise<void> => {
  try {
    await start();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`entity-mcp: telemetry disabled: ${reason}`);
  }
};

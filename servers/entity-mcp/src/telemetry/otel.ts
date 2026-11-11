import { register } from 'node:module';
import { startTelemetry } from './bootstrap.ts';
import { parseOtelConfig } from './config.ts';

/**
 * Preloaded with `node --import ./src/telemetry/otel.ts src/main.ts`, so the
 * SDK starts before `node:http` and `fetch` are first used by the server. With
 * telemetry off (the default) it does nothing and the SDK is never loaded.
 * Otherwise the `import-in-the-middle` hook must be registered first or ESM
 * imports cannot be patched, and the SDK is imported after it. A failure to
 * start is warned about and the server runs without telemetry.
 */
await startTelemetry(async () => {
  if (parseOtelConfig(process.env).disabled) return;
  register('import-in-the-middle/hook.mjs', import.meta.url);
  const { initializeOpenTelemetry } = await import('./sdk.ts');
  initializeOpenTelemetry();
});

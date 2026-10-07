# Correlated request logging — entity-mcp

Branch: `feat/entity-mcp-server` (worked in place, not switched).

## Changes

- `servers/entity-mcp/src/core/client.ts` — added exported `CorrelationContext`
  type (`correlationId`, optional `requestId`/`traceId`). `fetchEntity` now
  takes `correlation` in its options instead of minting `randomUUID()`
  itself; it sends `x-correlation-id` always and `x-request-id`/`x-trace-id`
  only when the caller provided them.
- `servers/entity-mcp/src/http.ts` — added `readInboundCorrelation(headers)`:
  reuses `X-Correlation-ID`, else `X-Request-ID`, else `X-Trace-ID`, else
  mints a `randomUUID()`. Returns the raw `requestId`/`traceId` too (for
  independent forwarding), regardless of which one seeded `correlationId`.
- `servers/entity-mcp/src/main.ts` — calls `readInboundCorrelation` once per
  request and passes the result into `createMcpServer` alongside the
  credential. Startup line unchanged.
- `servers/entity-mcp/src/mcp/server.ts` — `createMcpServer` takes a 4th
  `correlation` param. The tool handler now records `startedAt`, computes
  `durationMs`, and:
  - on success: one new `console.log` completion line (outcome, kind,
    sanitised id, duration, correlation id).
  - on failure: the four existing `console.error` branches keep their
    diagnostic detail (`error.message` or "with an unexpected error:"), with
    duration and correlation id added to the line.
  Both the entity id and the correlation id are rendered through the
  existing `sanitizeForLog` (JSON-stringify) before being interpolated, so a
  caller-controlled value can't forge a multi-line log entry on either path.
- `servers/entity-mcp/README.md` — new "Logging" section.

## Tests added/updated

- `servers/entity-mcp/src/http.spec.ts` (new) — correlation id precedence
  (`x-correlation-id` > `x-request-id` > `x-trace-id` > generated),
  `requestId`/`traceId` surfaced independently.
- `servers/entity-mcp/src/core/client.spec.ts` — correlation id forwarded
  verbatim (no more minting in the client); `x-request-id`/`x-trace-id`
  forwarded when present, omitted when absent.
- `servers/entity-mcp/src/mcp/server.spec.ts` — success completion line
  contains outcome + correlation id; failure line keeps the Core diagnostic
  detail and gains the correlation id; no credential leak on `console.log`;
  a `\n` in the id can't split the success log line. All existing
  `createMcpServer`/`fetchEntity` call sites updated for the new parameter.

## Verification

`npm run verify` (lint, format:check, typecheck, test, build) passes clean —
385 tests, 33 files.

## Example log lines (illustrative, exact values depend on the real call)

Success:
```
show_entity_card succeeded for skill "skills/b/my-skill" in 42ms (correlation "3fa0c2de-1b2a-4e9d-9c7f-2b7b7a2b9b10")
```

Failure:
```
show_entity_card failed for skill "skills/b/my-skill" in 58ms (correlation "3fa0c2de-1b2a-4e9d-9c7f-2b7b7a2b9b10"): DIAL Core responded 404
```

## Status

Committed locally, not pushed. No `.superpowers` directory created.

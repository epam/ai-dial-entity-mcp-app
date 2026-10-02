---
paths: ['**/__tests__/**', '**/*.spec.ts', '**/*.spec.tsx']
globs: ['**/__tests__/**', '**/*.spec.ts', '**/*.spec.tsx']
applyTo: '**/__tests__/**,**/*.spec.ts,**/*.spec.tsx'
---

# Tests

- Vitest + React Testing Library; files `*.spec.ts(x)` in a `__tests__/` folder next to the code.
- Query by role and accessible name; avoid test ids except for non-semantic
  containers (e.g. skeletons).
- Use `createFakeMcpApp` from `@epam/ai-dial-mcp-app-kit/testing` for app
  tests; do not mock the kit or the SDK in app tests.
- Use `fixtures/*.json` for payloads instead of inline objects when a fixture fits.
- Write the failing test first.

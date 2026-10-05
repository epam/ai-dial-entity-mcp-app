# @epam/ai-dial-mcp-app-kit

Reusable plumbing for MCP App UIs. Any app in this repo (and later, outside
it) builds on this; treat every export as public API.

- Follow the MCP Apps spec and `@modelcontextprotocol/ext-apps` behaviour.
  Check the spec and SDK types (Context7, `node_modules/@modelcontextprotocol/ext-apps/dist/src/*.d.ts`)
  before adding protocol handling.
- `src/core` has no framework dependency. React lives only in `src/react`,
  Vite only in `src/vite`, test helpers only in `src/testing`. ESLint enforces
  the import direction: core imports nothing from React, Vite or the testing
  layer, and the React layer imports nothing from Vite.
- No host-specific code: hosts style and lay out the app only through what
  they send (MCP tokens, insets). Protocol-level quirks (e.g. inline height
  sync) live in `src/core/host/`, each with a JSDoc naming the behaviour.
- `applyHostContext` drops host `--shadow-*` variables. That is a ui-kit
  compatibility rule, not a host quirk, so it lives there, not in
  `src/core/host/`.
- Theme is applied by `src/core/applyHostContext.ts` writing `data-theme` and
  `color-scheme` on `<html>` directly, not via the SDK's `applyDocumentTheme`.
- `availableDisplayModes` defaults to `['inline']`; never widen the default.
- Changing an export, a CSS variable mapping, or a snapshot field: update
  `README.md` in the same change and check every app under `apps/`.
- `dev-host/` is a real `AppBridge` host — never add dev-only branches to apps
  to make the harness work.
- Tests sit in `__tests__/` next to the code; dev-host tests live in
  `dev-host/__tests__/`.

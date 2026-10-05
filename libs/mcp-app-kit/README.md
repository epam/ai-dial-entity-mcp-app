# @epam/ai-dial-mcp-app-kit

The shared layer for MCP Apps built in this repository. It wraps the MCP Apps
SDK (`@modelcontextprotocol/ext-apps`) behind a small store and React hooks,
maps host theme variables onto `@epam/ai-dial-ui-kit`, smooths over differences
between hosts (Claude, ChatGPT, AI DIAL), and ships the Vite, Tailwind and test
setup plus a local dev host. App code imports the kit and never talks to the
host directly.

The package is private and consumed as TypeScript source through its `exports`
map — there is no build step. Because of that, Vite must run with
`--configLoader runner` in any workspace whose config imports the kit.

## Entry points

| Import                                                                 | Contents                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@epam/ai-dial-mcp-app-kit`                                            | Framework-free core: `createMcpApp`, `applyHostContext`, `getStructuredContent`, `ParseResult`, `McpAppPhase`, `McpAppError`, host helpers.                                                                                 |
| `@epam/ai-dial-mcp-app-kit/react`                                      | `McpAppProvider`, `useMcpApp`, `useHostContext`, `useOpenLink`, `useToolResult`, `ToolResultStatus`.                                                                                                                        |
| `@epam/ai-dial-mcp-app-kit/testing`                                    | `createFakeMcpApp` — an in-memory store for component tests; `MCP_STYLE_VARIABLE_KEYS` — the 76 standard style keys.                                                                                                        |
| `@epam/ai-dial-mcp-app-kit/vite`                                       | `mcpAppVite()` plugin list, `mcpAppEndpoint()`, `MCP_APP_PATH` (`/_mcp-app/index.html`).                                                                                                                                    |
| `@epam/ai-dial-mcp-app-kit/tailwind`                                   | Tailwind preset: ui-kit 2.0 colour utilities (`bg-layer-raised`, `text-secondary`, `border-secondary`, …) and MCP host typography (`font-*`, `text-xs…lg`, `text-heading-*`), radius (`rounded-*`) and border-width tokens. |
| `@epam/ai-dial-mcp-app-kit/styles/host-tokens.css`                     | Maps MCP host variables onto ui-kit variables.                                                                                                                                                                              |
| `@epam/ai-dial-mcp-app-kit/styles/ui-kit-overrides.css`                | Re-declares ui-kit's `.dial-*-text` typography classes with MCP host type tokens.                                                                                                                                           |
| `@epam/ai-dial-mcp-app-kit/styles/layout.css`                          | Base layout: transparent page, content-sized height, safe-area padding on `#root`.                                                                                                                                          |
| `dev-host/` (run with `npm run dev-host -w @epam/ai-dial-mcp-app-kit`) | Local host harness that embeds an app in an iframe and plays the host side of the protocol.                                                                                                                                 |

## Minimal usage

`src/main.tsx`:

```tsx
import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-mcp-app-kit/styles/host-tokens.css';
import '@epam/ai-dial-mcp-app-kit/styles/ui-kit-overrides.css';
import '@epam/ai-dial-mcp-app-kit/styles/layout.css';
import './styles/index.css';
import { createMcpApp } from '@epam/ai-dial-mcp-app-kit';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { name, version } from '../package.json';
import App from './App';

const app = createMcpApp({ name, version });
app.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <McpAppProvider app={app}>
      <App />
    </McpAppProvider>
  </StrictMode>,
);
```

Import order matters: ui-kit `styles.css` → `host-tokens.css` →
`ui-kit-overrides.css` → `layout.css` → the app's own CSS. The kit sheets are
unlayered and load after ui-kit's, so they win by source order.

`vite.config.ts`:

```ts
import { mcpAppVite } from '@epam/ai-dial-mcp-app-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: mcpAppVite(),
  server: { port: 4300, strictPort: true },
  preview: { port: 4300, strictPort: true },
});
```

`mcpAppVite()` adds the React plugin, `vite-plugin-singlefile` (everything is
inlined into one `index.html`) and an endpoint that serves the app at
`/_mcp-app/index.html` on the dev and preview servers — the same path the
production image uses.

`createMcpApp({ name, version, availableDisplayModes, transport })` returns a
store. `start()` connects to the host (by default over `postMessage` to
`window.parent`; pass `transport` to override). The store tracks a snapshot —
`phase` (`connecting`, `tool-pending`, `ready`, `error`, `torndown`),
`toolInput`, `toolResult`, `hostContext`, `error` — and exposes `openLink`,
`callTool`, `requestDisplayMode` and `sendMessage`. Every action rejects with
`McpAppError` if `start()` has not been called, and with `McpAppError` (carrying
the host's message) when the host request fails — for example the host has no
handler for it or its handler throws. `openLink` also rejects with
`McpAppError` when the host refuses to open the link.

`McpAppProvider` makes the store available to the hooks, applies every host
context change to the document in a layout effect, so the theme is in place
before the first paint (see `applyHostContext` below), and runs the inline
height sync.

## Tool results: `useToolResult` and `ParseResult`

```ts
type ParseResult<T> = { ok: true; data: T } | { ok: false; reason: string };
```

The app supplies a parser `(raw: unknown) => ParseResult<T>` that validates the
tool's structured content. `useToolResult(parse)` returns a `ToolResultState<T>`:

| `status`                   | When                                                 | Extra fields     |
| -------------------------- | ---------------------------------------------------- | ---------------- |
| `ToolResultStatus.Loading` | Connecting, or the tool is still running.            | —                |
| `ToolResultStatus.Ready`   | A result arrived and `parse` returned `ok: true`.    | `data: T`        |
| `ToolResultStatus.Invalid` | A result arrived and `parse` returned `ok: false`.   | `error: string`  |
| `ToolResultStatus.Error`   | The handshake failed or the host cancelled the tool. | `error?: string` |

Before parsing, the raw result goes through `getStructuredContent`, which
accepts `structuredContent`, `structured_content`, a nested `result` wrapper,
or — for hosts that forward only text — the first JSON `text` content block.

`parse` must be referentially stable (a module-level function), because it is a
memo dependency.

`useMcpApp()` returns the full snapshot, `useHostContext()` the merged host
context, and `useOpenLink()` a function that asks the host to open a URL and
rejects if the host refuses.

For tests, `createFakeMcpApp(initial)` from `/testing` gives a store with no
transport: push states with `setSnapshot`, read `openedLinks`, and make the
next `openLink` calls reject with `failOpenLink(times)`.

## Host theming

`applyHostContext` writes the host's theme to `data-theme` (and `color-scheme`)
on `<html>`, applies the host's style variables and font CSS, and sets
`data-display-mode` / `data-platform` plus `--mcp-container-*` and
`--mcp-safe-area-*` variables. Host `--shadow-*` variables are not applied:
MCP sends full `box-shadow` values under names ui-kit reads as shadow colours.

`host-tokens.css` maps the MCP standard variables onto the ui-kit 2.0
variables. **Tokens only:** every host, AI DIAL included, styles the app
through the variables it sends; there is no host detection.

- **Theme blocks** (`:root`, `:root[data-theme='dark']`, and the dark block
  repeated for theme-less hosts that prefer dark) are the exact inverse of AI
  DIAL's own DIAL → MCP mapping, so DIAL's values come back unchanged (a
  round-trip test guards this). Each line is `--ui-kit: var(--mcp, <literal>)`;
  light literals are ui-kit's own fallbacks, dark literals are approximate.
- **Derived variables** (`html` block) have no colour fallback, so without
  host tokens ui-kit's defaults apply:
  - primary button: solid `--color-background-inverse` with
    `--color-text-inverse` label; hover/active mix the two;
  - neutral button ("Edit"): fill `--color-background-tertiary`, border
    `--color-border-secondary`, label `--color-text-primary`;
  - button glow: `--color-text-primary` at 10% / 4%;
  - radii: `--radius-control` ← `--border-radius-md`, small ←
    `--border-radius-sm`, `--mcp-card-radius` ← `--border-radius-xl`.
- **Badge tones:** `.mcp-tone-success|warning|danger` re-point a filled
  `Badge`'s colour at the host's semantic tone. Put the class on the badge,
  never on a container — the `Avatar` shares the same palette.

The Tailwind preset (`@epam/ai-dial-mcp-app-kit/tailwind`) exposes the same
ui-kit variables and the MCP type, radius and border-width tokens as
utilities, so app markup follows the host theme without hardcoded colours.

### Host token contract

What a host sends to style the skill card:

| MCP variable                                                           | Drives                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `--color-background-primary`                                           | card, skeleton                                            |
| `--color-background-tertiary`                                          | "Edit" fill; skeleton bars                                |
| `--color-background-inverse` / `--color-text-inverse`                  | "Try it" fill / label                                     |
| `--color-background-success`, `-warning`, `-danger` / `--color-text-*` | "% passed" badge by tone; ✓ / ✗ icons; notices            |
| `--color-text-primary`                                                 | title, description, list items, "Edit" label, button glow |
| `--color-text-secondary`                                               | hints under failed checks                                 |
| `--color-text-info`                                                    | "SKILL" label                                             |
| `--color-border-secondary`                                             | "Edit" border; quality-check block border                 |
| `--color-ring-primary`                                                 | focus ring                                                |
| `--font-sans` (+ `styles.css.fonts`)                                   | all text                                                  |
| `--font-weight-*`, `--font-text-*`, `--font-heading-*`                 | type scale                                                |
| `--border-radius-md` / `-sm`                                           | buttons / small buttons                                   |
| `--border-radius-xl`                                                   | card and quality-check block                              |
| `--border-width-regular`                                               | borders                                                   |

## Display modes

`createMcpApp` declares `availableDisplayModes: ['inline']` by default. An app
that supports `fullscreen` or `pip` must list those modes explicitly, then
switch with `requestDisplayMode`. `layout.css` gives `#root` a minimum height
of the host container in `fullscreen` and `pip`.

## Dev host

`npm run dev` in `apps/skill-card` starts the app on port 4300 and the harness
on port 4301 together. To run the harness for another app, start the app's
Vite server and run:

```sh
MCP_APP_URL=http://localhost:4300/_mcp-app/index.html \
MCP_FIXTURES_DIR=$PWD/fixtures \
MCP_BUILT_FILE=$PWD/dist/index.html \
MCP_DEFAULT_FIXTURE=with-failures.json \
npm run dev-host -w @epam/ai-dial-mcp-app-kit
```

| Variable              | Purpose                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `MCP_APP_URL`         | App URL for the "Dev server (HMR)" source. Defaults to `http://localhost:4300/_mcp-app/index.html`. |
| `MCP_FIXTURES_DIR`    | Directory of `*.json` tool payloads listed in the Fixture picker.                                   |
| `MCP_BUILT_FILE`      | Built single-file app for the "Built file (srcdoc)" source. Run the app build first.                |
| `MCP_DEFAULT_FIXTURE` | Fixture file name selected on load (e.g. `with-failures.json`). Defaults to the first fixture.      |

The harness panel switches the source (dev server, or the built file loaded via
`srcdoc`), fixture, light/dark theme, host preset (ChatGPT — dark captured
from the real host, light approximate; Claude-like, approximate; AI DIAL —
DIAL's D18 values, dark approximate; Reference design — the values a host sends
to match the reference design, light only; or no variables), display mode,
width and result delay. It can
reload the app, resend the tool result or cancel the tool, and logs every
protocol message; `ui/open-link` requests are highlighted and not navigated.

## Host quirks handled

- **Inline height sync.** Some hosts size the iframe from the document height
  instead of `ui/notifications/size-changed`, so the SDK's auto-resize alone
  never reports that content shrank. In inline mode the provider keeps
  `<html>`'s height equal to the content height.
- **Safe area.** Insets come only from `hostContext.safeAreaInsets`; a host
  that sends none gets no padding. There is no per-host fallback.
- **Result envelopes.** `getStructuredContent` normalises the different
  tool-result shapes hosts deliver (see above).

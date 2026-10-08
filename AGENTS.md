# ai-dial-entity-mcp-app

MCP App UI for the entity tools. An **MCP App** is a web page that an MCP server
exposes as a `ui://` resource for one of its tools; MCP Apps hosts (Claude,
ChatGPT, AI DIAL) render it in a sandboxed iframe and talk to it over the
MCP Apps postMessage protocol (`ui/initialize`, tool input/result
notifications, `ui/open-link`, host-context changes).

The repo ships exactly one artifact: the `servers/entity-mcp` MCP server,
built as the root `Dockerfile`, with the entity card baked in as its `ui://`
resource. `apps/quality-check` is components kept for future use — built and
tested like any other workspace, but not shipped.

## Repo map

- `apps/entity-card/` — the entity card app (renders skill and agent cards from one payload with optional sections). Builds to one self-contained
  `dist/index.html`.
  - `src/contract.ts` — tool payload type + parser (the contract we own).
  - `src/components/` — UI.
- `apps/entity-card/fixtures/` — payload samples for tests and the dev host.
- `apps/quality-check/` — the quality check app, a separate MCP App with its own
  payload contract (`src/contract.ts`) and fixtures. Builds to its own
  `dist/index.html`. Not rendered inside the entity card (separate iframes).
  Components kept for future use: built and tested like any other workspace,
  but not shipped in the Docker image.
- `scripts/check-single-file.mjs` — build check shared by every app.
- `libs/mcp-app-kit/` (`@epam/ai-dial-mcp-app-kit`) — reusable MCP App plumbing.
  Read `libs/mcp-app-kit/AGENTS.md` before changing it.
- `servers/entity-mcp/` — the shipped production MCP server. Serves
  `show_entity_card` and the `ui://entity-card/index.html` resource against real
  DIAL Core data. Node, no build step, no stored credentials.
- `tools/test-mcp-server/` — local test MCP server that serves the built card
  and the fixtures, for trying the card in real hosts. Not shipped.
- `tools/mcp-probe/` — CLI that calls an MCP endpoint as a Streamable-HTTP
  client (lists tools/resources, calls `show_entity_card`), for checking
  credential forwarding by hand. Not shipped.
- `Dockerfile` — builds the repo's single shipped artifact, the MCP server
  (`servers/entity-mcp`) with the entity card baked in as its `ui://` resource.
  There is no static hosting and no `/_mcp-app/` paths.

## Where new code goes

- `apps/<name>/` — an MCP App UI that ships. An npm workspace, built and
  released by CI.
- `libs/<name>/` — reusable code shared by apps. An npm workspace.
- `servers/<name>/` — a shipped backend. An npm workspace, released as its own
  Docker image. May import from `libs/`; never from `apps/`.
- `tools/<name>/` — anything for development or testing only (test servers,
  scripts with their own dependencies). Never shipped. Each tool:
  - has its own `package.json` and `package-lock.json` and is **not** an npm
    workspace, so the root lockfile, `npm run verify` and the release image
    don't change;
  - has a `README.md` that says it isn't shipped and how to run it;
  - may read from `apps/` and `libs/` (fixtures, build output), but nothing in
    `apps/` or `libs/` imports from `tools/`.

  `tools/` is already excluded from the release image (`.dockerignore`), from
  ORT (`.ort.yml`) and linted as Node code (`eslint.config.mjs`), so a new tool
  needs no config changes there.

## Commands

- `npm run dev` — entity card (:4300) + dev host harness (:4301).
- `npm run dev:quality-check` — quality check (:4302) + its dev host harness (:4303).
- `npm test` / `npm run test:watch`
- `npm run lint`, `npm run typecheck`, `npm run format`
- `npm run build` — single-file build + check.
- `npm run verify` — lint, format check, typecheck, tests, build. **Run before saying work is done.**

## Hard boundaries

- The kit never imports from `apps/`.
- App code never imports `@modelcontextprotocol/*`, never touches
  `window.parent` or `postMessage`. Use kit APIs (`createMcpApp`,
  `useToolResult`, `useOpenLink`, …). Lint (`eslint.config.mjs`) bans SDK
  imports in the app, `window.parent` / `postMessage`, and the bare globals
  `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `top` and `opener` in
  `apps/*/src`; it also enforces the kit layering.
- The app makes no network calls. Anything server-side goes through host tool calls.
- The build must stay a single file. Never relax
  `scripts/check-single-file.mjs`.
- Every display mode the app declares must be supported by its UI. The app
  declares `inline` only.

## Working rules

- Read before editing; keep diffs minimal and on-task.
- Payload changes: update `src/contract.ts`, the fixtures and the README
  contract section in the same change.
- Kit API changes: update `libs/mcp-app-kit/README.md` in the same change.
- UI: use `@epam/ai-dial-ui-kit` **2.0** components (`PrimaryButton`,
  `NeutralButton`, `CardShell`, `Avatar`, `Accordion`, `Badge`,
  `Notification`; not the 1.0 `Dial*` ones; `Skeleton` has no 2.0 version, so
  the unprefixed one is used) and `@tabler/icons-react` with
  `stroke={DIAL_KIT_ICON_STROKE}`. Local markup uses kit-preset classes. No
  hardcoded colours, no host-specific code: hosts style the app only through
  MCP tokens.
- Accessibility: native elements first (`button`, `ul`), `aria-expanded`/`aria-controls`
  on disclosure toggles, icons `aria-hidden` with text alternatives.
- Use Context7 for library docs (ext-apps, Vite, Tailwind, React) instead of memory.
- No secrets, tokens or customer/client names in code, fixtures or docs.
- Conventional commits, single line. Git operations only with explicit approval.

## Code style

See `.claude/rules/` (`ts.md`, `react.md`, `tests.md`). Claude Code applies
them automatically by `paths`; other agents (Cursor, Copilot, Codex) should
read the relevant `.claude/rules/*.md` file before editing matching files.

## Review

`agents/code-reviewer.md` is the review rubric (`/review-rubric` in Claude Code).

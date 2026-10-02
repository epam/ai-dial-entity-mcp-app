# ai-dial-skill-mcp-app-frontend

MCP App UI for the skill tool. An **MCP App** is a web page that an MCP server
exposes as a `ui://` resource for one of its tools; MCP Apps hosts (Claude,
ChatGPT, AI DIAL) render it in a sandboxed iframe and talk to it over the
MCP Apps postMessage protocol (`ui/initialize`, tool input/result
notifications, `ui/open-link`, host-context changes).

## Repo map

- `apps/skill-card/` — the skill card app. Builds to one self-contained
  `dist/index.html`.
  - `src/contract.ts` — tool payload type + parser (the contract we own).
  - `src/components/` — UI.
- `apps/skill-card/fixtures/` — payload samples for tests and the dev host.
- `libs/mcp-app-kit/` (`@epam/ai-dial-mcp-app-kit`) — reusable MCP App plumbing.
  Read `libs/mcp-app-kit/AGENTS.md` before changing it.
- `Dockerfile`, `nginx.conf` — serve the file at `/_mcp-app/index.html`.

## Commands

- `npm run dev` — app (:4300) + dev host harness (:4301).
- `npm test` / `npm run test:watch`
- `npm run lint`, `npm run typecheck`, `npm run format`
- `npm run build` — single-file build + check.
- `npm run verify` — lint, format check, typecheck, tests, build. **Run before saying work is done.**

## Hard boundaries

- The kit never imports from `apps/`.
- App code never imports `@modelcontextprotocol/*`, never touches
  `window.parent` or `postMessage`. Use kit APIs (`createMcpApp`,
  `useToolResult`, `useOpenLink`, …). Lint enforces this (`eslint.config.mjs`).
- The app makes no network calls. Anything server-side goes through host tool calls.
- The build must stay a single file. Never relax
  `apps/skill-card/scripts/check-single-file.mjs`.
- Every display mode the app declares must be supported by its UI. The app
  declares `inline` only.

## Working rules

- Read before editing; keep diffs minimal and on-task.
- Payload changes: update `src/contract.ts`, the fixtures and the README
  contract section in the same change.
- Kit API changes: update `libs/mcp-app-kit/README.md` in the same change.
- UI: prefer `@epam/ai-dial-ui-kit` `Dial*` components and `@tabler/icons-react`.
  Local markup uses Tailwind classes from the kit preset (ui-kit tokens). No
  hardcoded colours.
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

`agents/code-reviewer.md` is the review rubric (`/code-review` in Claude Code).

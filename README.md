# ai-dial-entity-mcp-app

## What this is

The MCP App UI for the entity tools. When a tool returns a skill or an agent,
MCP Apps hosts (Claude, ChatGPT and AI DIAL) render this UI inline in the
conversation as an entity card: the name and description, optional labelled
sections (chips or text, chosen by the server) and buttons that open the entity
for a test run or for editing.

The app builds to a single self-contained `index.html` — all JavaScript and CSS
are inlined — so a host can embed it without loading anything else.

Repository layout (npm workspaces):

- `apps/entity-card` — the entity card app (`ai-dial-entity-card`); it renders skill and agent cards. Its build
  output is `apps/entity-card/dist/index.html`.
- `apps/quality-check` — the quality check app (`ai-dial-quality-check`), a separate MCP App with its own tool
  payload. Its build output is `apps/quality-check/dist/index.html`.
- `libs/mcp-app-kit` — `@epam/ai-dial-mcp-app-kit`, the reusable layer every MCP
  App here is built on: host connection, React hooks, host theming, Vite and
  Tailwind theme, test helpers and a local dev host. See
  [its README](libs/mcp-app-kit/README.md).

Outside the workspaces, `tools/` holds development-only tools that are never
shipped, such as `tools/test-mcp-server`, a local MCP server for trying the card
in real hosts (see [its README](tools/test-mcp-server/README.md)).

## How it works

1. The model calls the entity tool (for a skill or an agent). The MCP server returns the card data as
   `structuredContent` and declares a `ui://` resource whose HTML is this app.
2. The host renders that HTML in a sandboxed iframe. The app runs the MCP Apps
   handshake (`ui/initialize`) and applies the host's theme and layout.
3. The host sends the tool result; `parseEntityCardPayload` validates it and the
   card renders (a skeleton shows until then, a notice if the data is invalid,
   and "Couldn't load entity" if the connection to the host or the tool failed,
   the tool was cancelled, or it returned an `isError` result).
4. **Try it** and **Edit** ask the host to open their URL via `ui/open-link`.

The card follows the host's light/dark theme and colours: the card is built
from `@epam/ai-dial-ui-kit` 2.0 components, and the host's MCP style variables
(colours, fonts, type scale, radii, border width) are mapped onto them; a host
that sends none gets ui-kit's own look. See
[Host theming](libs/mcp-app-kit/README.md#host-theming) and the host token
contract there.

## Requirements

- Node.js 24 (pinned in `.nvmrc`; run `nvm use`)
- npm (ships with Node)

## Commands

Run from the repository root.

| Command             | What it does                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install`       | Installs all workspaces.                                                                                                                                                                                     |
| `npm run dev`       | Starts the app dev server on http://localhost:4300 and the dev host harness on http://localhost:4301 (opens in the browser).                                                                                 |
| `npm run build`     | Type-checks and builds the app, then runs `scripts/check-single-file.mjs`: `dist/index.html` must be the only output file, contain no `<script src>` or stylesheet `<link>` references, and be at most 1 MB. |
| `npm test`          | Runs all unit tests once (Vitest).                                                                                                                                                                           |
| `npm run lint`      | Lints the repository (ESLint).                                                                                                                                                                               |
| `npm run typecheck` | Type-checks every workspace.                                                                                                                                                                                 |
| `npm run verify`    | Runs lint, format check, typecheck, tests and build — the full pre-merge check.                                                                                                                              |

`npm run format` applies Prettier formatting; `npm run format:check` only
reports unformatted files.

## Payload contract

### Entity card

The tool must return the card data as its `structuredContent` (hosts that only
forward a JSON text block are handled too). It is parsed by
`parseEntityCardPayload` in
[`apps/entity-card/src/contract.ts`](apps/entity-card/src/contract.ts). The
payload is an object with:

- `entity` (required): `name` and `description` (strings), plus
  optional `initials` and `kindLabel` (strings).
- `actions` (may be missing): optional `tryUrl` and `editUrl` (strings).
- `sections` (optional): an ordered array rendered between the header and the
  buttons. Each item is
  `{ "type": "chips", "label": string, "items": string[] }` or
  `{ "type": "text", "label": string, "text": string }`.

Unknown fields are ignored.

Validation rules applied by `parseEntityCardPayload`:

- `entity.name` and `entity.description` are required non-empty strings;
  anything else shows a "Couldn't display this entity" notice.
- A supplied `initials` is upper-cased and capped at three characters; otherwise
  up to two initials are derived from the words of the name (`?` if there are
  none). `kindLabel` defaults to `Skill`.
- `tryUrl` / `editUrl` must be `http:` or `https:` URLs; any other value is
  dropped and its button is not rendered. Accepted URLs are normalised by URL
  parsing (surrounding whitespace trimmed, scheme and host lower-cased).
- Sections never fail the card. A section with an unknown `type`, an empty
  `label`, no non-empty `items` or empty `text` is skipped; non-string and
  empty chip items are dropped; a `sections` value that is not an array is
  ignored.
- The quality check is a separate app with its own payload, below.

A skill example is in
[`apps/entity-card/fixtures/default.json`](apps/entity-card/fixtures/default.json)
and an agent with sections in
[`apps/entity-card/fixtures/agent.json`](apps/entity-card/fixtures/agent.json);
the other files in `fixtures/` cover missing URLs,
malformed payloads and the section edge cases.

### Quality check

The quality check is a separate MCP App, served from its own page and fed by
its own tool. It is not rendered inside the entity card: each app runs in its
own iframe. The tool returns, as `structuredContent`, parsed by
`parseQualityCheckPayload` in
[`apps/quality-check/src/contract.ts`](apps/quality-check/src/contract.ts):

- `qualityCheck` (required): `passedPercent` (number) and `items`, an array of
  `{ id, label, passed, hint? }` — `id` and `label` non-empty strings, `passed`
  a boolean, `hint` an optional string (shown for failed items only).

`passedPercent` is rounded and clamped to 0–100. Unknown fields are ignored.
A missing or invalid `qualityCheck` shows a "Couldn't display this quality
check" notice. Examples are in
[`apps/quality-check/fixtures/`](apps/quality-check/fixtures/).

## How the MCP server consumes it

The entity card's build output is baked directly into the MCP server image at
build time (see Docker below) and served by the server itself as the
`ui://entity-card/index.html` resource — there is no separate static origin to
deploy or register. The quality check app is not part of that server; it is
kept as components for future use and is not shipped.

For the server's own configuration, tool and resource registration, and
toolset registration in DIAL Admin, see
[`servers/entity-mcp/README.md`](servers/entity-mcp/README.md).

No `resourceDomains` (CSP) entries are needed: the file is self-contained and
loads no external scripts, styles or fonts.

## Docker

The repo ships exactly one Docker image: the MCP server
(`servers/entity-mcp`), built from the root `Dockerfile`, with the built
entity card baked in. `apps/quality-check` is not included in the image.

```sh
make docker-build
make docker-run DIAL_CORE_URL=https://core.example.com
```

To deploy the whole setup (chat, sandbox, server, toolset, quick app), follow
[`docs/deployment.md`](docs/deployment.md).

See [`servers/entity-mcp/README.md`](servers/entity-mcp/README.md) for the
server's required/optional environment variables, its `/mcp` and `/health`
endpoints, and how to register it as a toolset in DIAL Admin. Override the
image name or host port with `make docker-run IMAGE=my-image PORT=9090`.

## Manual check in other hosts

The dev host at http://localhost:4301 covers day-to-day work. Before a release,
also check the built file in real hosts:

1. Run `npm run build`.
2. Start the test MCP server from
   [`tools/test-mcp-server`](tools/test-mcp-server/README.md). Its tool returns
   one of the fixtures as `structuredContent` and its `ui://` resource returns
   the built `apps/entity-card/dist/index.html`.
3. Run MCPJam Inspector with `npx @mcpjam/inspector` and connect it to
   `http://localhost:8080/mcp`.
4. Repeat in Claude, ChatGPT (developer mode) and AI DIAL; for AI DIAL, build
   and run the image as described under Docker above, or push it as
   [`servers/entity-mcp/README.md`](servers/entity-mcp/README.md) describes.
   In each host check that the card renders, the theme follows the host's
   light/dark setting, and the buttons open their links.

## Git hooks

`npm install` runs the `prepare` script, which sets `core.hooksPath` to
`.githooks`. The pre-commit hook runs lint and typecheck. The Docker build
installs with `npm ci --ignore-scripts`, so this step doesn't run there.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues as described in
[SECURITY.md](SECURITY.md), not as public issues.

## License

[Apache License 2.0](LICENSE).

# ai-dial-entity-mcp-app

## What this is

The MCP App UI for the skill tool. When the tool returns a skill, MCP Apps hosts
(Claude, ChatGPT and AI DIAL) render this UI inline in the conversation as a
skill card: the skill's name and description, an optional quality check, and
buttons that open the skill for a test run or for editing.

The app builds to a single self-contained `index.html` — all JavaScript and CSS
are inlined — so a host can embed it without loading anything else.

Repository layout (npm workspaces):

- `apps/entity-card` — the entity card app (`ai-dial-entity-card`); today it renders the skill card. Its build
  output is `apps/entity-card/dist/index.html`.
- `libs/mcp-app-kit` — `@epam/ai-dial-mcp-app-kit`, the reusable layer every MCP
  App here is built on: host connection, React hooks, host theming, Vite and
  Tailwind presets, test helpers and a local dev host. See
  [its README](libs/mcp-app-kit/README.md).

## How it works

1. The model calls the skill tool. The MCP server returns the card data as
   `structuredContent` and declares a `ui://` resource whose HTML is this app.
2. The host renders that HTML in a sandboxed iframe. The app runs the MCP Apps
   handshake (`ui/initialize`) and applies the host's theme and layout.
3. The host sends the tool result; `parseSkillCardPayload` validates it and the
   card renders (a skeleton shows until then, a notice if the data is invalid,
   and "Couldn't load skill" if the connection to the host or the tool failed,
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

The tool must return the card data as its `structuredContent` (hosts that only
forward a JSON text block are handled too). It is parsed by
`parseSkillCardPayload` in
[`apps/entity-card/src/contract.ts`](apps/entity-card/src/contract.ts). The
payload is an object with:

- `skill` (required): `name` and `description` (strings), plus optional
  `initials` and `kindLabel` (strings).
- `actions` (may be missing): optional `tryUrl` and `editUrl` (strings).
- `qualityCheck` (optional): `passedPercent` (number) and `items`, an array
  of `{ id, label, passed, hint? }` — `id` and `label` strings, `passed` a
  boolean, `hint` an optional string.

Unknown fields are ignored.

Validation rules applied by `parseSkillCardPayload`:

- `skill.name` and `skill.description` are required non-empty strings; anything
  else shows a "Couldn't display this skill" notice.
- A supplied `initials` is upper-cased and capped at three characters; otherwise
  up to two initials are derived from the words of the name (`?` if there are
  none). `kindLabel` defaults to `Skill`.
- `tryUrl` / `editUrl` must be `http:` or `https:` URLs; any other value is
  dropped and its button is not rendered. Accepted URLs are normalised by URL
  parsing (surrounding whitespace trimmed, scheme and host lower-cased).
- `qualityCheck` is optional; when present, every item must have a non-empty
  `id` and `label` and a boolean `passed`, and `passedPercent` must be a number
  (it is rounded and clamped to 0–100). An invalid `qualityCheck` also shows
  the "Couldn't display this skill" notice.

A full example is in
[`apps/entity-card/fixtures/with-failures.json`](apps/entity-card/fixtures/with-failures.json);
the other files in `fixtures/` cover the passing, no-quality-check, missing-URL
and malformed cases.

## How the MCP server consumes it

1. Deploy the Docker image (below) so the app is reachable at
   `https://<widget-origin>/_mcp-app/index.html`.
2. Declare the tool's UI resource with a `ui://` URI.
3. On `resources/read` for that URI, fetch
   `https://<widget-origin>/_mcp-app/index.html` and return its body as the
   resource contents with MIME type `text/html;profile=mcp-app`.
4. Return the payload above as the tool result's `structuredContent`.

No `resourceDomains` (CSP) entries are needed: the file is self-contained and
loads no external scripts, styles or fonts.

## Docker

The image builds the app and serves it with unprivileged nginx on port 8080.
Only `/_mcp-app/index.html` and `/` (the same file) are served, with
`Cache-Control: no-cache`; every other path returns 404.

```sh
make docker-build
make docker-run
curl -I http://localhost:8080/_mcp-app/index.html
```

The image needs no environment variables, so one image works in every
environment. It runs as a non-root user and works with a read-only root
filesystem as long as `/tmp` is writable — `make docker-run` starts it that
way, with a tmpfs on `/tmp`. Override the image name or host port with
`make docker-run IMAGE=my-image PORT=9090`.

## Manual check in other hosts

The dev host at http://localhost:4301 covers day-to-day work. Before a release,
also check the built file in real hosts:

1. Run `npm run build`.
2. Run MCPJam Inspector with `npx @mcpjam/inspector` and connect a local MCP
   server whose tool returns one of the fixtures as `structuredContent` and
   whose `ui://` resource returns the built `apps/entity-card/dist/index.html`
   with MIME type `text/html;profile=mcp-app`.
3. Repeat in Claude, ChatGPT (developer mode) and AI DIAL. In each host check
   that the card renders, the theme follows the host's light/dark setting, and
   the buttons open their links.

## Git hooks

`npm install` runs the `prepare` script, which sets `core.hooksPath` to
`.githooks`. The pre-commit hook runs lint and typecheck. The Docker build
installs with `npm ci --ignore-scripts`, so this step doesn't run there.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues as described in
[SECURITY.md](SECURITY.md), not as public issues.

## License

[Apache License 2.0](LICENSE).

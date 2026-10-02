# ai-dial-skill-mcp-app-frontend

## What this is

The MCP App UI for the skill tool. When the tool returns a skill, MCP Apps hosts
(Claude, ChatGPT and AI DIAL) render this UI inline in the conversation as a
skill card: the skill's name and description, an optional quality check, and
buttons that open the skill for a test run or for editing.

The app builds to a single self-contained `index.html` — all JavaScript and CSS
are inlined — so a host can embed it without loading anything else.

Repository layout (npm workspaces):

- `apps/skill-card` — the skill card app (`ai-dial-skill-mcp-app`). Its build
  output is `apps/skill-card/dist/index.html`.
- `libs/mcp-app-kit` — `@epam/ai-dial-mcp-app-kit`, the reusable layer every MCP
  App here is built on: host connection, React hooks, host theming, Vite and
  Tailwind presets, test helpers and a local dev host. See
  [its README](libs/mcp-app-kit/README.md).

## Requirements

- Node.js 24 (pinned in `.nvmrc`; run `nvm use`)
- npm (ships with Node)

## Commands

Run from the repository root.

| Command             | What it does                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`       | Installs all workspaces.                                                                                                                              |
| `npm run dev`       | Starts the app dev server on http://localhost:4300 and the dev host harness on http://localhost:4301 (opens in the browser).                          |
| `npm run build`     | Type-checks and builds the app, then checks that `apps/skill-card/dist/index.html` is the only output file, has no external assets and is under 1 MB. |
| `npm test`          | Runs all unit tests once (Vitest).                                                                                                                    |
| `npm run lint`      | Lints the repository (ESLint).                                                                                                                        |
| `npm run typecheck` | Type-checks every workspace.                                                                                                                          |
| `npm run verify`    | Runs lint, format check, typecheck, tests and build — the full pre-merge check.                                                                       |

`npm run format` applies Prettier formatting; `npm run format:check` only
reports unformatted files.

## Payload contract

The tool must return the card data as its `structuredContent` (hosts that only
forward a JSON text block are handled too). The shape is defined in
[`apps/skill-card/src/contract.ts`](apps/skill-card/src/contract.ts):

```ts
type SkillCardPayload = {
  skill: {
    name: string;
    description: string;
    initials?: string;
    kindLabel?: string;
  };
  actions: { tryUrl?: string; editUrl?: string };
  qualityCheck?: {
    passedPercent: number;
    items: { id: string; label: string; passed: boolean; hint?: string }[];
  };
};
```

Validation rules applied by `parseSkillCardPayload`:

- `skill.name` and `skill.description` are required non-empty strings; anything
  else shows a "Couldn't display this skill" notice.
- `initials` defaults to the first letters of up to two words of the name and is
  capped at three characters; `kindLabel` defaults to `Skill`.
- `tryUrl` / `editUrl` must be `http:` or `https:` URLs; any other value is
  dropped and its button is not rendered.
- `qualityCheck` is optional; when present, every item must have a non-empty
  `id` and `label` and a boolean `passed`. `passedPercent` is rounded and
  clamped to 0–100.

A full example is in
[`apps/skill-card/fixtures/with-failures.json`](apps/skill-card/fixtures/with-failures.json);
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

`make docker-run` starts the container with a read-only root filesystem and a
tmpfs on `/tmp`. Override the image name or host port with
`make docker-run IMAGE=my-image PORT=9090`.

## Manual check in other hosts

The dev host at http://localhost:4301 covers day-to-day work. Before a release,
also check the built file in real hosts:

1. Run `npm run build`.
2. Run MCPJam Inspector with `npx @mcpjam/inspector` and connect a local MCP
   server whose tool returns one of the fixtures as `structuredContent` and
   whose `ui://` resource returns the built `apps/skill-card/dist/index.html`
   with MIME type `text/html;profile=mcp-app`.
3. Repeat in Claude, ChatGPT (developer mode) and AI DIAL. In each host check
   that the card renders, the theme follows the host's light/dark setting, and
   the buttons open their links.

## Git hooks

`npm install` runs the `prepare` script, which sets `core.hooksPath` to
`.githooks`. The pre-commit hook runs lint and typecheck. Outside a git
checkout (for example in the Docker build) the step is skipped.

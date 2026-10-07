# Entity MCP server

The production MCP server for the entity card. It is a stateless Streamable
HTTP MCP server with no stored credentials: every request runs as the calling
user, identified by the inbound `Authorization` header forwarded to DIAL Core
verbatim. It never reads an ambient credential and fails closed when identity
is missing.

It exposes:

- **Tool** `show_entity_card(kind, id)` — `kind` is `"skill"` or `"agent"`;
  `id` is the exact entity id (`skills/{bucket}/{path}` for a skill, the
  deployment id for an agent). It reads the entity from DIAL Core as the
  caller, maps it onto the card payload contract
  (`@epam/ai-dial-entity-contract`), and returns it as `structuredContent`. On
  a Core error, a malformed id, or an entity missing a required field, it
  returns an `isError` result instead of an invalid payload.
- **Resource** `ui://entity-card/index.html` — the built entity card, served
  as `text/html` (DIAL Core rejects `text/html;profile=mcp-app`).

`GET /health` returns `ok`.

## Configuration

There is nothing else to configure:

| Var                        | Required | Default                            | Purpose                                                                          |
| -------------------------- | -------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `DIAL_CORE_BASE_URL`       | **yes**  | —                                  | Where to call Core back. Not a credential; the server fails to start without it. |
| `ENTITY_TRY_URL_TEMPLATE`  | no       | unset                              | Template for the card's Try button URL; unset means no Try button.               |
| `ENTITY_EDIT_URL_TEMPLATE` | no       | unset                              | Template for the card's Edit button URL; unset means no Edit button.             |
| `PORT`                     | no       | `8080`                             | Matches the test server and the proven DIAL Admin registration.                  |
| `APP_HTML`                 | no       | `apps/entity-card/dist/index.html` | Path to the built card, for local runs.                                          |

### Deliberately absent

A future reader should not "helpfully" add these back:

- `DIAL_API_KEY`, `DIAL_USER_JWT` — there is no ambient identity to
  configure; the server forwards the caller's own credential and holds none
  of its own.
- `FIXTURES_DIR` — that belongs to `tools/test-mcp-server`; the shipped
  server has no fixture mode.
- A configurable HTTP timeout — one Core call per request does not justify a
  knob; the timeout is hardcoded to avoid hanging the card.
- `LOG_LEVEL` — same reasoning: no knob until there is more than one log
  level's worth of output to control.

## Run locally

```sh
npm run build -w ai-dial-entity-card
cd servers/entity-mcp
DIAL_CORE_BASE_URL=https://core.example.com npm start
```

The server listens on port 8080 (`PORT` overrides it) and serves `/mcp` and
`/health`.

## Docker image

This is the repo's only shipped artifact, built from the root `Dockerfile`.
Build from the repo root — the build needs the root lockfile and the other
workspace packages:

```sh
make docker-build
make docker-run DIAL_CORE_BASE_URL=https://core.example.com
```

which is equivalent to:

```sh
docker build -t ai-dial-entity-mcp .
docker run --rm -p 8080:8080 -e DIAL_CORE_BASE_URL=https://core.example.com ai-dial-entity-mcp
```

The image runs as the non-root `node` user and exposes port 8080. CI builds
it from the root `Dockerfile` and publishes it as `${{ github.repository }}`
via `.github/workflows/release.yml`, with semantic versioning, release
tagging, Trivy scanning and both registries handled by the shared
`node_release.yml` workflow.

## Toolset registration (DIAL Admin)

Register the deployed container as an MCP toolset with:

- `transport: HTTP`
- `forwardAuthToken: true`
- `forwardPerRequestKey: true`
- `authentication_type: none`
- `allowedTools: ["show_entity_card"]`

`forwardAuthToken` is admin-only to set, so an admin must perform this
registration — it cannot be done by the server owner alone.

## Known Core-side assumptions

The URL builder rejects literal path traversal (`..`, `.` segments) in an
entity id before encoding it, but two related behaviours belong to DIAL Core,
not to this server, and we have not verified them against a live Core:

- whether Core double-decodes percent-encoded path segments before routing
  the request;
- whether Core's backend treats an encoded backslash (`%5C`) as a path
  separator.

If either is true, encoding alone may not be a complete defense against
traversal reaching Core, and this should be verified against a live Core
before this server is trusted with untrusted ids from a wider range of
callers.

- whether Core resolves a percent-encoded `/` (`%2F`) inside the single path
  segment this server sends for a custom-application agent id of the form
  `applications/{bucket}/{path}` (`/openai/applications/applications%2F...`).
  If Core does not decode `%2F` before routing, custom-application agents
  will 404 while bare deployment names keep working. This should be the
  first thing probed against a live Core once the toolset is registered.

## v1 limitations

- The active locale is hardcoded to `en`. The server does not yet read MCP
  host context, so a non-English installation always receives the English
  `displayName`, even though the resolver in `src/mapping/locale.ts` is
  already parameterised for a per-request locale.
- The server reads only the inbound `Authorization` header, not the
  per-request `Api-Key`. Registering the toolset with
  `forwardPerRequestKey: true` is recommended for future-proofing, but
  nothing in the server currently reads that header.
- `APP_HTML`, when given a relative path, resolves against the server's
  `src/` directory (`import.meta.dirname`), not the process's working
  directory. Use an absolute path to avoid surprises.

# Entity MCP server

The production MCP server for the entity card. It is a stateless Streamable
HTTP MCP server with no stored credentials: every request runs as the calling
user, identified by an inbound credential forwarded to DIAL Core verbatim. It
accepts two inbound headers, `Authorization` and `Api-Key` — `Authorization`
wins when both are present, matching DIAL's own auth precedence (user JWT,
then `Api-Key`) — and forwards whichever one it got back to Core under the
same header name. It never reads an ambient credential and fails closed when
neither header is present.

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
| `DIAL_CORE_URL`            | **yes**  | —                                  | Where to call Core back. Not a credential; the server fails to start without it. |
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

## Logging

Every `show_entity_card` call logs exactly one completion line to `console`
— `console.log` on success, `console.error` on failure — carrying the
outcome, the entity kind, the (sanitised) entity id, the call's duration in
milliseconds, and a correlation id.

The correlation id is read once per inbound request, from `X-Correlation-ID`,
else `X-Request-ID`, else `X-Trace-ID`, or generated when the host sent none
of them. It is sent to DIAL Core as `x-correlation-id` on the same request (and
`x-request-id` / `x-trace-id` are forwarded too, when the host sent them), so
this server's log line and Core's logs for that call can be joined on one id.

Credentials are never logged. The `Authorization` and `Api-Key` values never
appear in a log line, in full or in part, on either the success or the
failure path. The entity id and the correlation id are always rendered
through the same sanitiser used for the existing failure logs, so a
caller-controlled value (for example one containing a newline) cannot forge
an extra log entry.

## Run locally

```sh
npm run build -w ai-dial-entity-card
cd servers/entity-mcp
DIAL_CORE_URL=https://core.example.com npm start
```

The server listens on port 8080 (`PORT` overrides it) and serves `/mcp` and
`/health`.

## Docker image

This is the repo's only shipped artifact, built from the root `Dockerfile`.
Build from the repo root — the build needs the root lockfile and the other
workspace packages:

```sh
make docker-build
make docker-run DIAL_CORE_URL=https://core.example.com
```

which is equivalent to:

```sh
docker build -t ai-dial-entity-mcp .
docker run --rm -p 8080:8080 -e DIAL_CORE_URL=https://core.example.com ai-dial-entity-mcp
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
- `APP_HTML`, when given a relative path, resolves against the server's
  `src/` directory (`import.meta.dirname`), not the process's working
  directory. Use an absolute path to avoid surprises.

## Check it works

**1. Card from fixtures, no server, no network** — proves the card renders a
payload correctly:

```sh
npm run dev
```

Open the dev host it prints and pick a fixture from
`apps/entity-card/fixtures`.

**2. This server against a stub Core** — proves credential forwarding and
error mapping without a real DIAL deployment:

```sh
# terminal 1: a stub that only checks which header it received
node -e "
require('node:http').createServer((req, res) => {
  console.log('stub received headers:', req.headers.authorization ?? req.headers['api-key']);
  res.writeHead(200, { 'content-type': 'application/json' })
     .end(JSON.stringify({ attributes: { name: 'stub', description: 'from stub Core' } }));
}).listen(9000);
"

# terminal 2
cd servers/entity-mcp
DIAL_CORE_URL=http://localhost:9000 npm start

# terminal 3
cd tools/mcp-probe && npm ci
DIAL_API_KEY=test-key npm start -- --kind skill --id skills/b/my-skill
DIAL_USER_JWT=test-jwt npm start -- --kind skill --id skills/b/my-skill
```

Terminal 1 should log the `Api-Key` value for the first probe call and the
`Authorization` value for the second.

**3. This server against real Core** — a smoke test, not an access-control
check. Run the server with a real `DIAL_CORE_URL` and call it with a real
`DIAL_API_KEY`:

```sh
cd servers/entity-mcp
DIAL_CORE_URL=https://your-core.example.com npm start

cd tools/mcp-probe && npm ci
DIAL_API_KEY=... npm start -- --kind skill --id skills/your-bucket/your-skill
```

A DIAL API key is often a _service_ key with broader access than a real end
user has, so this may show entities a real user could not see. Treat a
successful call here as proof the plumbing works, not as proof of correct
access control.

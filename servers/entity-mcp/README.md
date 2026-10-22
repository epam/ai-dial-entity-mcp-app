# Entity MCP server

The production MCP server for the entity card. It is a stateless Streamable
HTTP MCP server with no stored credentials: every request runs as the calling
user, identified by an inbound credential forwarded to DIAL Core verbatim. It
accepts two inbound headers, `Authorization` and `Api-Key` — `Authorization`
wins when both are present, matching DIAL's own auth precedence (user JWT,
then `Api-Key`) — and forwards whichever one it got back to Core under the
same header name. It never reads an ambient credential and fails closed when
neither header is present: `show_entity_card` returns an error without one.
`render_entity_card` makes no Core call and does not need a credential.

It exposes:

- **Tool** `show_entity_card({ id?, name?, kind? })` — shows a card for a
  skill, agent, toolset or prompt. Always prefer `id` (from another tool,
  agent or link), the exact entity id
  (`skills/{bucket}/{path}`, `prompts/{bucket}/{path}`,
  `toolsets/{bucket}/{path}`, or a deployment id for an agent): it is fetched
  directly. Otherwise pass `name`: the server lists the caller's skills,
  agents, toolsets and prompts and matches the name (case-insensitive, hyphens,
  underscores and spaces are interchangeable; an exact match wins over a
  partial one; a public entity is dropped when a non-public one of the same
  type matches too, so a published agent does not hide its private source).
  `kind` optionally restricts the search to one type. When
  several entities match, the result lists them with their ids so the caller
  can ask again with an `id`. With neither `id` nor `name` the tool returns an
  error; with both, `id` wins. It reads everything from DIAL Core as the
  caller, maps it onto the card payload contract
  (`@epam/ai-dial-entity-contract`), and returns it as `structuredContent`. On
  a Core error, a malformed id, or an entity without a usable name, it
  returns an `isError` result instead of an invalid payload. An agent or
  toolset with no description gets the card text `No description provided.`
- **Tool** `render_entity_card({ entity, actions?, sections? })` — draws the
  same card from data the caller already has, with no Core lookup and no
  credential. `entity` needs `name` and `description` (optional `kindLabel`,
  `initials`); `actions` holds optional http(s) `tryUrl` / `editUrl`;
  `sections` is a list of `chips` or `text` rows. Invalid input (a non-http(s)
  URL, an empty chips list, an oversized field) returns a tool error. Use it
  when another toolset created or described the entity and the model passes
  the details on.
- **Resource** `ui://entity-card/index.html` — the built entity card, served
  as `text/html` (DIAL Core rejects `text/html;profile=mcp-app`).

`GET /health` returns `ok`.

## Configuration

There is nothing else to configure:

| Var                        | Required | Default                               | Purpose                                                                                                                                                                             |
| -------------------------- | -------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIAL_CORE_URL`            | **yes**  | —                                     | Where to call Core back. Not a credential; the server fails to start without it.                                                                                                    |
| `DIAL_CHAT_URL`            | no       | unset                                 | DIAL Chat origin of this installation (no query or fragment). With it set, Try and Edit use Chat's own routes (below); unset means no buttons unless a template is an absolute URL. |
| `ENTITY_TRY_URL_TEMPLATE`  | no       | Chat route per kind, see Card buttons | Override of the Try button URL for every kind: an absolute URL or a path appended to `DIAL_CHAT_URL` (`{kind}`, `{id}`).                                                            |
| `ENTITY_EDIT_URL_TEMPLATE` | no       | Chat route per kind, see Card buttons | Override of the Edit button URL for every kind: an absolute URL or a path appended to `DIAL_CHAT_URL` (`{kind}`, `{id}`).                                                           |
| `PORT`                     | no       | `8080`                                | Matches the test server and the proven DIAL Admin registration.                                                                                                                     |
| `APP_HTML`                 | no       | `apps/entity-card/dist/index.html`    | Path to the built card, for local runs.                                                                                                                                             |

### Card buttons

With `DIAL_CHAT_URL` set (for example `https://chat.example.com`), the
server appends Chat's routes, so only the domain changes between installations:

| Entity              | Edit                                        | Try                        |
| ------------------- | ------------------------------------------- | -------------------------- |
| Skill               | `/skill-editor?id={id}`                     | none                       |
| Prompt              | `/prompt-editor?id={id}`                    | none                       |
| Toolset             | `/toolset-editor?id={id}`                   | none                       |
| Agent (no schema)   | `/custom-app-editor?id={id}`                | `/?isolated-model-id={id}` |
| Agent (with schema) | `/apps-editor?schema={schemaId}&appId={id}` | `/?isolated-model-id={id}` |

`{schemaId}` is the agent's `application_type_schema_id`. Try depends on Chat's
`?isolated-model-id` query parameter, which opens Chat pinned to that agent
with the agent picker and navigation hidden. Chat marks that parameter for
removal; when it goes, update `TRY_PATHS` in `src/mapping/actions.ts`. An
explicit `ENTITY_TRY_URL_TEMPLATE` / `ENTITY_EDIT_URL_TEMPLATE` replaces the
default for every kind. Overrides may use `{kind}`, `{id}` and `{schemaId}`;
a template that uses `{schemaId}` yields no button for an entity without a
schema.

### Deliberately absent

A future reader should not "helpfully" add these back:

- `DIAL_API_KEY`, `DIAL_USER_JWT` — there is no ambient identity to
  configure; the server forwards the caller's own credential and holds none
  of its own.
- `FIXTURES_DIR` — that belongs to `tools/test-mcp-server`; the shipped
  server has no fixture mode.
- A configurable HTTP timeout — the limits (30 s per Core call, 60 s for the
  full agent and toolset lists, 50 s for a whole name search) are hardcoded to
  avoid hanging the card; nothing here justifies a knob yet.
- `LOG_LEVEL` — same reasoning: no knob until there is more than one log
  level's worth of output to control.

## Adding an entity type

Each entity type is one module in `src/entities/` that implements
`EntityType`: how to recognise a full id, fetch one record, list candidates for
a name search, and map a record onto the card. Add the module to
`src/entities/registry.ts` and write its spec; the tool, the resolver and the
card need no change. Skills, agents, toolsets and prompts are the types
registered today.

## Logging

Every `show_entity_card` call logs one completion line to `console`
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
- `allowedTools: ["show_entity_card", "render_entity_card"]`

`forwardAuthToken` is admin-only to set, so an admin must perform this
registration — it cannot be done by the server owner alone.

## Known Core-side assumptions

The id parsing in `src/entities/ids.ts` rejects literal path traversal (`..`,
`.` segments) in an entity id before encoding it, but two related behaviours belong to DIAL Core,
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
  A probe against one Core (2026-10-08) returned 200 for such an agent id, so
  this works for agents there. The same probe got a 404 for the first custom
  toolset id (`/openai/toolsets/toolsets%2F...`). Core lists resource-based ids
  percent-encoded while its detail routes expect the plain id, which this
  server now sends (list ids are decoded), so that 404 may already be fixed;
  fetching a toolset by its exact `toolsets/...` id has not been re-checked
  against a live Core. A name search is unaffected because it uses the list
  record directly.

## Known gaps

- A name search has a 50 s overall deadline. Calls still running at that point
  are aborted and their types are reported as "could not be searched", so an
  unknown name costs at most that long. A single Core call has its own 30 s
  timeout (60 s for the full agent and toolset lists). The detail fetch of the
  one matched entity comes after the deadline, bounded to the rest of a 60 s
  budget (at least 5 s), so a search ends within about a minute. The search is
  not tied to the MCP host cancelling the request.
- No page cap on list calls: a list follows its pages to the end.
- An exact match anywhere makes the slow agent list unnecessary, so an agent
  found only by a display name that differs from its id is not considered when
  another type already matched exactly. Use `kind: "agent"` to search agents
  on their own.
- `/v1/deployment-names` can list entries the caller cannot read (394 names
  against 385 agents in the full list in one measurement). An exact match on
  such an entry ends in "no longer exists" or "no access" on the detail fetch.
- When a name search finds a match but some type could not be searched, the
  card is shown and the skipped types are only written to the log.
- Entity names, descriptions and prompt content are written by other users and
  go into the tool result unfiltered (the card shows them; the same text is in
  the result's JSON `content`). Prompt bodies make this a larger channel than
  before.
- Skills and prompts are searched in the caller's own bucket only; shared and
  published ones are not. Agents and toolsets come from Core's deployment
  lists, which include private, shared and public entries.
- Custom (bucket-based) agents only appear in a name search when Core's
  `includeCustomApps` setting is on. An exact id fetch works either way.
- Cost per search: `/openai/applications` reads every accessible agent in
  full and can take tens of seconds on a large Core (43 s for 385 agents in
  one measurement). Agents are therefore searched through the cheap
  `/v1/deployment-names?type=application` call first (about a second), where
  only an exact match on the id's name counts, so a loose id match never stands
  in for the right entity. The full agent list, which can also match display
  names that differ from the id, runs when no exact match was found in any
  type, or when the names call failed. Searching a partial name such as
  `digest` therefore takes the slow path unless something matches exactly.
  Toolset, skill and prompt listing is fast enough to stay on the full list.
  The `kind` hint narrows a search further.

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

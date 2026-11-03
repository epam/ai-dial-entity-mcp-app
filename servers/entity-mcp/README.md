# Entity MCP server

The production MCP server for the entity card. It is a stateless Streamable
HTTP MCP server with no stored credentials: every request runs as the calling
user, identified by the `Authorization` header, which is forwarded to DIAL Core
verbatim (a bearer token). It reads no other credential, and in particular never accepts an
`Api-Key`, so a lookup can never run as an application or any other identity.
The Edit button is offered only for an entity in the caller's own bucket
(`GET /v1/bucket`), and only when its URL template is configured.

## Authentication modes

Two registrations are supported. Both end the same way: DIAL Core delivers the
user's token in `Authorization`.

|                                   | Custom OAuth on the toolset                                                           | `NONE` (recommended)                                |
| --------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Toolset `authentication_type`     | `OAUTH`, with your own client                                                         | `NONE`                                              |
| Toolset `forward_auth_token`      | `false`                                                                               | `true`                                              |
| Toolset `forward_per_request_key` | `false`                                                                               | `false`                                             |
| Quick app `forward_auth_token`    | not needed                                                                            | `true`, on every quick app that uses the toolset    |
| Where the token comes from        | the user signs in to the toolset once; Core sends the OAuth token                     | Core forwards the token of the user's own session   |
| Constraint                        | the OAuth client must belong to the same identity provider as the user's DIAL session | none; works with any provider the platform supports |

`forward_auth_token` can only be set by an admin, on the toolset and on each
quick app. With `NONE`, a quick app that lacks the flag sends no token, and a
tool call answers with an error that names `forward_auth_token`. Fix it by
setting the flag, not by signing in. (`CUSTOM_OAUTH_CLIENT=true` on a `NONE`
toolset is a misconfiguration: the server then answers 401, and the user is
shown a sign-in prompt for a toolset that has nothing to sign in to.)

### What requires a credential

Which requests need the caller's token depends on `CUSTOM_OAUTH_CLIENT`.

| JSON-RPC method                                                                 | Default (token forwarded, `NONE`)                                               | `CUSTOM_OAUTH_CLIENT=true`           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| `tools/list`                                                                    | open: nothing in it is user data, so a toolset can be set up before any sign-in | HTTP 401, `WWW-Authenticate: Bearer` |
| `tools/call`                                                                    | the tool answers with an error that names the missing `forward_auth_token`      | HTTP 401, `WWW-Authenticate: Bearer` |
| every other method, e.g. `initialize`, `notifications/*`, `ping`, `resources/*` | open                                                                            | open                                 |

Only a bearer `Authorization` counts; an `Api-Key` or another scheme is treated
as no credential. In both modes a tool never calls Core without a credential.

By default a missing token is not something the user can fix by signing in: an
admin must set `forward_auth_token` on the toolset and on the quick app. So the
server does not challenge; the tool's error text reaches the chat and says what
to enable.

Set `CUSTOM_OAUTH_CLIENT=true` for a toolset registered with its own OAuth
client. DIAL then needs the 401 challenge on `tools/list` to prompt the user to
sign in, and the 401 on `tools/call` keeps a call without a token from reaching
Core. Core reads the card with `initialize` and `resources/read` and sends no
credential for a `NONE` toolset, so those stay open in both modes; the card is
a static page with no user data. The gated set is in `src/http.ts`
(`CREDENTIAL_METHODS`).

It exposes:

- **Tool** `find_entities({ name, kind? })` — finds skills, agents, toolsets
  and prompts by name and answers in plain text; it never shows a card (no UI is
  bound to it). The server lists the caller's entities and matches the name
  (case-insensitive, hyphens, underscores and spaces are interchangeable; an
  exact match wins over a partial one). `kind` optionally restricts the search
  to one type. The text lists each match with its kind, name, id and whether it
  is public or private, then ends with one static next step for the model: one
  exact match, call `show_entity_card` with that id and kind; one partial
  match, call it only if it is clearly the one meant, else ask the user; several
  matches, ask the user which one and call it with the chosen id; no match, say
  so and ask for another name or an id. Names and ids are quoted and clipped,
  the list is capped at 15, and descriptions are never included. A Core error,
  a missing credential or an empty name is an `isError` result.
- **Tool** `show_entity_card({ id, kind? })` — shows the card of one skill,
  agent, toolset or prompt, read by its exact id
  (`skills/{bucket}/{path}`, `prompts/{bucket}/{path}`,
  `toolsets/{bucket}/{path}`, or a deployment id for an agent). It does not
  search and takes no name: with only a name, the model calls `find_entities`
  first. It reads everything from DIAL Core as the caller, maps it onto the
  card payload contract (`@epam/ai-dial-entity-contract`), and returns it as
  `structuredContent`. On a Core error, a malformed id, or an entity without a
  usable name, it returns an `isError` result instead of an invalid payload. An
  agent or toolset with no description gets the card text
  `No description provided.`
- **Resource** `ui://entity-card/index.html` — the built entity card, served
  as `text/html` (DIAL Core rejects `text/html;profile=mcp-app`).

`GET /health` returns `ok`.

## Configuration

There is nothing else to configure:

| Var                                  | Required | Default                            | Purpose                                                                                                                                                                               |
| ------------------------------------ | -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIAL_CORE_URL`                      | **yes**  | —                                  | Where to call Core back. Not a credential; the server fails to start without it.                                                                                                      |
| `CUSTOM_OAUTH_CLIENT`                | no       | `false`                            | Set `true` for a toolset with its own OAuth client: `tools/list` and `tools/call` without a token get a 401 challenge. See [What requires a credential](#what-requires-a-credential). |
| `CHAT_BASE_URL`                      | no       | unset                              | Base URL of the chat this instance serves (no query or fragment). Path templates below are appended to it.                                                                            |
| `ENTITY_EDIT_URL_SKILL`              | no       | unset                              | Edit button for a skill.                                                                                                                                                              |
| `ENTITY_EDIT_URL_PROMPT`             | no       | unset                              | Edit button for a prompt.                                                                                                                                                             |
| `ENTITY_EDIT_URL_TOOLSET`            | no       | unset                              | Edit button for a toolset.                                                                                                                                                            |
| `ENTITY_EDIT_URL_AGENT`              | no       | unset                              | Edit button for an agent without an application type schema.                                                                                                                          |
| `ENTITY_EDIT_URL_AGENT_SCHEMA`       | no       | unset                              | Edit button for an agent with an application type schema (may use `{schemaId}`).                                                                                                      |
| `ENTITY_AGENT_SCHEMA_<KEY>`          | no       | unset                              | An application type schema id, paired by `<KEY>` with `ENTITY_EDIT_URL_AGENT_SCHEMA_<KEY>`.                                                                                           |
| `ENTITY_EDIT_URL_AGENT_SCHEMA_<KEY>` | no       | unset                              | Edit button for agents whose schema id is that of `ENTITY_AGENT_SCHEMA_<KEY>` (may use `{schemaId}`).                                                                                 |
| `ENTITY_TRY_URL_AGENT`               | no       | unset                              | Try button for an agent.                                                                                                                                                              |
| `ENTITY_TRY_URL_SKILL`               | no       | unset                              | Try button for a skill.                                                                                                                                                               |
| `ENTITY_TRY_URL_PROMPT`              | no       | unset                              | Try button for a prompt.                                                                                                                                                              |
| `PORT`                               | no       | `8080`                             | Matches the test server and the proven DIAL Admin registration.                                                                                                                       |
| `APP_HTML`                           | no       | `apps/entity-card/dist/index.html` | Path to the built card, for local runs.                                                                                                                                               |

### Card buttons

A button appears only when its variable is set: there are no built-in routes,
so an instance never links to a page its chat does not have. Run one instance
per chat, each with its own `CHAT_BASE_URL` and the routes of that chat.

A value is a path that starts with `/`, appended to `CHAT_BASE_URL`, or an
absolute `http(s)` URL used as given. Placeholders: `{id}`, the entity id in
the form Core lists it in (each path segment percent-encoded, as DIAL Chat
looks entities up) and then url-encoded, so a space in a name is sent as
`%2520`, and `{schemaId}`, the url-encoded application type schema id of an
agent. An agent with a schema never uses `ENTITY_EDIT_URL_AGENT`, and a
template with `{schemaId}` gives no button for an agent without a schema.

An agent with a schema takes its Edit template from the first of these that
applies:

1. The key whose `ENTITY_AGENT_SCHEMA_<KEY>` equals the agent's schema id
   exactly. `<KEY>` is any name you choose (letters, digits and `_` only; keys differing only by case are separate); a key needs
   both `ENTITY_AGENT_SCHEMA_<KEY>` and `ENTITY_EDIT_URL_AGENT_SCHEMA_<KEY>`,
   and two keys must not name the same schema (the server fails to start).
2. `ENTITY_EDIT_URL_AGENT_SCHEMA`, for every other schema.

With neither, there is no button. Use keys when a chat opens different editors
for different schemas; schema ids differ between installations, so they are
configuration, not code.

At start the server logs which variables are unset and warns about a key missing
one of its two variables, an invalid key name or a template it cannot use.

Example for DIAL Chat. This block is a complete instance configuration: copy it
into the service's environment, then replace the two hosts. Every route and
query parameter is one DIAL Chat serves today; keep it in step with Chat.

```sh
DIAL_CORE_URL=https://core.example.com
CHAT_BASE_URL=https://chat.example.com
ENTITY_EDIT_URL_SKILL='/skill-editor?id={id}'
ENTITY_EDIT_URL_PROMPT='/prompt-editor?id={id}'
ENTITY_EDIT_URL_TOOLSET='/toolset-editor?id={id}'
ENTITY_EDIT_URL_AGENT='/custom-app-editor?id={id}'
ENTITY_EDIT_URL_AGENT_SCHEMA='/apps-editor?schema={schemaId}&appId={id}'
ENTITY_TRY_URL_AGENT='/?deployment-id={id}'
ENTITY_TRY_URL_SKILL='/?skill-id={id}'
ENTITY_TRY_URL_PROMPT='/?prompt-id={id}'
```

Example of keys, for a chat with its own editor for two schemas and none for
the rest:

```sh
ENTITY_AGENT_SCHEMA_QUICKAPP='https://dial.example.com/custom_application_schemas/quickapps2'
ENTITY_EDIT_URL_AGENT_SCHEMA_QUICKAPP='/agent-builder?id={id}'
ENTITY_AGENT_SCHEMA_LOOP='https://dial.example.com/custom_application_schemas/dial-loop'
ENTITY_EDIT_URL_AGENT_SCHEMA_LOOP='/dial-loop-builder?id={id}'
```

A chat that lacks an editor route for a type leaves that variable unset.

#### Try

Try is offered for agents, skills and prompts, never for toolsets, which cannot
be used in a chat. `{id}` is the full entity id, built the same way as for Edit.

DIAL Chat reads `deployment-id`, `skill-id` and `prompt-id` on its
new-conversation route `/` and only preselects the entity: the user can still
switch agent or start another chat.

- `deployment-id` selects the agent for the new conversation (not saved as the
  user's preference). An agent that is hidden or has no `chat` interface falls
  back to the default agent with a warning. The server does not read
  `interfaces` from the Core record today, so it still offers Try for such an
  agent.
- `skill-id` adds the skill to the message input. If the user's current agent
  does not support skills, Chat shows the mention in an error state and blocks
  sending until a skill-capable agent is picked. The server names no agent for
  this, since it has none to name by default.
- `prompt-id` seeds the message input with the prompt text, or opens the
  parameters popup for a parameterized prompt. The text never travels in the
  URL.

The former `isolated-model-id` parameter is replaced by `deployment-id`. A value
that still contains it must be changed to `/?deployment-id={id}`; at start the
server warns about such a value.

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

Every `find_entities` and `show_entity_card` call logs one completion line to `console`
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
- `allowedTools: ["find_entities", "show_entity_card"]`
- the authentication fields of one of the two modes in
  [Authentication modes](#authentication-modes).

For `NONE` that is `authentication_type: none`, `forwardAuthToken: true` and
`forwardPerRequestKey: false`, and `forwardAuthToken: true` on each quick app.
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

- A name search has a 25 s overall deadline. Calls still running at that point
  are aborted. A type whose full list was aborted or failed is still matched by
  id through its cheap names call and reported as "matched by id only, display
  names not checked"; a type with no usable list is reported as "not
  searched". A single Core call has its own 30 s timeout (60 s for the full
  agent and toolset lists), which the search deadline cuts short. The search is
  not tied to the MCP host cancelling the request.
- No page cap on list calls: a list follows its pages to the end.
- `/v1/deployment-names` can list entries the caller cannot read (394 names
  against 385 agents in the full list in one measurement). An exact match on
  such an entry ends in "no longer exists" or "no access" on the detail fetch.
- When a type was not searched in full, `find_entities` says so under the match
  list and softens its next step, so the model checks with the user before
  showing a card.
- Entity names, descriptions and prompt content are written by other users and
  go into the tool result unfiltered (the card shows them; the same text is in
  the result's JSON `content`). Prompt bodies make this a larger channel than
  before.
- Skills and prompts are searched in the caller's own bucket and the `public`
  one; ones shared with the caller but not published are not. Agents and toolsets come from Core's deployment
  lists, which include private, shared and public entries.
- Custom (bucket-based) agents only appear in a name search when Core's
  `includeCustomApps` setting is on. An exact id fetch works either way.
- Cost per search: `/openai/applications` reads every accessible agent in
  full. It took 9 to 10 s for 1438 agents in one measurement (with a service
  key) and 43 s for 385 in an earlier one, so the time does not follow the
  count. It always runs, next to the cheap `/v1/deployment-names?type=application`
  call (about 2 s), because only the full list carries display names, which
  often differ from the id. `/v1/deployments` was measured slower (14 to 23 s)
  and also lists models, so it is not used. The `kind` hint narrows a search to
  one type.

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
  console.log('stub received Authorization:', req.headers.authorization);
  res.writeHead(200, { 'content-type': 'application/json' })
     .end(JSON.stringify({ attributes: { name: 'stub', description: 'from stub Core' } }));
}).listen(9000);
"

# terminal 2
cd servers/entity-mcp
DIAL_CORE_URL=http://localhost:9000 npm start

# terminal 3
cd tools/mcp-probe && npm ci
DIAL_USER_JWT=test-jwt npm start -- --kind skill --id skills/b/my-skill
```

Terminal 1 should log the `Authorization` value `Bearer test-jwt`.

**3. This server against real Core** — a smoke test, not an access-control
check. Run the server with a real `DIAL_CORE_URL` and call it with a real
user JWT:

```sh
cd servers/entity-mcp
DIAL_CORE_URL=https://your-core.example.com npm start

cd tools/mcp-probe && npm ci
DIAL_USER_JWT=... npm start -- --kind skill --id skills/your-bucket/your-skill
```

A DIAL API key is often a _service_ key with broader access than a real end
user has, so this may show entities a real user could not see. Treat a
successful call here as proof the plumbing works, not as proof of correct
access control.

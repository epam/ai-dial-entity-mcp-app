# Deploying ai-dial-entity-mcp-app

The entity card needs four things: a chat that can render MCP Apps, the MCP Apps
sandbox, the entity MCP server, and a toolset (plus, optionally, a quick app)
that points at the server. The steps below go in that order.

## 1. Prerequisites

- DIAL Core with toolsets and quick apps.
- A chat instance that implements the MCP Apps host side (DIAL Chat does).
- A DIAL admin: two flags below can only be set by one.

## 2. The sandbox (separate deployment)

MCP Apps run in a sandbox page served from a **different origin** than the chat.
The app's HTML is untrusted, and the sandbox adds isolation and security: the
app cannot reach the chat's cookies, storage or DOM. Deploy it on its own host.
Set at least:

| Variable                               | Value                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` | the chat's origin, e.g. `https://chat.example.com` (required; without it every request is refused) |

All other variables are described in the sandbox's own README.

## 3. The chat

| Variable                        | Value                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_APP_SANDBOX_URL`           | base URL of the sandbox from step 2. Without it, no card renders.                                                                   |
| `LIVE_CHAT_INTERACTION_ENABLED` | `true`, **only if you use custom OAuth** (step 5). It makes the chat show a sign-in prompt mid-conversation. Not needed for `NONE`. |

If `ENABLED_UI_FEATURES` is set, it must include `live-chat-interaction` for the above.

## 4. The entity MCP server (separate deployment)

Run the image built from the root `Dockerfile`. It listens on `/mcp`, with
`/health` for probes.

| Variable                                    | Required    | Value                                                                                                                                                                                                                                 |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIAL_CORE_URL`                             | yes         | DIAL Core base URL, reachable from this deployment                                                                                                                                                                                    |
| `CHAT_BASE_URL`                             | for buttons | the chat's base URL; the button paths below are appended to it                                                                                                                                                                        |
| `ENTITY_EDIT_URL_*`, `ENTITY_TRY_URL_AGENT` | no          | the card's Edit and Try buttons, one variable per entity type. A button appears only when its variable is set. An agent Edit button chosen by schema needs both `ENTITY_AGENT_SCHEMA_<KEY>` and `ENTITY_EDIT_URL_AGENT_SCHEMA_<KEY>`. |
| `PORT`                                      | no          | default `8080`                                                                                                                                                                                                                        |

Run one instance per chat, each with its own `CHAT_BASE_URL` and routes.
Variable names, placeholders and a DIAL Chat example are in the
[server README](../servers/entity-mcp/README.md#card-buttons).

## 5. The toolset

Create a toolset with:

- endpoint: the host of the deployment from step 4, ending in `/mcp`, e.g.
  `https://ai-dial-entity-mcp-app.example.com/mcp`; transport HTTP
- allowed tool: `show_entity_card`
- an authentication mode, one of (details in
  [Authentication modes](../servers/entity-mcp/README.md#authentication-modes)):

|                           | `NONE` (recommended) | Custom OAuth                                                                          |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| Authentication type       | `NONE`               | `OAUTH`: client ID, secret, endpoints, redirect URI                                   |
| `forward_auth_token`      | `true`               | `false`                                                                               |
| `forward_per_request_key` | `false`, always      | `false`                                                                               |
| Constraint                | none                 | the OAuth client must belong to the same identity provider as the user's chat session |

`forward_auth_token` can only be set by an admin (DIAL Admin or the Core config
API); the chat's toolset editor has no field for it.

## 6. The quick app (optional)

Create a quick app and select the toolset. With `NONE`, an admin must also set
`forward_auth_token: true` on the quick app, and the quick app must be
published: a personal one cannot carry the flag. With custom OAuth nothing
extra is needed; each user signs in to the toolset once.

## 7. Check it works

Ask the chat or the quick app about any DIAL entity (e.g. "give me info about
<agent name>"). The answer should be followed by an entity card.

| Symptom                                            | Cause                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| "Sign-in required … No credentials required" popup | `NONE` mode, but the token is not forwarded: a missing flag on the toolset or the quick app, or the quick app is not published |
| "Failed to load MCP App"                           | `MCP_APP_SANDBOX_URL` unset or wrong, or the sandbox's allowed origin does not match the chat                                  |
| 401 in the server log (`refused unauthenticated`)  | the request carried no bearer token                                                                                            |

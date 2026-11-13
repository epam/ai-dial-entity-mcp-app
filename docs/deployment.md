# Deploying ai-dial-entity-mcp-app

The entity card needs four things: a chat that can render MCP Apps, the MCP Apps
sandbox, the entity MCP server, and a toolset (plus, optionally, a quick app)
that points at the server. The steps below go in that order.

The sandbox is **required**: without it the chat cannot render the card. It is a
separate component shipped with DIAL Chat, with its own docs: the
[MCP Apps overview](https://github.com/epam/ai-dial-chat/blob/development/docs/mcp-apps.md#deploying)
and the
[sandbox README](https://github.com/epam/ai-dial-chat/blob/development/apps/mcp-app-sandbox/README.md).
This document covers only the settings this app needs from it.

## 1. Prerequisites

- DIAL Core with toolsets and quick apps.
- A chat instance that implements the MCP Apps host side (DIAL Chat does).
- The MCP Apps sandbox (step 2), deployed on its own host.
- Decide the public URLs of the chat and the sandbox up front: each one's
  configuration needs the other's origin (steps 2 and 3).
- For custom OAuth (recommended): an OAuth client at your identity provider (step 5).
- A DIAL admin, only for toolset authentication type `NONE` (step 5): it needs a
  flag that only an admin can set. Custom OAuth needs no admin.

## 2. The sandbox (separate deployment)

MCP Apps run in a sandbox page served from a **different origin** than the chat,
so the untrusted app HTML cannot reach the chat's cookies, storage or DOM. Deploy
it on its own host over HTTPS, following the
[sandbox README](https://github.com/epam/ai-dial-chat/blob/development/apps/mcp-app-sandbox/README.md#deployment).
Set at least:

| Variable                               | Value                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` | the chat's origin, e.g. `https://chat.example.com` (required; without it every request is refused) |

All other variables are described in the
[sandbox README](https://github.com/epam/ai-dial-chat/blob/development/apps/mcp-app-sandbox/README.md#environment-variables).

## 3. The chat

These are variables of DIAL Chat's API; see
[MCP Apps configuration](https://github.com/epam/ai-dial-chat/blob/development/apps/chat-api/README.md#mcp-apps-configuration)
in its README.

| Variable                        | Value                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MCP_APP_SANDBOX_URL`           | base URL of the sandbox from step 2. Without it, no card renders.                                                                                                              |
| `ALLOWED_IFRAME_ORIGINS`        | the sandbox's origin from step 2, e.g. `https://sandbox.example.com` (comma-separated, if the list already has other origins). Without it, the chat blocks the sandbox iframe. |
| `LIVE_CHAT_INTERACTION_ENABLED` | `true`, for custom OAuth (step 5, the recommended mode). It makes the chat show a sign-in prompt mid-conversation. Not needed for `NONE`.                                      |

If `ENABLED_UI_FEATURES` is set, it must include `live-chat-interaction` for the above.

The chat builds its Content Security Policy `frame-src` only from
`ALLOWED_IFRAME_ORIGINS`, so the sandbox origin must be listed there. The same
list also feeds `frame-ancestors`, so the sandbox origin is allowed to embed the
chat as well.

## 4. The entity MCP server (separate deployment)

Run the image built from the root `Dockerfile` (`make docker-build` from the repo
root, or the image published by CI). It listens on `/mcp`, with `/health` for
probes: `curl https://<server-host>/health` must succeed.

The only required variable is `DIAL_CORE_URL`. Add `CHAT_BASE_URL` and the
`ENTITY_*` variables to get the Edit and Try buttons.

| Variable                                | Required    | Value                                                                                                                                                                                                                                                             |
| --------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIAL_CORE_URL`                         | yes         | DIAL Core base URL, reachable from this deployment                                                                                                                                                                                                                |
| `CHAT_BASE_URL`                         | for buttons | the chat's base URL; the button paths below are appended to it                                                                                                                                                                                                    |
| `ENTITY_EDIT_URL_*`, `ENTITY_TRY_URL_*` | no          | the card's Edit and Try buttons, one variable per entity type (Try: agent, skill, prompt). A button appears only when its variable is set. An agent Edit button chosen by schema needs both `ENTITY_AGENT_SCHEMA_<KEY>` and `ENTITY_EDIT_URL_AGENT_SCHEMA_<KEY>`. |
| `PORT`                                  | no          | default `8080`                                                                                                                                                                                                                                                    |
| `CUSTOM_OAUTH_CLIENT`                   | no          | default `true`: the toolset has its own OAuth client, so a `tools/call` without a token gets a 401 and DIAL prompts for sign-in. Set `false` only for a toolset with authentication type `NONE` (step 5), which is not recommended.                               |

Run one instance per chat, each with its own `CHAT_BASE_URL` and routes.
Variable names and a copy-pasteable DIAL Chat example are in the
[server README](../servers/entity-mcp/README.md#card-buttons).

## 5. The toolset

Create a toolset with:

- endpoint: the host of the deployment from step 4, ending in `/mcp`, e.g.
  `https://ai-dial-entity-mcp-app.example.com/mcp`; transport `HTTP`
  (Streamable HTTP)
- allowed tools: `find_entities` and `show_entity_card`
- an authentication mode, one of the two below (details in
  [Authentication modes](../servers/entity-mcp/README.md#authentication-modes))

**Custom OAuth is the recommended mode.** `NONE` is the toolset's
**Authentication type** field set to `NONE`: the toolset has no OAuth client of
its own, so DIAL forwards the user's own session token to the MCP server.

|                              | Custom OAuth (recommended)                                                            | `NONE` (opt-in)                                       |
| ---------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Server `CUSTOM_OAUTH_CLIENT` | unset or `true`                                                                       | `false`                                               |
| Authentication type          | `OAUTH`: client ID, secret, endpoints, redirect URI                                   | `NONE`                                                |
| `forward_auth_token`         | `false`                                                                               | `true`                                                |
| `forward_per_request_key`    | `false`                                                                               | `false`, always                                       |
| Constraint                   | the OAuth client must belong to the same identity provider as the user's chat session | the user's whole session token reaches the MCP server |

Prefer custom OAuth: the toolset gets a token with a scope you control. With
`NONE` the user's session token is forwarded, and an agent that also holds other
MCP servers can leak it to them.

`forward_auth_token` can only be set by an admin (in DIAL Admin, or as
`forwardAuthToken` in the configuration JSON); the chat's toolset editor has no
field for it. `forward_per_request_key` is `forwardPerRequestKey` there.

### Configuring the OAuth client (custom OAuth)

Do this at your identity provider; the screens differ, but these are the
things that matter:

1. **Client.** Use an existing OAuth client or create a new one. Copy its
   client ID, secret and endpoints into the toolset's OAuth fields. The client
   itself can be a different one from the chat's, but it must belong to the
   **same identity provider** that users sign in to the chat with. Users then sign in to the toolset once more, but as
   the same user, with the same bucket. With another identity provider the
   MCP server sees a different user and bucket: an entity that is visible in the
   catalog is then not found by the MCP server.
2. **Redirect URI.** Register `<chat origin>/auth/toolset-signin` as an
   allowed redirect URI of the client, e.g.
   `https://chat.example.com/auth/toolset-signin`. The chat origin is the one
   users open in the browser. The same URI goes into the toolset's redirect URI
   field. A mismatch makes the provider reject the sign-in.
3. **Scope.** Allow the `dial` scope for the client and list it in the toolset's
   scopes. Add other scopes only if your provider requires them.

## 6. The quick app (optional)

Create a quick app and select the toolset.

- **Custom OAuth:** nothing extra is needed; each user signs in to the toolset once.
- **`NONE`:** an admin must set `forward_auth_token: true` on the quick app, and
  the quick app must be published: a personal one cannot carry the flag.

## 7. Check it works

Ask the chat or the quick app about any DIAL entity (e.g. "give me info about
<agent name>"). The answer should be followed by an entity card.

| Symptom                                                    | Cause                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Sign-in required … No credentials required" popup         | `NONE` toolset, but the server runs with the default `CUSTOM_OAUTH_CLIENT=true`, so it answers 401; set `CUSTOM_OAUTH_CLIENT=false`, or move the toolset to custom OAuth |
| "Failed to load MCP App"                                   | `MCP_APP_SANDBOX_URL` unset or wrong                                                                                                                                     |
| "Failed to load MCP App"; CSP error in the browser console | the chat's `ALLOWED_IFRAME_ORIGINS` lacks the sandbox's origin                                                                                                           |
| "Failed to load MCP App"; the sandbox answers 403          | the sandbox's `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` does not match the chat's origin                                                                                    |
| Provider error about the redirect URI on sign-in           | `<chat origin>/auth/toolset-signin` is not registered at the OAuth client (step 5)                                                                                       |
| 401 in the server log (`refused unauthenticated`)          | custom OAuth mode (the default) and the request carried no bearer token                                                                                                  |
| Tool error "needs your DIAL identity … forward_auth_token" | `NONE` mode, but the token is not forwarded: a missing flag on the toolset or the quick app, or the quick app is not published                                           |

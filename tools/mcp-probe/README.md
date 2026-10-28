# MCP probe

A small CLI for calling the entity MCP server (or `tools/test-mcp-server`) as
a Streamable-HTTP MCP client. It is not shipped: it exists only so development
and credential-forwarding behaviour can be checked by hand, without a
throwaway script. It is not part of the root workspaces, CI or the release
image.

It connects to an MCP endpoint, lists tools and resources, and — given
`--id` or `--name` (optionally with `--kind`) — calls `show_entity_card` and
prints the result.

## Credential

The probe reads a user JWT from `DIAL_USER_JWT` and sends it as
`Authorization: Bearer <value>`, the way DIAL Core would deliver it to the real
server. The server answers 401 to `tools/list` and `tools/call` without it, so
the probe prints a note when the variable is not set and still connects, which
is how to check the 401 path.

**This env var lives only here, in the dev tool.** The entity MCP server
itself never reads or stores a credential; it only forwards whatever the
inbound request carried.

## Run locally

```sh
cd tools/mcp-probe
npm ci

# against the entity-mcp server
DIAL_USER_JWT=... npm start -- --url http://localhost:8080/mcp --kind skill --id skills/my-bucket/my-skill

# find an entity by name instead of by exact id
DIAL_USER_JWT=... npm start -- --name hhm-joke-skill

# an agent by id
DIAL_USER_JWT=... npm start -- --kind agent --id gpt-4o
```

`--url` defaults to `http://localhost:8080/mcp`.

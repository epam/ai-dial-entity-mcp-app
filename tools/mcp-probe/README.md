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

The probe reads a credential from the environment and sends it the same way
DIAL Core would receive it from the real server, so it can exercise both
headers the entity MCP server accepts:

- `DIAL_API_KEY` is sent as `Api-Key`.
- `DIAL_USER_JWT` is sent as `Authorization: Bearer <value>`.

If both are set, the JWT is used and the probe says so. If neither is set,
the probe still runs — it lists tools and resources — but prints a note that
`show_entity_card` will fail closed, since the server has no credential to
forward.

**This env var lives only here, in the dev tool.** The entity MCP server
itself never reads or stores a credential; it only forwards whatever the
inbound request carried.

## Run locally

```sh
cd tools/mcp-probe
npm ci

# against the entity-mcp server with a DIAL API key
DIAL_API_KEY=... npm start -- --url http://localhost:8080/mcp --kind skill --id skills/my-bucket/my-skill

# find an entity by name instead of by exact id
DIAL_API_KEY=... npm start -- --name hhm-joke-skill

# against a JWT instead
DIAL_USER_JWT=... npm start -- --kind agent --id gpt-4o

# just list tools/resources, no credential
npm start
```

`--url` defaults to `http://localhost:8080/mcp`.

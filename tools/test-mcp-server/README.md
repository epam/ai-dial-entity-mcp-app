# Test MCP server

A local test harness for trying the entity card in real MCP Apps hosts such as
AI DIAL. It is not shipped: in production the UI resource is served by another
MCP server. It is not part of the root workspaces, CI or the release image.

It exposes, over Streamable HTTP at `/mcp`:

- the `show_skill_card` tool, with `_meta.ui.resourceUri` set to
  `ui://entity-card/index.html`. It takes `skill`, the name of a file in
  `apps/entity-card/fixtures` (without `.json`), and returns that fixture as
  `structuredContent`. A missing or unknown `skill` returns an `isError`
  result, which the card shows as its failed state.
- the `ui://entity-card/index.html` resource: the built
  `apps/entity-card/dist/index.html`, served as `text/html`, because DIAL Core
  rejects `text/html;profile=mcp-app`.

`GET /health` returns `ok`.

## Run locally

```sh
npm run build
cd tools/test-mcp-server
npm ci
npm start
```

The server listens on port 8080 (`PORT` overrides it).

## Docker image for DIAL

Build from the repo root. DIAL runs `linux/amd64`, so set the platform when
building on Apple Silicon:

```sh
docker build --platform linux/amd64 -f tools/test-mcp-server/Dockerfile -t <dockerhub-user>/entity-card-test-mcp:latest .
docker push <dockerhub-user>/entity-card-test-mcp:latest
```

The image runs as a non-root user on port 8080. In DIAL Admin, add it under
Deployments → Images with the Remote (HTTP/SSE) transport and the `/mcp` path,
then deploy it as an MCP container and expose it as a toolset.

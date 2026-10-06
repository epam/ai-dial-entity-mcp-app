# Build from the repo root: docker build -f tools/test-mcp-server/Dockerfile .
FROM node:24-alpine AS app
WORKDIR /app
COPY package.json package-lock.json ./
COPY libs/mcp-app-kit/package.json libs/mcp-app-kit/
COPY apps/entity-card/package.json apps/entity-card/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /srv
COPY tools/test-mcp-server/package.json tools/test-mcp-server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY tools/test-mcp-server/server.ts ./
COPY apps/entity-card/fixtures ./fixtures
COPY --from=app /app/apps/entity-card/dist/index.html ./index.html
ENV PORT=8080 APP_HTML=/srv/index.html FIXTURES_DIR=/srv/fixtures
USER node
EXPOSE 8080
CMD ["node", "server.ts"]

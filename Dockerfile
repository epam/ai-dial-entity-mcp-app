FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY libs/mcp-app-kit/package.json libs/mcp-app-kit/
COPY libs/entity-contract/package.json libs/entity-contract/
COPY apps/entity-card/package.json apps/entity-card/
COPY apps/quality-check/package.json apps/quality-check/
COPY servers/entity-mcp/package.json servers/entity-mcp/
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY libs/mcp-app-kit/package.json libs/mcp-app-kit/
COPY libs/entity-contract/package.json libs/entity-contract/
COPY apps/entity-card/package.json apps/entity-card/
COPY apps/quality-check/package.json apps/quality-check/
COPY servers/entity-mcp/package.json servers/entity-mcp/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build -w ai-dial-entity-card

FROM node:24-alpine
# Pick up Alpine security fixes released after the base image was built.
RUN apk upgrade --no-cache
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/servers/entity-mcp/src ./src
RUN find ./src -name '*.spec.ts' -delete
COPY --from=build /app/apps/entity-card/dist/index.html ./card/index.html
ENV PORT=8080 APP_HTML=/app/card/index.html
USER node
EXPOSE 8080
CMD ["node", "src/main.ts"]

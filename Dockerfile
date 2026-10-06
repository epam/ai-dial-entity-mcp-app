FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY libs/mcp-app-kit/package.json libs/mcp-app-kit/
COPY apps/entity-card/package.json apps/entity-card/
COPY apps/quality-check/package.json apps/quality-check/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine3.24
# Pick up Alpine security fixes released after the base image was built.
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/entity-card/dist/index.html /usr/share/nginx/html/_mcp-app/entity-card/index.html
COPY --from=build /app/apps/quality-check/dist/index.html /usr/share/nginx/html/_mcp-app/quality-check/index.html
EXPOSE 8080

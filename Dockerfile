FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY libs/mcp-app-kit/package.json libs/mcp-app-kit/
COPY apps/skill-card/package.json apps/skill-card/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/skill-card/dist/index.html /usr/share/nginx/html/_mcp-app/index.html
EXPOSE 8080

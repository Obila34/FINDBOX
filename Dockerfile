FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_SERVER_MODE=true
RUN npm run build
FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev
COPY server ./server
COPY src/commerce/catalog.json ./src/commerce/catalog.json
RUN mkdir -p /app/private-exports && chown node:node /app/private-exports
USER node
EXPOSE 3001
CMD ["node","server/index.mjs"]
FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

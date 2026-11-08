FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Set OPS_ORIGIN / SCHOOL_ORIGIN (e.g. https://ops.findbox.africa) once their DNS records exist.
ARG OPS_ORIGIN=""
ARG SCHOOL_ORIGIN=""
ENV VITE_SERVER_MODE=true VITE_OPS_URL=$OPS_ORIGIN VITE_SCHOOL_URL=$SCHOOL_ORIGIN
RUN npm run build
# A separate build that contains only the company and developer workspace.
RUN VITE_TARGET=ops npx vite build --outDir dist-ops --emptyOutDir
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
COPY --from=build /app/dist-ops /srv-ops

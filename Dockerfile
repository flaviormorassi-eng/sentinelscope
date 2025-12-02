# syntax=docker/dockerfile:1

# Build client and server bundle
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/.env.example ./
EXPOSE 3001
# Optional runtime tools for health checks and debugging
RUN apk add --no-cache curl

# Container healthcheck hitting the server liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
	CMD curl -fsS http://localhost:3001/healthz || exit 1

CMD ["node", "dist/index.js"]

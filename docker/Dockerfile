# CEO Simulator — multi-stage Docker build
# Stage 1: Build frontend + compile server
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npx vite build
RUN npx tsc --project tsconfig.server.json || true

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app
RUN apk add --no-cache git

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server source (tsx runs TypeScript directly)
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig*.json ./

# Install production deps only
RUN npm ci --omit=dev --ignore-scripts

# Create directories for sessions and brain
RUN mkdir -p .claude/sessions brain

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run server with tsx (TypeScript runner)
CMD ["npx", "tsx", "server/index.ts"]

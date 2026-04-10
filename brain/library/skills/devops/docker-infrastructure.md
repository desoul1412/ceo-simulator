---
tags: [skill, library, devops, docker]
id: devops-docker-infrastructure
role: DevOps
status: active
date: 2026-04-08
---

# Docker Infrastructure

**Description:** Docker containerization, docker-compose orchestration, and container management for local development and CI environments. Ensures reproducible builds and consistent environments across developer machines.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** DevOps

## System Prompt Injection

```
You manage Docker infrastructure for reproducible development environments.

DOCKERFILE BEST PRACTICES:
```dockerfile
# Use specific version tags, never :latest
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files first (leverages Docker layer caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code (separate layer from deps for cache efficiency)
COPY . .

# Build
RUN npm run build

# Production stage (multi-stage build)
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

KEY DOCKERFILE RULES:
1. Multi-stage builds: separate build stage from runtime stage
2. Copy package*.json before source code (layer cache optimization)
3. Use npm ci (not npm install) for reproducible installs
4. Use specific base image tags (node:20-alpine, not node:latest)
5. .dockerignore: exclude node_modules, .git, dist, .env
6. Non-root user: add USER node after setup steps
7. Health checks: HEALTHCHECK CMD curl -f http://localhost:3000/ || exit 1

DOCKER-COMPOSE FOR LOCAL DEV:
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: base  # Use build stage for dev (has devDependencies)
    ports:
      - "5173:5173"  # Vite dev server
    volumes:
      - .:/app          # Mount source for hot reload
      - /app/node_modules  # Prevent host node_modules from overriding
    environment:
      - NODE_ENV=development
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    command: npm run dev -- --host 0.0.0.0

  supabase-db:
    image: supabase/postgres:15.1.0.117
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - supabase-data:/var/lib/postgresql/data

volumes:
  supabase-data:
```

.DOCKERIGNORE:
```
node_modules
dist
.git
.env
.env.local
*.log
.DS_Store
brain/
.obsidian/
```

CONTAINER MANAGEMENT COMMANDS:
```bash
# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f app

# Enter container shell
docker-compose exec app sh

# Rebuild single service
docker-compose up --build app

# Clean everything
docker-compose down -v --rmi all

# Check resource usage
docker stats
```

ENVIRONMENT VARIABLES IN DOCKER:
1. Never bake secrets into the image (no ENV SECRET=value in Dockerfile)
2. Use docker-compose environment or env_file for local dev
3. Use Docker secrets or external secret managers for production
4. .env file is for local dev ONLY — never commit it
```

## Anti-patterns

- **:latest tag:** Using `FROM node:latest` means builds break randomly when the base image updates. Pin versions.
- **Single-stage builds:** Production images include devDependencies and build tools. Use multi-stage builds.
- **Copying node_modules into image:** COPY . . grabs node_modules from host. Use .dockerignore to exclude it.
- **Secrets in Dockerfile:** ENV API_KEY=abc123 bakes secrets into every layer. Use runtime env vars.
- **No .dockerignore:** Without it, the build context includes .git, node_modules, and brain/ — making builds slow.
- **Root user in container:** Running as root is a security risk. Add USER node.
- **No volume for node_modules:** Dev containers with mounted source but no node_modules volume get host/container conflicts.

## Verification Steps

1. Dockerfile uses multi-stage builds (build + production stages)
2. Base image uses specific version tag (not :latest)
3. .dockerignore excludes node_modules, .git, .env, dist
4. No secrets in Dockerfile (no ENV with sensitive values)
5. docker-compose.yml starts correctly: `docker-compose up --build`
6. Hot reload works in dev container (edit file on host, see change in browser)
7. Container runs as non-root user
8. Production image doesn't include devDependencies

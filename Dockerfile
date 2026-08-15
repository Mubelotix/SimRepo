# syntax=docker/dockerfile:1

# =====================================================================
# Stage 1: build the frontend static export (Next.js output: "export")
# =====================================================================
FROM node:23-alpine AS frontend-build
WORKDIR /build

# Root shared deps (shared/ code resolves d3, dayjs, lodash via the root)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

# Frontend deps
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN cd frontend && pnpm i --frozen-lockfile

# Sources needed to compile (@shared => shared/, backend data => backend/data)
COPY shared/ ./shared/
COPY frontend/ ./frontend/

ENV NODE_ENV=production
RUN cd frontend && pnpm build
# produces /build/frontend/out (static site)

# =====================================================================
# Stage 2: runtime (backend API on :8080 + shipped static frontend files)
# =====================================================================
# Node 22+ is required for the backend's node:sqlite immutable DB access.
FROM node:22-alpine AS runtime

ARG GIT_COMMIT
LABEL org.opencontainers.image.revision=${GIT_COMMIT}
ENV GIT_COMMIT=${GIT_COMMIT}

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Root shared deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm i

# Backend deps
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
RUN cd backend && pnpm i

# Source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Frontend static files, exposed for an external nginx to serve.
# Mount this directory into your nginx documents root.
COPY --from=frontend-build /build/frontend/out /app/www

# Backend API port
EXPOSE 8080

# NOTE: the repo dataset is large and gitignored, so bind-mount it at runtime:
#   -v <host>/repos.sqlite:/app/repos.sqlite

WORKDIR /app/backend
CMD ["./node_modules/.bin/tsx", "main.ts"]

# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API Dockerfile (Optimized for Pnpm Workspace)
# --------------------------------

# --------------------------------
# Stage 1: Builder
# --------------------------------
FROM node:24-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

# 1. Copy Workspace Configs (leverage cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json nest-cli.json tsconfig*.json prisma.config.ts ./

# 2. Copy target app package.json (for dependency resolution)
COPY apps/admin-api/package.json apps/admin-api/package.json

# 3. Install dependencies
# Use --frozen-lockfile to ensure consistent versions
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store pnpm install --frozen-lockfile

# 4. Copy source code (Optimized: only copy relevant directories)
COPY libs libs
COPY prisma prisma
COPY apps/admin-api apps/admin-api

# 5. Generate Prisma Client
# Set temporary DATABASE_URL (Prisma needs it to generate Client)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm prisma:generate

# 6. Build application
RUN pnpm build:admin

# 7. Deploy production dependencies (Core optimization)
# Use pnpm deploy to export a standalone package with only production deps
RUN pnpm --filter=@apps/admin-api --prod deploy --legacy /prod/admin-api

# 8. Deep clean node_modules
WORKDIR /prod/admin-api
# Install node-prune
RUN wget https://gobinaries.com/tj/node-prune --output-document - | /bin/sh && node-prune

# 9. Organize build artifacts
WORKDIR /app
# Copy build artifacts to deployment directory
# Note: Due to monorepo build structure, main.js path might be deep
RUN cp -r dist /prod/admin-api/dist && \
    cp -r prisma /prod/admin-api/prisma && \
    cp prisma.config.ts /prod/admin-api/prisma.config.ts

# --------------------------------
# Stage 2: Runtime
# --------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ="Asia/Shanghai"

RUN apk add --no-cache dumb-init tzdata

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 1. Copy production dependencies and app code
COPY --from=builder --chown=nestjs:nodejs /prod/admin-api ./

# Create log directories
RUN install -d -m 0755 -o nestjs -g nodejs /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/admin

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

# Note: Check the path if it changes
CMD ["node", "dist/apps/admin-api/apps/admin-api/src/main.js"]

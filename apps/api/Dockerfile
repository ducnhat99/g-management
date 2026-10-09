# API image for Render. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t gold-api .

FROM node:24-slim AS base
# Prisma's query engine needs OpenSSL; slim images do not ship it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# 1. Keep only the api app and the workspace packages it depends on.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.7 prune api --docker

# 2. Install (cached until a package.json or the lockfile changes), then build.
FROM base AS builder
COPY --from=pruner /app/out/json/ .
# The api's postinstall runs `prisma generate`, which needs the schema and config.
COPY --from=pruner /app/out/full/apps/api/prisma ./apps/api/prisma
COPY --from=pruner /app/out/full/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=api

# 3. Run as the unprivileged node user. Migrations are applied on every start (a no-op when there
#    is nothing new), using DIRECT_URL (Supabase session pooler).
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main"]

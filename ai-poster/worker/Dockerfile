FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY worker/package.json worker/
COPY shared/package.json shared/
COPY prisma/ prisma/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Build ──
FROM deps AS build
COPY shared/ shared/
COPY worker/ worker/
COPY prisma/ prisma/
COPY tsconfig.base.json ./
RUN ./worker/node_modules/.bin/prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter worker build

# ── Production image ──
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/worker/node_modules ./worker/node_modules
COPY --from=build /app/worker/dist ./worker/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma/ prisma/

ENV NODE_ENV=production

CMD ["node", "worker/dist/main"]

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY prisma/ prisma/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Generate Prisma client ──
FROM deps AS prisma
COPY prisma/ prisma/
RUN pnpm dlx prisma generate --schema=prisma/schema.prisma

# ── Build ──
FROM prisma AS build
COPY shared/ shared/
COPY backend/ backend/
COPY tsconfig.base.json ./
RUN pnpm --filter backend build

# ── Production image ──
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma/ prisma/

RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "backend/dist/main"]

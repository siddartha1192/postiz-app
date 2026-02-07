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

# ── Build ──
FROM deps AS build
COPY shared/ shared/
COPY backend/ backend/
COPY prisma/ prisma/
COPY tsconfig.base.json ./
RUN ./backend/node_modules/.bin/prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter backend build

# ── Production image ──
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma/ prisma/

RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "backend/dist/main"]

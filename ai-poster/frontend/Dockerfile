FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Build ──
FROM deps AS build
COPY shared/ shared/
COPY frontend/ frontend/
COPY tsconfig.base.json ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter frontend build

# ── Production: serve with nginx ──
FROM nginx:alpine AS production
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# AI Poster - Server Deployment Guide

This guide covers deploying AI Poster on a Linux server (Ubuntu/Debian) using Docker or manual setup.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option A: Docker Deployment (Recommended)](#option-a-docker-deployment-recommended)
3. [Option B: Manual Deployment](#option-b-manual-deployment)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [SSL / HTTPS with Nginx](#ssl--https-with-nginx)
7. [Social Media OAuth Setup](#social-media-oauth-setup)
8. [Monitoring & Logs](#monitoring--logs)
9. [Backup & Recovery](#backup--recovery)
10. [Updating](#updating)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

| Resource   | Minimum     | Recommended  |
|------------|-------------|--------------|
| CPU        | 2 vCPU      | 4 vCPU       |
| RAM        | 4 GB        | 8 GB         |
| Disk       | 20 GB SSD   | 50 GB SSD    |
| OS         | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 |

### Required Software

- **Node.js** >= 20.x
- **pnpm** >= 9.x
- **PostgreSQL** >= 16
- **Redis** >= 7
- **Docker** >= 24 + Docker Compose v2 (for Docker deployment)
- **Nginx** (for reverse proxy / SSL)
- **Git**

### Required Accounts / API Keys

- **OpenAI API key** (for AI content generation)
- OAuth credentials for each social platform you want to connect (see [Social Media OAuth Setup](#social-media-oauth-setup))

---

## Option A: Docker Deployment (Recommended)

This is the simplest way to deploy. All services run as containers.

### Step 1: Clone and navigate

```bash
git clone <your-repo-url> /opt/ai-poster
cd /opt/ai-poster/ai-poster
```

### Step 2: Create environment file

```bash
cp .env.example .env
nano .env
```

Fill in all required values (see [Environment Configuration](#environment-configuration)).

**Important**: For Docker, use Docker service names for hosts:
```env
DATABASE_URL="postgresql://postgres:YOUR_STRONG_PASSWORD@postgres:5432/ai_poster?schema=public"
REDIS_URL="redis://:YOUR_REDIS_PASSWORD@redis:6379"
```

### Step 3: Build and start

```bash
# Build all images
docker compose -f docker-compose.prod.yml build

# Start all services
docker compose -f docker-compose.prod.yml up -d
```

### Step 4: Run database migrations

```bash
# Run Prisma migrations inside the backend container
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy --schema=/app/prisma/schema.prisma
```

### Step 5: Verify

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Check backend health
curl http://localhost:3001/api/health

# Check frontend
curl http://localhost:80
```

### Docker Commands Reference

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend    # specific service

# Restart a service
docker compose -f docker-compose.prod.yml restart backend

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (WARNING: deletes data)
docker compose -f docker-compose.prod.yml down -v

# Rebuild a single service
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
```

---

## Option B: Manual Deployment

Use this if you prefer running services directly on the host or have existing PostgreSQL/Redis instances.

### Step 1: Install system dependencies

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# pnpm
corepack enable
corepack prepare pnpm@9 --activate

# PostgreSQL 16
sudo apt-get install -y postgresql-16

# Redis 7
sudo apt-get install -y redis-server

# Nginx
sudo apt-get install -y nginx

# Build essentials (needed for native Node modules like sharp)
sudo apt-get install -y build-essential python3
```

### Step 2: Set up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER ai_poster WITH PASSWORD 'YOUR_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE ai_poster OWNER ai_poster;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_poster TO ai_poster;"
```

### Step 3: Set up Redis

```bash
# Edit Redis config to set a password
sudo nano /etc/redis/redis.conf
# Uncomment and set: requirepass YOUR_REDIS_PASSWORD

sudo systemctl restart redis
```

### Step 4: Clone and install

```bash
git clone <your-repo-url> /opt/ai-poster
cd /opt/ai-poster/ai-poster

# Install all dependencies
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
DATABASE_URL="postgresql://ai_poster:YOUR_STRONG_PASSWORD@localhost:5432/ai_poster?schema=public" \
  npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Step 5: Create environment file

```bash
cp .env.example .env
nano .env
```

Fill in all values with localhost addresses:
```env
DATABASE_URL="postgresql://ai_poster:YOUR_STRONG_PASSWORD@localhost:5432/ai_poster?schema=public"
REDIS_URL="redis://:YOUR_REDIS_PASSWORD@localhost:6379"
FRONTEND_URL="https://yourdomain.com"
BACKEND_URL="https://yourdomain.com"
JWT_SECRET="generate-a-64-char-random-string"
OPENAI_API_KEY="sk-..."
```

### Step 6: Build all packages

```bash
pnpm build
```

### Step 7: Build frontend for production

```bash
pnpm build:frontend
```

The built files will be in `frontend/dist/`.

### Step 8: Set up systemd services

Create systemd unit files to keep the backend and worker running.

**Backend** (`/etc/systemd/system/ai-poster-backend.service`):

```ini
[Unit]
Description=AI Poster Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ai-poster/ai-poster
EnvironmentFile=/opt/ai-poster/ai-poster/.env
ExecStart=/usr/bin/node backend/dist/main
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Worker** (`/etc/systemd/system/ai-poster-worker.service`):

```ini
[Unit]
Description=AI Poster Background Worker
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ai-poster/ai-poster
EnvironmentFile=/opt/ai-poster/ai-poster/.env
ExecStart=/usr/bin/node worker/dist/main
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-poster-backend ai-poster-worker
sudo systemctl start ai-poster-backend ai-poster-worker

# Check status
sudo systemctl status ai-poster-backend
sudo systemctl status ai-poster-worker
```

---

## Database Setup

### Initial Migration

For a fresh database, run migrations to create all tables:

```bash
# Docker
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate deploy --schema=/app/prisma/schema.prisma

# Manual
cd /opt/ai-poster/ai-poster
npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Creating the First Migration

If no migration files exist yet, create the initial migration:

```bash
# From the ai-poster/ directory
npx prisma migrate dev --name init --schema=prisma/schema.prisma
```

This creates the migration SQL in `prisma/migrations/` and applies it.

### Inspecting the Database

```bash
# Open Prisma Studio (local dev only)
pnpm prisma:studio

# Or connect with psql
psql -h localhost -U ai_poster -d ai_poster
```

---

## Environment Configuration

Copy `.env.example` to `.env` and fill in all values:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/ai_poster?schema=public` |
| `REDIS_URL` | Redis connection string | `redis://:password@host:6379` |
| `JWT_SECRET` | Random 64+ char secret for auth tokens | `openssl rand -hex 32` |
| `JWT_EXPIRATION` | Token lifetime | `7d` |
| `FRONTEND_URL` | Public URL of frontend | `https://yourdomain.com` |
| `BACKEND_URL` | Public URL of backend API | `https://yourdomain.com` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | `sk-proj-...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PROVIDER` | File storage type | `local` |
| `UPLOAD_DIRECTORY` | Path for uploaded files | `./uploads` |
| `APP_PORT` | Port for frontend (Docker) | `80` |

### Generating a Secure JWT Secret

```bash
openssl rand -hex 32
```

### Docker-Specific Database/Redis Hosts

When using Docker Compose, services communicate by service name:
- PostgreSQL host: `postgres` (not `localhost`)
- Redis host: `redis` (not `localhost`)

---

## SSL / HTTPS with Nginx

### For Docker Deployment

The frontend container serves on port 80. Add an Nginx reverse proxy on the host for SSL.

Create `/etc/nginx/sites-available/ai-poster`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 50M;

    # Forward everything to the Docker frontend container
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> Note: If Docker frontend uses port 80, change the host Nginx listen to a different port or bind Docker to a different port (e.g., `APP_PORT=8080`).

### For Manual Deployment

Serve the frontend static files and proxy API requests:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /opt/ai-poster/ai-poster/frontend/dist;
    index index.html;

    client_max_body_size 50M;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Install SSL with Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo systemctl reload nginx
```

Enable auto-renewal:

```bash
sudo certbot renew --dry-run
# Cron auto-renewal is set up automatically by certbot
```

---

## Social Media OAuth Setup

Each platform requires registering a developer application to get OAuth credentials. Set the callback URL to `https://yourdomain.com/api/integrations/callback/{platform}`.

### Twitter/X
1. Go to https://developer.twitter.com/en/portal
2. Create a project and app
3. Enable OAuth 2.0 with PKCE
4. Set callback URL: `https://yourdomain.com/api/integrations/callback/twitter`
5. Copy API Key and API Secret to `X_API_KEY` and `X_API_SECRET`

### LinkedIn
1. Go to https://www.linkedin.com/developers/apps
2. Create an app, request `r_liteprofile`, `r_emailaddress`, `w_member_social`
3. Set redirect URL: `https://yourdomain.com/api/integrations/callback/linkedin`
4. Copy Client ID/Secret to `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`

### Facebook / Instagram
1. Go to https://developers.facebook.com
2. Create an app (Business type)
3. Add Facebook Login and Instagram Graph API products
4. Set redirect URI: `https://yourdomain.com/api/integrations/callback/facebook`
5. Request permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
6. Copy App ID/Secret to `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`

### YouTube
1. Go to https://console.cloud.google.com
2. Create a project, enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Set redirect URI: `https://yourdomain.com/api/integrations/callback/youtube`
5. Copy to `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`

### TikTok
1. Go to https://developers.tiktok.com
2. Create an app, request `video.upload` and `video.publish`
3. Set redirect URI: `https://yourdomain.com/api/integrations/callback/tiktok`
4. Copy to `TIKTOK_CLIENT_ID` and `TIKTOK_CLIENT_SECRET`

### Reddit
1. Go to https://www.reddit.com/prefs/apps
2. Create a "web app"
3. Set redirect URI: `https://yourdomain.com/api/integrations/callback/reddit`
4. Copy to `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`

### Pinterest
1. Go to https://developers.pinterest.com
2. Create an app
3. Set redirect URI: `https://yourdomain.com/api/integrations/callback/pinterest`
4. Copy to `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET`

### Discord
1. Go to https://discord.com/developers/applications
2. Create an application, add a bot
3. Enable `Send Messages` permission
4. Set redirect URI: `https://yourdomain.com/api/integrations/callback/discord`
5. Copy to `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`

### Slack
1. Go to https://api.slack.com/apps
2. Create an app from scratch
3. Add OAuth scopes: `chat:write`, `files:write`
4. Set redirect URL: `https://yourdomain.com/api/integrations/callback/slack`
5. Copy to `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`

### Mastodon
1. On your Mastodon instance, go to Preferences > Development > New Application
2. Set redirect URI: `https://yourdomain.com/api/integrations/callback/mastodon`
3. Copy to `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET`, `MASTODON_URL`

### Bluesky
- No OAuth required. Users authenticate with their handle and app password.
- No env variables needed.

### Dribbble
1. Go to https://dribbble.com/account/applications
2. Register a new application
3. Set callback URL: `https://yourdomain.com/api/integrations/callback/dribbble`
4. Copy to `DRIBBBLE_CLIENT_ID` and `DRIBBBLE_CLIENT_SECRET`

---

## Monitoring & Logs

### Docker Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service with tail
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

# Worker logs (background jobs)
docker compose -f docker-compose.prod.yml logs -f worker
```

### Systemd Logs (Manual Deployment)

```bash
# Backend
sudo journalctl -u ai-poster-backend -f

# Worker
sudo journalctl -u ai-poster-worker -f

# Last 100 lines
sudo journalctl -u ai-poster-backend -n 100 --no-pager
```

### Health Checks

```bash
# Backend API
curl -s http://localhost:3001/api/health

# PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### Resource Monitoring

```bash
# Docker stats
docker stats

# System resources
htop
df -h
free -m
```

---

## Backup & Recovery

### Database Backup

```bash
# Docker
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres ai_poster > backup_$(date +%Y%m%d_%H%M%S).sql

# Manual
pg_dump -h localhost -U ai_poster ai_poster > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore

```bash
# Docker
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres ai_poster

# Manual
psql -h localhost -U ai_poster ai_poster < backup.sql
```

### Automated Daily Backups (Cron)

```bash
sudo crontab -e
```

Add:
```cron
0 2 * * * cd /opt/ai-poster/ai-poster && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres ai_poster | gzip > /opt/backups/ai-poster-$(date +\%Y\%m\%d).sql.gz
0 3 * * * find /opt/backups -name "ai-poster-*.sql.gz" -mtime +30 -delete
```

### Media/Uploads Backup

```bash
# Docker
docker cp ai-poster-backend:/app/uploads ./uploads-backup

# Manual
rsync -avz /opt/ai-poster/ai-poster/uploads/ /opt/backups/uploads/
```

---

## Updating

### Docker Deployment

```bash
cd /opt/ai-poster

# Pull latest code
git pull origin main

cd ai-poster

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run any new migrations
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate deploy --schema=/app/prisma/schema.prisma
```

### Manual Deployment

```bash
cd /opt/ai-poster

# Pull latest code
git pull origin main

cd ai-poster

# Install updated deps
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Run migrations
npx prisma migrate deploy --schema=prisma/schema.prisma

# Rebuild
pnpm build

# Restart services
sudo systemctl restart ai-poster-backend ai-poster-worker

# If frontend changed, rebuild and nginx will serve new files
pnpm build:frontend
```

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend
# or
sudo journalctl -u ai-poster-backend -n 50

# Common causes:
# - DATABASE_URL is wrong or Postgres is not running
# - Missing JWT_SECRET
# - Port 3001 already in use
```

### Database connection refused

```bash
# Check if Postgres is running
docker compose -f docker-compose.prod.yml ps postgres
# or
sudo systemctl status postgresql

# Test connection
psql -h localhost -U ai_poster -d ai_poster -c "SELECT 1"
```

### Redis connection refused

```bash
# Check if Redis is running
docker compose -f docker-compose.prod.yml ps redis
# or
sudo systemctl status redis

# Test connection
redis-cli -a YOUR_REDIS_PASSWORD ping
```

### Worker not processing jobs

```bash
# Check worker logs
docker compose -f docker-compose.prod.yml logs -f worker

# Verify Redis connection
docker compose -f docker-compose.prod.yml exec redis redis-cli -a YOUR_REDIS_PASSWORD KEYS "bull:*"
```

### Prisma migration errors

```bash
# Check migration status
npx prisma migrate status --schema=prisma/schema.prisma

# Reset database (WARNING: deletes all data)
npx prisma migrate reset --schema=prisma/schema.prisma

# Force apply pending migrations
npx prisma migrate deploy --schema=prisma/schema.prisma
```

### File upload issues

```bash
# Check upload directory permissions
ls -la /opt/ai-poster/ai-poster/uploads/

# Fix permissions
sudo chown -R www-data:www-data /opt/ai-poster/ai-poster/uploads/
sudo chmod -R 755 /opt/ai-poster/ai-poster/uploads/

# Docker: check volume
docker volume inspect ai-poster_uploads_data
```

### Frontend shows blank page

```bash
# Check if built files exist
ls frontend/dist/

# Rebuild
pnpm build:frontend

# Check nginx config
sudo nginx -t
sudo systemctl reload nginx
```

### OAuth callback errors

- Ensure your callback URLs exactly match what's registered with each platform
- Check that `FRONTEND_URL` and `BACKEND_URL` in `.env` match your actual domain
- Verify SSL is working (most platforms require HTTPS for callbacks)

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Nginx     │────>│   Frontend   │     │  PostgreSQL  │
│ (SSL/Proxy) │     │  (React SPA) │     │     :5432    │
│   :443      │     │  :80 (nginx) │     └──────┬───────┘
└──────┬──────┘     └──────────────┘            │
       │                                         │
       │ /api/*                                  │
       │                                         │
       v                                         │
┌──────────────┐                          ┌──────┴───────┐
│   Backend    │─────────────────────────>│    Redis      │
│  (NestJS)    │                          │    :6379      │
│   :3001      │                          └──────┬───────┘
└──────────────┘                                 │
                                                 │
                                          ┌──────┴───────┐
                                          │   Worker      │
                                          │  (BullMQ)     │
                                          │  Background   │
                                          └──────────────┘
```

### Services

| Service    | Port | Description |
|------------|------|-------------|
| Frontend   | 80   | React SPA served by Nginx |
| Backend    | 3001 | NestJS REST API |
| Worker     | -    | BullMQ background job processor |
| PostgreSQL | 5432 | Primary database |
| Redis      | 6379 | Job queues and caching |

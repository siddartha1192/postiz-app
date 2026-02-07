#!/bin/bash
# ─────────────────────────────────────────────────────────
# SSL Certificate Initialization Script
# Run this ONCE before first docker-compose up
#
# Usage:
#   ./init-ssl.sh yourdomain.com your@email.com
#
# This will:
#   1. Create a temporary self-signed certificate
#   2. Start nginx with that cert
#   3. Request a real Let's Encrypt certificate
#   4. Restart nginx with the real cert
# ─────────────────────────────────────────────────────────

set -e

DOMAIN=${1:-${APP_DOMAIN}}
EMAIL=${2:-${CERTBOT_EMAIL}}

if [ -z "$DOMAIN" ]; then
  echo "Error: Domain is required."
  echo "Usage: ./init-ssl.sh yourdomain.com your@email.com"
  exit 1
fi

if [ -z "$EMAIL" ]; then
  echo "Error: Email is required for Let's Encrypt notifications."
  echo "Usage: ./init-ssl.sh yourdomain.com your@email.com"
  exit 1
fi

echo "================================================"
echo "  SSL Certificate Setup for: $DOMAIN"
echo "  Email: $EMAIL"
echo "================================================"

# Create required directories
echo "[1/5] Creating directories..."
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Check if certificate already exists
if [ -d "./certbot/conf/live/$DOMAIN" ]; then
  echo "Certificate for $DOMAIN already exists."
  read -p "Do you want to renew it? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping. Use 'docker compose -f docker-compose.prod.yml restart nginx-proxy' to apply."
    exit 0
  fi
fi

# Step 1: Create a temporary self-signed certificate so nginx can start
echo "[2/5] Creating temporary self-signed certificate..."
mkdir -p ./certbot/conf/live/$DOMAIN
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "./certbot/conf/live/$DOMAIN/privkey.pem" \
  -out "./certbot/conf/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=$DOMAIN" 2>/dev/null

echo "[3/5] Starting nginx-proxy with temporary certificate..."
# Export for docker-compose
export APP_DOMAIN=$DOMAIN
export CERTBOT_EMAIL=$EMAIL

docker compose -f docker-compose.prod.yml up -d nginx-proxy

# Wait for nginx to be ready
echo "Waiting for nginx to start..."
sleep 5

# Step 2: Request real certificate from Let's Encrypt
echo "[4/5] Requesting Let's Encrypt certificate..."
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 3: Reload nginx with real certificate
echo "[5/5] Reloading nginx with real certificate..."
docker compose -f docker-compose.prod.yml exec nginx-proxy nginx -s reload

echo ""
echo "================================================"
echo "  SSL setup complete!"
echo "  Your site is now available at:"
echo "    https://$DOMAIN"
echo ""
echo "  Certificate will auto-renew via certbot."
echo ""
echo "  Make sure your .env has:"
echo "    APP_DOMAIN=$DOMAIN"
echo "    CERTBOT_EMAIL=$EMAIL"
echo "    FRONTEND_URL=https://$DOMAIN"
echo "    BACKEND_URL=https://$DOMAIN"
echo "    COOKIE_SECURE=true"
echo "================================================"

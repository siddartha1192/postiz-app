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
echo "[1/6] Creating directories..."
mkdir -p ./certbot/conf/live/$DOMAIN
mkdir -p ./certbot/conf/archive/$DOMAIN
mkdir -p ./certbot/www

# Check if real certificate already exists
if [ -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ] && \
   ! openssl x509 -in "./certbot/conf/live/$DOMAIN/fullchain.pem" -noout -issuer 2>/dev/null | grep -q "CN = $DOMAIN"; then
  echo "A certificate for $DOMAIN already exists."
  read -p "Do you want to replace it? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping. Restart nginx-proxy to apply existing cert."
    exit 0
  fi
fi

# Step 1: Create a temporary self-signed certificate so nginx can start
echo "[2/6] Creating temporary self-signed certificate..."
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "./certbot/conf/live/$DOMAIN/privkey.pem" \
  -out "./certbot/conf/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=$DOMAIN" 2>/dev/null

# Export for docker-compose
export APP_DOMAIN=$DOMAIN
export CERTBOT_EMAIL=$EMAIL

# Step 2: Build and start everything
echo "[3/6] Starting services..."
docker compose -f docker-compose.prod.yml up -d --build

# Wait for nginx to be ready
echo "[4/6] Waiting for nginx to be ready..."
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost/.well-known/acme-challenge/test 2>/dev/null | grep -q "404\|301\|200"; then
    echo "Nginx is ready!"
    break
  fi
  echo "  Waiting... attempt $i/15"
  sleep 3
done

# Step 3: Request real certificate from Let's Encrypt
echo "[5/6] Requesting Let's Encrypt certificate for $DOMAIN..."
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --cert-name "$DOMAIN" \
  --force-renewal \
  -d "$DOMAIN"

# Step 4: Restart nginx to pick up the real certificate
echo "[6/6] Restarting nginx-proxy with real certificate..."
docker compose -f docker-compose.prod.yml restart nginx-proxy

# Wait and verify
sleep 3
echo ""
echo "Verifying SSL..."
if curl -sI "https://$DOMAIN" 2>/dev/null | head -1 | grep -q "200\|301\|302"; then
  echo "  HTTPS is working!"
else
  echo "  Note: HTTPS verification via curl failed (may still work in browser)."
  echo "  Check: docker compose -f docker-compose.prod.yml logs nginx-proxy"
fi

echo ""
echo "================================================"
echo "  SSL setup complete!"
echo "  Your site is now available at:"
echo "    https://$DOMAIN"
echo ""
echo "  To auto-renew, add to crontab:"
echo "    0 */12 * * * $(pwd)/renew-ssl.sh"
echo ""
echo "  Make sure your .env has:"
echo "    APP_DOMAIN=$DOMAIN"
echo "    CERTBOT_EMAIL=$EMAIL"
echo "    FRONTEND_URL=https://$DOMAIN"
echo "    BACKEND_URL=https://$DOMAIN"
echo "    COOKIE_SECURE=true"
echo "================================================"

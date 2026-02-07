#!/bin/bash
# ─────────────────────────────────────────────────
# SSL Certificate Renewal Script
# Add to crontab: 0 */12 * * * /path/to/renew-ssl.sh
# ─────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo "[$(date)] Checking SSL certificate renewal..."
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot renew --quiet
docker compose -f docker-compose.prod.yml exec nginx-proxy nginx -s reload
echo "[$(date)] SSL renewal check complete."

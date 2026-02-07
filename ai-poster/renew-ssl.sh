#!/bin/bash
# ─────────────────────────────────────────────────
# SSL Certificate Renewal Script
# Add to crontab: 0 */12 * * * /path/to/renew-ssl.sh
# ─────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo "[$(date)] Checking SSL certificate renewal..."
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot renew --quiet

# Restart nginx-proxy to copy renewed certs via entrypoint
docker compose -f docker-compose.prod.yml restart nginx-proxy
echo "[$(date)] SSL renewal check complete."

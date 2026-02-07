#!/bin/sh
set -e

DOMAIN="${APP_DOMAIN:-localhost}"
SSL_DIR="/etc/nginx/ssl"
LE_LIVE="/etc/letsencrypt/live"

echo "=== AI Poster Nginx Proxy ==="
echo "Domain: $DOMAIN"

# Step 1: Process config template — substitute APP_DOMAIN
envsubst '$APP_DOMAIN' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
echo "Config template processed for $DOMAIN"

# Step 2: Find and copy SSL certificates
# Certbot sometimes creates directories like domain.com-0001, domain.com-0002, etc.
# We need to find the most recent valid cert for our domain.
mkdir -p "$SSL_DIR"

CERT_FOUND=0

# Search for cert directories matching our domain (e.g., climcrm.com, climcrm.com-0001, etc.)
# Try them in reverse order so the latest numbered version wins
if [ -d "$LE_LIVE" ]; then
    for cert_dir in $(ls -1d "$LE_LIVE/$DOMAIN"* 2>/dev/null | sort -r); do
        if [ -f "$cert_dir/fullchain.pem" ] && [ -f "$cert_dir/privkey.pem" ]; then
            echo "Found certificate at: $cert_dir"
            cp -L "$cert_dir/fullchain.pem" "$SSL_DIR/fullchain.pem"
            cp -L "$cert_dir/privkey.pem" "$SSL_DIR/privkey.pem"
            echo "SSL certificates copied (symlinks resolved)"

            # Show cert info
            EXPIRY=$(openssl x509 -enddate -noout -in "$SSL_DIR/fullchain.pem" 2>/dev/null | cut -d= -f2)
            ISSUER=$(openssl x509 -issuer -noout -in "$SSL_DIR/fullchain.pem" 2>/dev/null | sed 's/issuer=//')
            echo "  Issuer: $ISSUER"
            echo "  Expires: $EXPIRY"

            CERT_FOUND=1
            break
        fi
    done
fi

if [ "$CERT_FOUND" = "0" ]; then
    echo "WARNING: No Let's Encrypt certificate found for $DOMAIN"
    echo "Generating self-signed certificate..."
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN" 2>/dev/null
    echo "Self-signed certificate created (run init-ssl.sh to get a real cert)"
fi

# Step 3: Validate config
echo "Validating nginx configuration..."
nginx -t 2>&1
echo "Configuration valid"

# Step 4: Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'

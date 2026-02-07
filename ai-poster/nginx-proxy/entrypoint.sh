#!/bin/sh
set -e

DOMAIN="${APP_DOMAIN:-localhost}"
SSL_DIR="/etc/nginx/ssl"
LE_DIR="/etc/letsencrypt/live/$DOMAIN"

echo "=== AI Poster Nginx Proxy ==="
echo "Domain: $DOMAIN"

# Step 1: Process config template — substitute APP_DOMAIN
envsubst '$APP_DOMAIN' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
echo "Config template processed for $DOMAIN"

# Step 2: Copy SSL certificates to a working directory
# This avoids Let's Encrypt symlink/permission issues
mkdir -p "$SSL_DIR"

if [ -f "$LE_DIR/fullchain.pem" ]; then
    echo "Found Let's Encrypt certificate for $DOMAIN"
    cp -L "$LE_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
    cp -L "$LE_DIR/privkey.pem" "$SSL_DIR/privkey.pem"
    echo "SSL certificates copied (symlinks resolved)"
else
    echo "WARNING: No Let's Encrypt certificate found at $LE_DIR"
    echo "Generating self-signed certificate for $DOMAIN..."
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

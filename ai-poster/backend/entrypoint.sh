#!/bin/sh
set -e

echo "Waiting for database to be ready..."
# Wait for PostgreSQL to accept connections
for i in $(seq 1 30); do
  if node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$connect().then(() => { p.\$disconnect(); process.exit(0); }).catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "Database is ready!"
    break
  fi
  echo "Waiting for database... attempt $i/30"
  sleep 2
done

echo "Running prisma db push..."
./node_modules/.bin/prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss

echo "Starting backend..."
exec node backend/dist/backend/src/main

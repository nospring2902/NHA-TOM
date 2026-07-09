#!/bin/sh
set -e

echo "[nhatom-api] Running database migrations..."
npx prisma migrate deploy

echo "[nhatom-api] Starting application..."
exec "$@"

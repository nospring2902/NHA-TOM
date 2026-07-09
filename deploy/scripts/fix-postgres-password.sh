#!/usr/bin/env bash
# Đặt lại mật khẩu user postgres trong container để khớp backend/.env
# Chạy trên VPS: bash deploy/scripts/fix-postgres-password.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

CONTAINER="${NHATOM_POSTGRES_CONTAINER:-nhatom-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-nhatom}"
NEW_PASSWORD="${1:-postgres}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER chưa chạy."
  echo "Khởi động: docker compose up -d postgres"
  exit 1
fi

echo "==> Đặt mật khẩu '$DB_USER' = '$NEW_PASSWORD' trong container $CONTAINER..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "ALTER USER \"$DB_USER\" WITH PASSWORD '$NEW_PASSWORD';"

echo "==> Kiểm tra kết nối qua TCP (giống backend PM2)..."
docker exec -e PGPASSWORD="$NEW_PASSWORD" "$CONTAINER" \
  psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 AS ok;"

echo ""
echo "Cập nhật backend/.env nếu cần:"
echo "  DATABASE_URL=postgresql://${DB_USER}:${NEW_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
echo ""
echo "Sau đó:"
echo "  cd backend && npx prisma migrate deploy"
echo "  pm2 restart nhatom-api"
echo "  curl http://127.0.0.1:3000/database/health"

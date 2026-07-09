#!/usr/bin/env bash
# Đặt lại mật khẩu user PostgreSQL trong container để khớp backend/.env
# Chạy trên VPS: bash deploy/scripts/fix-postgres-password.sh [mật-khẩu-mới]
#
# Lưu ý: container có thể dùng POSTGRES_USER khác "postgres" (superuser thật).
# Script tự đọc user/password từ env container hoặc file .env ở thư mục gốc repo.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

CONTAINER="${NHATOM_POSTGRES_CONTAINER:-nhatom-postgres}"
NEW_PASSWORD="${1:-}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

read_container_env() {
  local key="$1"
  docker exec "$CONTAINER" sh -c "printenv $key" 2>/dev/null || true
}

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER chưa chạy."
  echo "Khởi động: docker compose up -d postgres"
  exit 1
fi

DB_USER="${POSTGRES_USER:-$(read_container_env POSTGRES_USER)}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-$(read_container_env POSTGRES_DB)}"
DB_NAME="${DB_NAME:-nhatom}"
CURRENT_PASSWORD="${POSTGRES_PASSWORD:-$(read_container_env POSTGRES_PASSWORD)}"
CURRENT_PASSWORD="${CURRENT_PASSWORD:-postgres}"
NEW_PASSWORD="${NEW_PASSWORD:-$CURRENT_PASSWORD}"

echo "==> Container: $CONTAINER"
echo "==> DB user (superuser): $DB_USER"
echo "==> DB name: $DB_NAME"
echo "==> Đặt mật khẩu '$DB_USER' = '$NEW_PASSWORD'..."

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "ALTER USER \"$DB_USER\" WITH PASSWORD '$NEW_PASSWORD';"

echo "==> Kiểm tra kết nối qua TCP (giống backend PM2)..."
docker exec -e PGPASSWORD="$NEW_PASSWORD" "$CONTAINER" \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 AS ok;"

ENCODED_PASSWORD="$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$NEW_PASSWORD''', safe=''))" 2>/dev/null || node -e "console.log(encodeURIComponent(process.argv[1]))" "$NEW_PASSWORD")"

echo ""
echo "Cập nhật backend/.env:"
echo "  DATABASE_URL=postgresql://${DB_USER}:${ENCODED_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
echo ""
echo "Sau đó:"
echo "  cd backend && npx prisma migrate deploy"
echo "  pm2 restart nhatom-api"
echo "  curl http://127.0.0.1:3000/database/health"

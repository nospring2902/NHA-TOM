#!/usr/bin/env bash
# Chẩn đoán kết nối PostgreSQL ↔ backend PM2 trên VPS
# Chạy: bash deploy/scripts/diagnose-db.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

CONTAINER="${NHATOM_POSTGRES_CONTAINER:-nhatom-postgres}"

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

DB_USER="${POSTGRES_USER:-$(read_container_env POSTGRES_USER)}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-$(read_container_env POSTGRES_DB)}"
DB_NAME="${DB_NAME:-nhatom}"
DB_PASSWORD="${POSTGRES_PASSWORD:-$(read_container_env POSTGRES_PASSWORD)}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

echo "=== NHATOM database diagnose ==="
echo ""

echo "[1] Container"
if docker ps --format '{{.Names}}\t{{.Status}}' | grep -q "^${CONTAINER}"; then
  docker ps --format '  {{.Names}} — {{.Status}}' | grep "^  ${CONTAINER}"
else
  echo "  MISSING: $CONTAINER không chạy"
  echo "  Fix: docker compose up -d postgres"
  exit 1
fi

echo ""
echo "[2] Postgres env (container)"
echo "  POSTGRES_USER=$DB_USER"
echo "  POSTGRES_DB=$DB_NAME"
echo "  POSTGRES_PASSWORD=${DB_PASSWORD:0:3}***"

echo ""
echo "[3] backend/.env DATABASE_URL"
if [[ -f backend/.env ]]; then
  grep '^DATABASE_URL=' backend/.env || echo "  (không có DATABASE_URL)"
else
  echo "  MISSING: backend/.env"
fi

echo ""
echo "[4] TCP login test (giống PM2)"
if docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 AS ok;" >/dev/null 2>&1; then
  echo "  OK — Postgres chấp nhận user=$DB_USER qua TCP"
else
  echo "  FAIL — không đăng nhập được với user=$DB_USER"
  echo "  Thử: bash deploy/scripts/fix-postgres-password.sh"
fi

echo ""
echo "[5] Backend health"
HEALTH="$(curl -fsS http://127.0.0.1:3000/database/health 2>/dev/null || true)"
if echo "$HEALTH" | grep -q '"status":"up"'; then
  echo "  OK — $HEALTH"
else
  echo "  FAIL — ${HEALTH:-<backend không phản hồi>}"
  echo "  Nếu Postgres OK nhưng health fail: DATABASE_URL trong backend/.env sai user/mật khẩu"
  echo "  Sau khi sửa: pm2 restart nhatom-api"
fi

echo ""
echo "[6] PM2 log (5 dòng cuối)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 logs nhatom-api --lines 5 --nostream 2>/dev/null || true
else
  echo "  pm2 chưa cài"
fi

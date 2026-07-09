#!/usr/bin/env bash
# Kiểm tra / khởi động PostgreSQL cho deploy PM2 trên VPS.

set -euo pipefail

ensure_postgres_running() {
  local user="${POSTGRES_USER:-postgres}"
  local db="${POSTGRES_DB:-nhatom}"

  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker chưa cài — không thể tự khởi động PostgreSQL."
    return 1
  fi

  if ! docker ps --format '{{.Names}}' | grep -qx nhatom-postgres; then
    echo "==> PostgreSQL chưa chạy — đang khởi động container nhatom-postgres..."
    docker compose up -d postgres
  fi

  echo "==> Đợi PostgreSQL sẵn sàng..."
  for _ in $(seq 1 30); do
    if docker exec nhatom-postgres pg_isready -U "$user" -d "$db" >/dev/null 2>&1; then
      echo "PostgreSQL OK"
      return 0
    fi
    sleep 2
  done

  echo "PostgreSQL không phản hồi sau 60 giây."
  echo "Xem log: docker logs --tail 50 nhatom-postgres"
  return 1
}

verify_backend_database() {
  local app="${NHATOM_PM2_APP:-nhatom-api}"
  local health

  sleep 2
  health="$(curl -fsS http://127.0.0.1:3000/database/health 2>/dev/null || true)"

  if echo "$health" | grep -q '"status":"up"'; then
    echo "Backend ↔ PostgreSQL OK"
    return 0
  fi

  echo ""
  echo "Backend không kết nối được PostgreSQL."
  echo "Response: ${health:-<không phản hồi>}"
  echo ""
  echo "Thường gặp: DATABASE_URL trong backend/.env sai mật khẩu."
  echo "VPS cài ban đầu thường dùng:"
  echo "  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nhatom?schema=public"
  echo ""
  echo "Sau khi sửa backend/.env: pm2 restart ${app}"
  echo "Log: pm2 logs ${app} --lines 50"
  return 1
}

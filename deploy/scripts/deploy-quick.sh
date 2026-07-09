#!/usr/bin/env bash
# Deploy nhanh từng phần sau khi git pull trên VPS.
#
# Cách dùng (từ thư mục gốc repo):
#   bash deploy/scripts/deploy-quick.sh backend
#   bash deploy/scripts/deploy-quick.sh frontend
#   bash deploy/scripts/deploy-quick.sh nginx
#   bash deploy/scripts/deploy-quick.sh all
#
# Alias: be/api → backend, fe/web → frontend

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

WEB_ROOT="${NHATOM_WEB_ROOT:-/var/www/nhatom}"
PM2_APP="${NHATOM_PM2_APP:-nhatom-api}"

usage() {
  cat <<'EOF'
Deploy nhanh NHATOM (sau git pull trên VPS)

Usage:
  bash deploy/scripts/deploy-quick.sh <target>

Targets:
  backend | be | api   Chỉ build + restart API (Prisma migrate + PM2)
  frontend | fe | web  Chỉ build + copy static ra /var/www/nhatom
  nginx                Copy config nginx + reload (cần sudo)
  all                  Deploy đầy đủ (gọi deploy-pm2.sh)

Ví dụ workflow:
  cd /opt/nhatom/NHA-TOM
  git pull
  bash deploy/scripts/deploy-quick.sh backend
EOF
}

ensure_backend_env() {
  if [[ ! -f backend/.env ]]; then
    if [[ -f .env ]]; then
      cp .env backend/.env
      echo "Đã copy .env → backend/.env"
    else
      echo "Thiếu backend/.env — tạo từ deploy/env.example"
      exit 1
    fi
  fi
}

deploy_backend() {
  echo "==> Deploy backend..."
  ensure_backend_env

  cd "$ROOT_DIR/backend"
  npm ci
  npm run prisma:generate
  npx prisma migrate deploy
  npm run build
  mkdir -p uploads/avatars uploads/posts

  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP"
  else
    pm2 start dist/main.js --name "$PM2_APP"
  fi
  pm2 save

  sleep 2
  curl -fsS http://127.0.0.1:3000/database/health >/dev/null || {
    echo "Backend chưa phản hồi — xem: pm2 logs $PM2_APP"
    exit 1
  }

  echo "Backend OK — pm2 status $PM2_APP"
}

deploy_frontend() {
  echo "==> Deploy frontend..."

  if [[ ! -f frontend/.env.production ]]; then
    echo "Cảnh báo: chưa có frontend/.env.production"
    if [[ -f frontend/.env.example ]]; then
      cp frontend/.env.example frontend/.env.production
      echo "Đã tạo từ .env.example — kiểm tra VITE_API_BASE_URL trước khi build production."
    fi
  fi

  cd "$ROOT_DIR/frontend"
  npm ci
  npm run build

  sudo mkdir -p "$WEB_ROOT"
  sudo cp -r dist/* "$WEB_ROOT/"

  echo "Frontend OK — static tại $WEB_ROOT"
}

deploy_nginx() {
  echo "==> Cập nhật Nginx..."

  for site in nhatom-web nhatom-api nhatom-iot; do
    if [[ -f "deploy/nginx/${site}.conf" ]]; then
      sudo cp "deploy/nginx/${site}.conf" "/etc/nginx/sites-available/${site}"
      sudo ln -sf "/etc/nginx/sites-available/${site}" "/etc/nginx/sites-enabled/${site}"
    fi
  done

  sudo nginx -t
  sudo systemctl reload nginx

  echo "Nginx OK — đã reload"
}

deploy_all() {
  bash "$ROOT_DIR/deploy/scripts/deploy-pm2.sh"
}

TARGET="${1:-}"

case "$TARGET" in
  backend | be | api)
    deploy_backend
    ;;
  frontend | fe | web)
    deploy_frontend
    ;;
  nginx)
    deploy_nginx
    ;;
  all | full | "")
    if [[ -z "$TARGET" ]]; then
      usage
      exit 1
    fi
    deploy_all
    ;;
  -h | --help | help)
    usage
    ;;
  *)
    echo "Target không hợp lệ: $TARGET"
    echo ""
    usage
    exit 1
    ;;
esac

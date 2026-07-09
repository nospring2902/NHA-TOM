#!/usr/bin/env bash
# Deploy NHATOM bằng PM2 + Docker Postgres (khuyến nghị VPS)
# Chạy từ thư mục gốc repo: bash deploy/scripts/deploy-pm2.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Chưa có .env ở thư mục gốc — tạo từ deploy/env.example..."
  cp deploy/env.example .env
  echo "Vui lòng sửa .env rồi chạy lại script."
  exit 1
fi

if [[ ! -f backend/.env ]]; then
  cp .env backend/.env
  echo "Đã copy .env → backend/.env — kiểm tra DATABASE_URL dùng localhost:5432"
fi

echo "==> [1/6] Khởi động PostgreSQL..."
docker compose up -d postgres

echo "==> Đợi PostgreSQL sẵn sàng..."
for i in $(seq 1 30); do
  if docker exec nhatom-postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-nhatom}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if [[ ! -f backend/.env ]]; then
  echo "Thiếu backend/.env — copy từ backend/.env.example hoặc deploy/env.example"
  exit 1
fi

echo "==> [2/6] Backend: cài dependency..."
cd backend
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run build
mkdir -p uploads/avatars uploads/posts

echo "==> [3/6] Backend: khởi động PM2..."
if pm2 describe nhatom-api >/dev/null 2>&1; then
  pm2 restart nhatom-api
else
  pm2 start dist/main.js --name nhatom-api
fi
pm2 save

cd "$ROOT_DIR"

echo "==> [4/6] Frontend: build..."
if [[ ! -f frontend/.env.production ]]; then
  echo "Cảnh báo: chưa có frontend/.env.production — dùng frontend/.env.example"
  cp frontend/.env.example frontend/.env.production
fi

cd frontend
npm ci
npm run build

echo "==> [5/6] Copy frontend ra /var/www/nhatom..."
sudo mkdir -p /var/www/nhatom
sudo cp -r dist/* /var/www/nhatom/

cd "$ROOT_DIR"

echo "==> [6/6] Kiểm tra health..."
sleep 2
curl -fsS http://127.0.0.1:3000/database/health || {
  echo "Backend chưa phản hồi — kiểm tra: pm2 logs nhatom-api"
  exit 1
}

echo ""
echo "Deploy PM2 hoàn tất."
echo "- API: http://127.0.0.1:3000"
echo "- Frontend static: /var/www/nhatom"
echo "Tiếp theo: cấu hình Nginx (deploy/nginx/) và certbot SSL"

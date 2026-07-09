#!/usr/bin/env bash
# Deploy full stack bằng Docker Compose
# Chạy từ thư mục gốc repo: bash deploy/scripts/deploy-docker.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Thiếu .env ở thư mục gốc — chạy: cp deploy/env.example .env"
  exit 1
fi

echo "==> Build & khởi động containers..."
docker compose up -d --build

echo "==> Kiểm tra health..."
sleep 5
curl -fsS http://127.0.0.1:${API_PORT:-3000}/database/health

echo ""
echo "Deploy Docker hoàn tất."
echo "- API:   http://127.0.0.1:${API_PORT:-3000}"
echo "- Web:   http://127.0.0.1:${WEB_PORT:-8080}"
echo "Production: trỏ Nginx reverse proxy tới các port trên hoặc dùng deploy/nginx/"

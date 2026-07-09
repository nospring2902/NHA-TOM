#!/usr/bin/env bash
# Cài ThingsBoard CE trên cùng VPS (cho thiết bị thật)
# Chạy: sudo bash deploy/thingsboard/install-thingsboard.sh

set -euo pipefail

TB_DIR="${TB_DIR:-/opt/thingsboard}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Chạy bằng sudo"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker chưa cài — chạy deploy/scripts/setup-server.sh trước"
  exit 1
fi

mkdir -p "$TB_DIR"

if [[ ! -d "$TB_DIR/thingsboard" ]]; then
  git clone https://github.com/thingsboard/thingsboard.git "$TB_DIR/thingsboard"
fi

cd "$TB_DIR/thingsboard/docker"
docker compose up -d

echo ""
echo "ThingsBoard đang khởi động (đợi 2-5 phút)..."
echo "Truy cập: http://<IP-VPS>:8080"
echo "Login mặc định CE: tenant@thingsboard.org / tenant"
echo ""
echo "Sau khi đăng nhập:"
echo "  1. Đổi mật khẩu ngay"
echo "  2. Cập nhật THINGSBOARD_PASSWORD trong backend/.env"
echo "  3. Cấu hình Rule Chain webhook → deploy/thingsboard/rule-chain-ingest.example.json"
echo "  4. Nginx reverse proxy: deploy/nginx/nhatom-iot.conf"

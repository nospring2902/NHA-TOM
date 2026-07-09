#!/usr/bin/env bash
# Cài đặt ban đầu trên VPS Ubuntu 22.04
# Chạy: sudo bash deploy/scripts/setup-server.sh

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Chạy script bằng sudo: sudo bash deploy/scripts/setup-server.sh"
  exit 1
fi

echo "==> Cập nhật hệ thống..."
apt update && apt upgrade -y

echo "==> Cài gói cơ bản..."
apt install -y curl git nginx certbot python3-certbot-nginx ufw

echo "==> Cài Node.js 20..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

echo "==> Cài Docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

echo "==> Cài PM2..."
npm install -g pm2

echo "==> Cấu hình firewall..."
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw allow 1883
ufw allow 8883
ufw --force enable

echo "==> Tạo thư mục web..."
mkdir -p /var/www/nhatom
mkdir -p /opt/nhatom

echo ""
echo "Hoàn tất setup server."
echo "Bước tiếp theo:"
echo "  1. git clone <repo> /opt/nhatom/NHATOM"
echo "  2. cp deploy/env.example /opt/nhatom/NHATOM/.env && nano .env"
echo "  3. bash deploy/scripts/deploy-pm2.sh"

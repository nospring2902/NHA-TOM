# NHATOM — Nhà Tôm

Nền tảng giám sát ao tôm thông minh (IoT + AI + cộng đồng).

## Deploy production

Xem hướng dẫn đầy đủ: **[deploy/README.md](deploy/README.md)**

Tóm tắt trên VPS:

```bash
git clone <repo> /opt/nhatom/NHATOM && cd /opt/nhatom/NHATOM
cp deploy/env.example .env && cp deploy/env.example backend/.env
# Sửa .env theo domain và secret thật
docker compose up -d postgres
bash deploy/scripts/deploy-pm2.sh
```

## Chạy local (dev)

```bash
# Backend
cd backend && npm install && npm run db:up
cp .env.example .env
npm run prisma:generate && npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend && npm install && npm run dev
```

Chi tiết backend: [backend/README.md](backend/README.md)

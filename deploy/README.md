# Deploy NHATOM (VPS + thiết bị thật)

Hướng dẫn deploy dự án **Nhà Tôm** lên VPS Linux (Ubuntu 22.04). Không cần Google Cloud.

## Cấu trúc file deploy trong repo

```
NHATOM/
├── docker-compose.yml          # Postgres + API + Frontend (Docker full stack)
├── deploy/
│   ├── env.example             # Mẫu biến môi trường (copy thành .env)
│   ├── nginx/                  # Cấu hình Nginx (domain + SSL)
│   ├── scripts/
│   │   ├── setup-server.sh     # Cài Node, Docker, Nginx, PM2 lần đầu
│   │   ├── deploy-pm2.sh       # Deploy khuyến nghị (PM2 + Docker Postgres)
│   │   ├── deploy-docker.sh    # Deploy full Docker
│   │   └── backup-db.sh        # Backup PostgreSQL
│   └── thingsboard/            # Cài ThingsBoard cho thiết bị IoT
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   └── docker-compose.db.yml   # Chỉ Postgres (npm run db:up)
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── .env.example
```

---

## Yêu cầu

| Hạng mục | Khuyến nghị |
|---|---|
| VPS | 4 GB RAM, 2 vCPU, Ubuntu 22.04 |
| Domain | `nhatom.vn`, `api.nhatom.vn`, `iot.nhatom.vn` |
| SMTP | Gmail App Password hoặc SendGrid |

---

## Cách 1 — Deploy khuyến nghị (PM2 + Docker Postgres)

Phù hợp production: backend ổn định, upload file local, WebSocket + cron chạy liên tục.

### Bước 1: Push code lên GitHub (máy local)

```powershell
cd C:\Users\admin\Documents\ShrimpHome\NHATOM
git add .
git commit -m "Add deploy configs"
git push origin main
```

### Bước 2: Setup VPS lần đầu

```bash
ssh root@<IP-VPS>
sudo bash deploy/scripts/setup-server.sh
```

### Bước 3: Clone repo

```bash
cd /opt/nhatom
git clone https://github.com/<user>/NHATOM.git NHATOM
cd NHATOM
```

### Bước 4: Tạo file env

```bash
cp deploy/env.example .env
cp deploy/env.example backend/.env
nano .env
nano backend/.env
```

Sửa ít nhất:
- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET`, `DEVICE_TOKEN_ENCRYPTION_KEY`, `VERIFICATION_CODE_SECRET`
- `THINGSBOARD_INGEST_TOKEN`
- `SMTP_*`, `EMAIL_FROM`
- `VITE_API_BASE_URL=https://api.<domain-cua-ban>/api/v1`
- `CORS_ORIGINS`, `FRONTEND_ORIGIN`

Tạo file build frontend:

```bash
cp frontend/.env.example frontend/.env.production
nano frontend/.env.production
# VITE_API_BASE_URL=https://api.<domain>/api/v1
```

### Bước 5: Chạy PostgreSQL

```bash
docker compose up -d postgres
docker ps   # phải thấy nhatom-postgres
```

### Bước 6: Deploy app

```bash
bash deploy/scripts/deploy-pm2.sh
```

### Bước 7: Nginx + SSL

```bash
sudo cp deploy/nginx/nhatom-web.conf /etc/nginx/sites-available/nhatom
sudo cp deploy/nginx/nhatom-api.conf /etc/nginx/sites-available/nhatom-api
# Sửa server_name trong file cho đúng domain

sudo ln -s /etc/nginx/sites-available/nhatom /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/nhatom-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d nhatom.vn -d www.nhatom.vn -d api.nhatom.vn
```

### Bước 8: ThingsBoard (thiết bị thật)

```bash
sudo bash deploy/thingsboard/install-thingsboard.sh
```

Sau khi TB chạy:
1. Vào `http://<IP>:8080` → login `tenant@thingsboard.org` / `tenant` → **đổi MK**
2. Cập nhật `THINGSBOARD_PASSWORD` trong `backend/.env` → `pm2 restart nhatom-api`
3. Cấu hình Rule Chain theo `deploy/thingsboard/rule-chain-ingest.example.json`
4. Proxy TB qua Nginx:

```bash
sudo cp deploy/nginx/nhatom-iot.conf /etc/nginx/sites-available/nhatom-iot
sudo ln -s /etc/nginx/sites-available/nhatom-iot /etc/nginx/sites-enabled/
sudo certbot --nginx -d iot.nhatom.vn
```

---

## Cách 2 — Full Docker Compose

```bash
cp deploy/env.example .env
nano .env
bash deploy/scripts/deploy-docker.sh
```

- API: port `3000`
- Web: port `8080`
- Production vẫn nên đặt Nginx + SSL phía trước.

---

## Chỉ chạy PostgreSQL (dev local)

```bash
# Từ thư mục gốc
docker compose up -d postgres

# Hoặc từ backend
cd backend && npm run db:up
```

---

## Kiểm tra sau deploy

```bash
curl http://127.0.0.1:3000/database/health
pm2 logs nhatom-api
docker ps
```

Trên trình duyệt: đăng ký → xác minh email → đăng nhập → provision thiết bị → bind ao → xem telemetry.

**Admin mặc định** (tự tạo khi backend khởi động):
- Email: `nhatom@gmail.com`
- Password: `123456789`
- **Đổi mật khẩu ngay sau deploy production.**

---

## Cập nhật phiên bản mới

```bash
cd /opt/nhatom/NHA-TOM   # hoặc đường dẫn repo trên VPS
git pull
```

### Deploy nhanh (khuyến nghị hàng ngày)

| Lệnh | Khi nào dùng |
|---|---|
| `bash deploy/scripts/deploy-quick.sh backend` | Sửa API, service, Prisma, WebSocket |
| `bash deploy/scripts/deploy-quick.sh frontend` | Sửa giao diện React |
| `bash deploy/scripts/deploy-quick.sh nginx` | Sửa file `deploy/nginx/*.conf` |
| `bash deploy/scripts/deploy-quick.sh all` | Deploy đầy đủ (lần đầu / đổi nhiều phần) |

Alias ngắn: `be`/`api` = backend, `fe`/`web` = frontend.

### Deploy đầy đủ

```bash
bash deploy/scripts/deploy-pm2.sh
```

---

## Backup database

```bash
bash deploy/scripts/backup-db.sh
```

---

## Lỗi "Internal Server Error" / Database down

Kiểm tra nhanh trên VPS:

```bash
curl http://127.0.0.1:3000/database/health
docker ps | grep nhatom-postgres
grep DATABASE_URL backend/.env
```

| Triệu chứng | Cách sửa |
|---|---|
| `"status":"down"` | Postgres chưa chạy hoặc `DATABASE_URL` sai mật khẩu |
| Container không có | `docker compose up -d postgres` |
| Mật khẩu sai | Sửa `backend/.env` → `postgresql://postgres:postgres@localhost:5432/nhatom?schema=public` rồi `pm2 restart nhatom-api` |
| `P1000 Authentication failed` nhưng container đang chạy | DB volume tạo với mật khẩu cũ — chạy `bash deploy/scripts/fix-postgres-password.sh` |
| `role "postgres" is not permitted to log in` | Container dùng `POSTGRES_USER` khác `postgres` — dùng script mới (tự detect user) hoặc xem mục dưới |

```bash
# Chẩn đoán nhanh
bash deploy/scripts/diagnose-db.sh

# Xem user thật trong container (KHÔNG phải lúc nào cũng là "postgres")
docker exec nhatom-postgres sh -c 'echo USER=$POSTGRES_USER DB=$POSTGRES_DB'
grep DATABASE_URL backend/.env

# Đồng bộ mật khẩu user thật trong container (script tự đọc POSTGRES_USER)
bash deploy/scripts/fix-postgres-password.sh

cd backend
npx prisma migrate deploy
pm2 restart nhatom-api
curl http://127.0.0.1:3000/database/health
```

Deploy frontend **không** ảnh hưởng database. Nếu lỗi sau deploy backend, thường do Postgres container dừng hoặc `.env` không khớp.

---

## DNS cần trỏ về IP VPS

| Record | Type | Value |
|---|---|---|
| `@` | A | `<IP-VPS>` |
| `api` | A | `<IP-VPS>` |
| `iot` | A | `<IP-VPS>` |

---

## Lưu ý bảo mật

- Không commit file `.env` (đã có trong `.gitignore`)
- Đổi toàn bộ secret mặc định trước khi lên production
- Mở port MQTT `1883`/`8883` chỉ khi cần thiết bị kết nối từ internet

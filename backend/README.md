# NHATOM Backend Playbook

Tai lieu nay la huong dan chuan de chay, test, kiem tra database va hoan thien backend cho du an kiem soat va du doan chat luong nuoc.

## 1) Stack va pham vi

- Framework: NestJS
- ORM: Prisma
- Database: PostgreSQL
- Auth: JWT access token + refresh session
- Muc tieu MVP backend:
  - Auth (register/login/me/refresh)
  - Ponds + bind device
  - Metrics latest/history
  - Alerts + dashboard summary
  - Activity logs
  - Ingest telemetry tu ThingsBoard

## 2) Bien moi truong bat buoc

Tao file `.env` voi toi thieu:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nhatom?schema=public"
JWT_ACCESS_SECRET=replace_with_strong_secret
JWT_ACCESS_EXPIRES_IN=15m
THINGSBOARD_BASE_URL=http://localhost:8080
THINGSBOARD_USERNAME=tenant@thingsboard.org
THINGSBOARD_PASSWORD=tenant
DEVICE_TOKEN_ENCRYPTION_KEY=replace_with_long_random_secret
ADMIN_BOOTSTRAP_KEY=replace_with_admin_bootstrap_key
```

Khuyen nghi:
- JWT_ACCESS_SECRET dai >= 32 ky tu.
- Moi moi truong (local/staging/prod) dung secret rieng.
- Device token ThingsBoard duoc ma hoa bang `DEVICE_TOKEN_ENCRYPTION_KEY` truoc khi luu DB.

## 3) Trinh tu chay local (end-to-end)

### Buoc 1: Cai dependencies

```bash
npm install
```

### Buoc 2: Khoi dong PostgreSQL

```bash
npm run db:up
```

Neu gap loi Docker pipe tren Windows, mo Docker Desktop va dam bao Engine da Running.

### Buoc 3: Tao Prisma Client

```bash
npm run prisma:generate
```

### Buoc 4: Chay migration

```bash
npm run prisma:migrate -- --name init
```

### Buoc 5: Chay backend

```bash
npm run start:dev
```

### Buoc 6: Kiem tra health

Goi API:

```http
GET /database/health
```

Ky vong: tra ve trang thai ket noi DB thanh cong.

## 4) Trinh tu test du an

### 4.1 Build check (bat buoc truoc khi push)

```bash
npm run build
```

### 4.2 Unit test

```bash
npm run test
```

### 4.3 E2E test

```bash
npm run test:e2e
```

### 4.4 Coverage

```bash
npm run test:cov
```

Khuyen nghi pipeline local truoc khi commit:
1. `npm run build`
2. `npm run test`
3. `npm run test:e2e`

## 5) Kiem tra database dung cach

### Cach A: Prisma Studio

```bash
npm run prisma:studio
```

Dung de xem nhanh data trong bang `users`, `ponds`, `devices`, `pond_metric_snapshots`, `alerts`.

### Cach B: PSQL trong container

```bash
docker exec -it nhatom-postgres psql -U postgres -d nhatom
```

SQL kiem tra nhanh:

```sql
\dt
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM ponds;
SELECT COUNT(*) FROM devices;
SELECT COUNT(*) FROM pond_metric_snapshots;
SELECT COUNT(*) FROM alerts;
```

### Cach C: Prisma migrate status

```bash
npx prisma migrate status
```

Ky vong: migration da duoc apply day du.

## 6) Checklist nghiep vu can xong de "dong backend"

### Phase 1 - Nen tang on dinh

- [ ] Tat ca module su dung PrismaService, khong con mock data trong service chinh.
- [ ] Auth middleware/guard doc user tu bearer token.
- [ ] Validation DTO day du cho input quan trong.
- [ ] Error format thong nhat.

Definition of Done:
- Build pass, unit pass, API auth + health chay on dinh.

### Phase 2 - Core domain

- [ ] Hoan thien CRUD Pond theo owner/user context.
- [ ] Bind device bang transaction:
  - Check inventory AVAILABLE
  - Tao Device
  - Tao PondDevice
  - Cap nhat inventory ACTIVATED
- [ ] Metrics latest/history doc DB that.
- [ ] Dashboard summary khong hardcode.

Definition of Done:
- Frontend dashboard nhan du lieu that cho pond, device, metrics.

### Phase 3 - Telemetry va canh bao

- [ ] Tao endpoint ingest telemetry tu ThingsBoard.
- [ ] Idempotency theo eventId de tranh ghi trung khi retry.
- [ ] Cap nhat `telemetry_raw`, `pond_metric_snapshots`, `pond_metric_latest`.
- [ ] Rule tao/cap nhat alerts tu metrics.

Definition of Done:
- Khi gui du lieu telemetry mau, dashboard thay doi theo thoi gian that.

### Phase 4 - Van hanh va bao mat

- [ ] Logging co trace id cho request quan trong.
- [ ] Rate limit endpoint auth/ingest.
- [ ] Backup/restore Postgres script.
- [ ] Seed data cho dev/staging.

Definition of Done:
- Co quy trinh runbook su co co ban va du an san sang staging.

## 7) Kich ban test E2E quan trong (uu tien cao)

1. Dang ky user moi.
2. Dang nhap lay access token.
3. Tao pond.
4. Bind device vao pond.
5. Gui telemetry ingest.
6. Goi dashboard va metrics history.
7. Xac nhan alert duoc tao khi nguong vuot muc.

Neu 7 buoc nay pass, backend da dat muc MVP chay duoc cho frontend.

## 8) Prompt template cho lan tiep theo

Dung template nay de prompt tiep cho agent:

```text
Muc tieu: Hoan thien backend NHATOM theo checklist README.

Rang buoc:
- Khong dung mock data trong service nghiep vu.
- Uu tien Prisma transaction cho bind device va ingest telemetry.
- Giu nguyen API contract hien tai neu co the.

Viec can lam trong buoc nay:
1) [ghi ro module]
2) [ghi ro endpoint]
3) [ghi ro test can them]

Tieu chi xong:
- npm run build pass
- npm run test pass
- Endpoint [X] tra ve du lieu that tu PostgreSQL
```

## 9) Lenh hay dung

```bash
# Database
npm run db:up
npm run db:down

# Prisma
npm run prisma:generate
npm run prisma:migrate -- --name <migration_name>
npm run prisma:studio

# App
npm run start:dev
npm run build

# Test
npm run test
npm run test:e2e
npm run test:cov
```

## 10) Luu y de tranh loi lap lai

- Neu Prisma CLI major thay doi, can dong bo version `prisma` va `@prisma/client`.
- `JWT_ACCESS_EXPIRES_IN` nen dung gia tri hop le nhu `15m`, `1h`, `7d` hoac so giay.
- Tren Windows, loi Docker pipe thuong do Docker Desktop chua chay.

---

Neu can, buoc tiep theo nen lam la viet `seed.ts` tao du lieu mau (user, pond, device, metrics) de frontend demo ngay ma khong can nhap tay.

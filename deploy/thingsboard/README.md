# ThingsBoard cho thiết bị IoT

NHATOM dùng ThingsBoard làm tầng nhận telemetry từ thiết bị thật (MQTT/HTTP), sau đó Rule Chain gọi webhook về backend.

## Cài đặt nhanh trên VPS

```bash
sudo bash deploy/thingsboard/install-thingsboard.sh
```

## Sau khi cài

1. Truy cập `http://<IP-VPS>:8080`
2. Login CE mặc định: `tenant@thingsboard.org` / `tenant`
3. **Đổi mật khẩu ngay**
4. Cập nhật `backend/.env`:
   ```env
   THINGSBOARD_BASE_URL=https://iot.nhatom.vn
   THINGSBOARD_PASSWORD=<mat-khau-moi>
   ```
5. Restart backend: `pm2 restart nhatom-api`

## Rule Chain → NHATOM

Trong ThingsBoard UI → **Rule Chains** → chain mặc định:

- Trigger: `POST_TELEMETRY`
- Node: **REST API Call**
- URL: `https://api.nhatom.vn/api/v1/telemetry/ingest`
- Header: `x-ingest-token: <THINGSBOARD_INGEST_TOKEN>`
- Body mẫu: xem `rule-chain-ingest.example.json`

## Thiết bị gửi data

HTTP:
```
POST https://iot.nhatom.vn/api/v1/{DEVICE_ACCESS_TOKEN}/telemetry
```

MQTT:
```
Host: iot.nhatom.vn
Port: 1883 (hoặc 8883 TLS)
```

Access token lấy sau khi **Admin provision** thiết bị trong app NHATOM.

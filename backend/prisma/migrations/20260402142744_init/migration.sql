-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FARM_MANAGER', 'FARM_STAFF', 'ANALYST');

-- CreateEnum
CREATE TYPE "PondWaterType" AS ENUM ('FRESH', 'BRACKISH', 'SALINE');

-- CreateEnum
CREATE TYPE "PondLifecycleStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('SENSOR_GATEWAY', 'AERATOR', 'PUMP', 'LIGHT', 'FEEDER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('WAITING_SIGNAL', 'ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('AVAILABLE', 'ACTIVATED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MetricQualityFlag" AS ENUM ('VALID', 'OUTLIER', 'MISSING', 'IMPUTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FARM_STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ponds" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "farmName" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "areaM2" DOUBLE PRECISION NOT NULL,
    "averageDepthM" DOUBLE PRECISION NOT NULL,
    "waterType" "PondWaterType" NOT NULL,
    "lifecycleStatus" "PondLifecycleStatus" NOT NULL DEFAULT 'PROVISIONING',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ponds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pond_members" (
    "id" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pond_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_inventory" (
    "serialNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
    "activatedByUserId" TEXT,
    "activatedPondId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_inventory_pkey" PRIMARY KEY ("serialNumber")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'WAITING_SIGNAL',
    "telemetryPackets" INTEGER NOT NULL DEFAULT 0,
    "thingsboardDeviceId" TEXT,
    "lastTelemetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pond_devices" (
    "id" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unboundAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pond_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_raw" (
    "id" BIGSERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tsUtc" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'thingsboard',
    "ingestStatus" TEXT NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pond_metric_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "pondId" TEXT NOT NULL,
    "deviceId" TEXT,
    "tsUtc" TIMESTAMP(3) NOT NULL,
    "ph" DOUBLE PRECISION,
    "dissolvedOxygen" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "salinity" DOUBLE PRECISION,
    "qualityFlag" "MetricQualityFlag" NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pond_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pond_metric_latest" (
    "pondId" TEXT NOT NULL,
    "ph" DOUBLE PRECISION,
    "dissolvedOxygen" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "salinity" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pond_metric_latest_pkey" PRIMARY KEY ("pondId")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "metricKey" TEXT,
    "message" TEXT NOT NULL,
    "predictedFor" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_commands" (
    "id" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "requestedByUserId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "ackAt" TIMESTAMP(3),
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "pondId" TEXT,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "trigger" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "pondId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "ponds_ownerId_idx" ON "ponds"("ownerId");

-- CreateIndex
CREATE INDEX "ponds_lifecycleStatus_createdAt_idx" ON "ponds"("lifecycleStatus", "createdAt");

-- CreateIndex
CREATE INDEX "pond_members_userId_idx" ON "pond_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "pond_members_pondId_userId_key" ON "pond_members"("pondId", "userId");

-- CreateIndex
CREATE INDEX "device_inventory_status_idx" ON "device_inventory"("status");

-- CreateIndex
CREATE INDEX "device_inventory_activatedPondId_idx" ON "device_inventory"("activatedPondId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serialNumber_key" ON "devices"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "devices_thingsboardDeviceId_key" ON "devices"("thingsboardDeviceId");

-- CreateIndex
CREATE INDEX "devices_status_updatedAt_idx" ON "devices"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "pond_devices_pondId_boundAt_idx" ON "pond_devices"("pondId", "boundAt");

-- CreateIndex
CREATE INDEX "pond_devices_deviceId_boundAt_idx" ON "pond_devices"("deviceId", "boundAt");

-- CreateIndex
CREATE UNIQUE INDEX "telemetry_raw_eventId_key" ON "telemetry_raw"("eventId");

-- CreateIndex
CREATE INDEX "telemetry_raw_pondId_tsUtc_idx" ON "telemetry_raw"("pondId", "tsUtc");

-- CreateIndex
CREATE INDEX "telemetry_raw_deviceId_tsUtc_idx" ON "telemetry_raw"("deviceId", "tsUtc");

-- CreateIndex
CREATE INDEX "pond_metric_snapshots_pondId_tsUtc_idx" ON "pond_metric_snapshots"("pondId", "tsUtc");

-- CreateIndex
CREATE INDEX "pond_metric_snapshots_deviceId_tsUtc_idx" ON "pond_metric_snapshots"("deviceId", "tsUtc");

-- CreateIndex
CREATE INDEX "alerts_pondId_status_severity_createdAt_idx" ON "alerts"("pondId", "status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "device_commands_pondId_queuedAt_idx" ON "device_commands"("pondId", "queuedAt");

-- CreateIndex
CREATE INDEX "device_commands_deviceId_queuedAt_idx" ON "device_commands"("deviceId", "queuedAt");

-- CreateIndex
CREATE INDEX "activity_logs_pondId_createdAt_idx" ON "activity_logs"("pondId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_actorUserId_createdAt_idx" ON "activity_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "posts_authorUserId_createdAt_idx" ON "posts"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "posts_pondId_createdAt_idx" ON "posts"("pondId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ponds" ADD CONSTRAINT "ponds_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pond_members" ADD CONSTRAINT "pond_members_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pond_members" ADD CONSTRAINT "pond_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_inventory" ADD CONSTRAINT "device_inventory_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_inventory" ADD CONSTRAINT "device_inventory_activatedPondId_fkey" FOREIGN KEY ("activatedPondId") REFERENCES "ponds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pond_devices" ADD CONSTRAINT "pond_devices_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pond_devices" ADD CONSTRAINT "pond_devices_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_raw" ADD CONSTRAINT "telemetry_raw_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_raw" ADD CONSTRAINT "telemetry_raw_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pond_metric_snapshots" ADD CONSTRAINT "pond_metric_snapshots_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pond_metric_snapshots" ADD CONSTRAINT "pond_metric_snapshots_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pond_metric_latest" ADD CONSTRAINT "pond_metric_latest_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

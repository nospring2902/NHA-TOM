-- Add lifecycle status for admin-provisioned devices.
ALTER TYPE "DeviceStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

-- Keep existing ThingsBoard mapping data while renaming to new schema field.
ALTER TABLE "devices" RENAME COLUMN "thingsboardDeviceId" TO "tbDeviceId";

ALTER TABLE "devices"
  ADD COLUMN "accessToken" TEXT,
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "devices"
  -- Enum value INACTIVE was just added above; Postgres requires a commit
  -- before the new value can be used in defaults.
  ALTER COLUMN "status" DROP DEFAULT;

DROP INDEX IF EXISTS "devices_thingsboardDeviceId_key";
CREATE UNIQUE INDEX "devices_tbDeviceId_key" ON "devices"("tbDeviceId");
CREATE UNIQUE INDEX "devices_accessToken_key" ON "devices"("accessToken");
CREATE INDEX "devices_ownerId_idx" ON "devices"("ownerId");

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

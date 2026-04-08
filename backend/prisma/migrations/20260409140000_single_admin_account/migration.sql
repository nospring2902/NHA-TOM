-- Enforce that there is exactly one ADMIN account (nhatom@gmail.com).
-- Any other existing ADMIN users are downgraded to FARM_STAFF.

UPDATE "users"
SET "role" = 'FARM_STAFF'::"UserRole"
WHERE "role" = 'ADMIN'::"UserRole"
  AND lower("email") <> 'nhatom@gmail.com';

-- Partial unique index: allows at most one row with role=ADMIN.
CREATE UNIQUE INDEX IF NOT EXISTS "users_single_admin_only"
ON "users" ("role")
WHERE "role" = 'ADMIN'::"UserRole";

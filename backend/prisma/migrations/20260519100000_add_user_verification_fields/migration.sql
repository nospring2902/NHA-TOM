ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "emailVerificationCodeHash" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "phoneVerificationCodeHash" TEXT;
ALTER TABLE "users" ADD COLUMN "phoneVerificationExpiresAt" TIMESTAMP(3);

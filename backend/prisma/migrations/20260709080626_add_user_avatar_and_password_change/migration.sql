-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "passwordChangeCodeHash" TEXT,
ADD COLUMN     "passwordChangeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "pendingPasswordHash" TEXT;

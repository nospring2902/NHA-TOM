/*
  Warnings:

  - You are about to drop the column `phoneVerificationCodeHash` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phoneVerificationExpiresAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phoneVerifiedAt` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "phoneVerificationCodeHash",
DROP COLUMN "phoneVerificationExpiresAt",
DROP COLUMN "phoneVerifiedAt";

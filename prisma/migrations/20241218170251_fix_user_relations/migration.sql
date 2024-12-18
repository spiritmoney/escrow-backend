/*
  Warnings:

  - You are about to drop the column `isVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `otp` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `otpExpiry` on the `users` table. All the data in the column will be lost.
  - Made the column `stripeAccountStatus` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "users_walletAddress_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "isVerified",
DROP COLUMN "otp",
DROP COLUMN "otpExpiry",
ADD COLUMN     "name" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "stripeAccountStatus" SET NOT NULL;

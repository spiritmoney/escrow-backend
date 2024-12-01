-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'DEVELOPER', 'PRODUCT_OWNER', 'SUPPORT_STAFF', 'HOBBYIST');

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(16) NOT NULL DEFAULT floor(random() * 9000000000000000 + 1000000000000000)::text,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "walletAddress" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'HOBBYIST',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "otp" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

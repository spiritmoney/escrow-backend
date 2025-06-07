/*
  Warnings:

  - The values [LOGISTICS_API,PROOF_BASED,SMS_EMAIL,MILESTONE_BASED,TWO_WAY_CONFIRMATION,SECURE_DELIVERY,BLOCKCHAIN_ESCROW,MANUAL_HASH] on the enum `VerificationMethod` will be removed. If these variants are still used in the database, this will fail.
  - The values [INITIATED,PENDING_DELIVERY,PROOF_SUBMITTED,PENDING_DOWNLOAD,AWAITING_CONFIRMATIONS,COMPLETED] on the enum `VerificationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `autoRenewSubscription` on the `auto_payment_settings` table. All the data in the column will be lost.
  - You are about to drop the column `sendPaymentNotifications` on the `auto_payment_settings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `auto_payment_settings` table. All the data in the column will be lost.
  - You are about to drop the column `billingDate` on the `billing_history` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `billing_history` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionId` on the `billing_history` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `custodial_balance_history` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `custodial_balance_history` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `custodial_balance_history` table. All the data in the column will be lost.
  - You are about to drop the column `chainId` on the `custodial_wallets` table. All the data in the column will be lost.
  - You are about to drop the column `lastUpdated` on the `custodial_wallets` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `custodial_wallets` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `custodial_wallets` table. All the data in the column will be lost.
  - You are about to drop the column `tokenDecimals` on the `custodial_wallets` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `custodial_wallets` table. All the data in the column will be lost.
  - The `balance` column on the `custodial_wallets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `updatedAt` on the `milestones` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `payment_link_settings` table. All the data in the column will be lost.
  - You are about to drop the column `stripeConnectId` on the `payment_links` table. All the data in the column will be lost.
  - You are about to drop the column `stripePaymentId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `stripeAccountId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `stripeAccountStatus` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `ApiSettings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CryptoBalanceReservation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KycVerification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentLinkMethod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SupportTicket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bridge_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stripe_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscription_usage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[address]` on the table `custodial_wallets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,currency,network]` on the table `custodial_wallets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `billing_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `changeAmount` to the `custodial_balance_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `changeType` to the `custodial_balance_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `newBalance` to the `custodial_balance_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `previousBalance` to the `custodial_balance_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reason` to the `custodial_balance_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `custodial_wallets` table without a default value. This is not possible if the table is not empty.
  - Made the column `address` on table `custodial_wallets` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `amount` to the `milestones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `milestones` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "VerificationMethod_new" AS ENUM ('SELLER_PROOF_SUBMISSION', 'BUYER_CONFIRMATION', 'THIRD_PARTY_ARBITRATION', 'BLOCKCHAIN_CONFIRMATION');
ALTER TYPE "VerificationMethod" RENAME TO "VerificationMethod_old";
ALTER TYPE "VerificationMethod_new" RENAME TO "VerificationMethod";
DROP TYPE "VerificationMethod_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VerificationStatus_new" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');
ALTER TYPE "VerificationStatus" RENAME TO "VerificationStatus_old";
ALTER TYPE "VerificationStatus_new" RENAME TO "VerificationStatus";
DROP TYPE "VerificationStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ApiSettings" DROP CONSTRAINT "ApiSettings_userId_fkey";

-- DropForeignKey
ALTER TABLE "CryptoBalanceReservation" DROP CONSTRAINT "CryptoBalanceReservation_userId_fkey";

-- DropForeignKey
ALTER TABLE "KycVerification" DROP CONSTRAINT "KycVerification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentLinkMethod" DROP CONSTRAINT "PaymentLinkMethod_paymentLinkId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicket" DROP CONSTRAINT "SupportTicket_userId_fkey";

-- DropForeignKey
ALTER TABLE "billing_history" DROP CONSTRAINT "billing_history_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "payment_links" DROP CONSTRAINT "payment_links_stripeConnectId_fkey";

-- DropForeignKey
ALTER TABLE "stripe_accounts" DROP CONSTRAINT "stripe_accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscription_usage" DROP CONSTRAINT "subscription_usage_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_customer_fkey";

-- DropIndex
DROP INDEX "custodial_wallets_userId_token_chainId_key";

-- AlterTable
ALTER TABLE "auto_payment_settings" DROP COLUMN "autoRenewSubscription",
DROP COLUMN "sendPaymentNotifications",
DROP COLUMN "updatedAt",
ADD COLUMN     "autoPaymentLimit" DOUBLE PRECISION,
ADD COLUMN     "defaultPaymentMethod" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "balances" ADD COLUMN     "espees" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "gbp" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "usdc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "usdt" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "billing_history" DROP COLUMN "billingDate",
DROP COLUMN "paymentMethod",
DROP COLUMN "subscriptionId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "custodial_balance_history" DROP COLUMN "amount",
DROP COLUMN "timestamp",
DROP COLUMN "type",
ADD COLUMN     "changeAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "changeType" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "newBalance" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "previousBalance" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "reason" TEXT NOT NULL,
ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "custodial_wallets" DROP COLUMN "chainId",
DROP COLUMN "lastUpdated",
DROP COLUMN "status",
DROP COLUMN "token",
DROP COLUMN "tokenDecimals",
DROP COLUMN "type",
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "balance",
ADD COLUMN     "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "address" SET NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" JSONB,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "milestones" DROP COLUMN "updatedAt",
ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payment_link_settings" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "payment_links" DROP COLUMN "stripeConnectId";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "stripePaymentId";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "stripeAccountId",
DROP COLUMN "stripeAccountStatus";

-- DropTable
DROP TABLE "ApiSettings";

-- DropTable
DROP TABLE "CryptoBalanceReservation";

-- DropTable
DROP TABLE "KycVerification";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "PaymentLinkMethod";

-- DropTable
DROP TABLE "SupportTicket";

-- DropTable
DROP TABLE "bridge_transactions";

-- DropTable
DROP TABLE "chat_messages";

-- DropTable
DROP TABLE "chat_sessions";

-- DropTable
DROP TABLE "stripe_accounts";

-- DropTable
DROP TABLE "subscription_usage";

-- DropTable
DROP TABLE "subscriptions";

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "accountNameOrAddress" TEXT NOT NULL,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "bankCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_link_methods" (
    "id" TEXT NOT NULL,
    "paymentLinkId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB NOT NULL,

    CONSTRAINT "payment_link_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_balance_reservations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reservedFor" TEXT NOT NULL,
    "referenceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_balance_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_settings_userId_key" ON "api_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_settings_apiKey_key" ON "api_settings"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_userId_key" ON "kyc_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "custodial_wallets_address_key" ON "custodial_wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "custodial_wallets_userId_currency_network_key" ON "custodial_wallets"("userId", "currency", "network");

-- RenameForeignKey
ALTER TABLE "transactions" RENAME CONSTRAINT "transactions_customer_ref_fkey" TO "transactions_customerId_fkey";

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_link_methods" ADD CONSTRAINT "payment_link_methods_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_settings" ADD CONSTRAINT "api_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_balance_reservations" ADD CONSTRAINT "crypto_balance_reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

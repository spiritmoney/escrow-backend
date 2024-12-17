/*
  Warnings:

  - You are about to drop the `PaymentLink` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PaymentLink" DROP CONSTRAINT "PaymentLink_userId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentLinkMethod" DROP CONSTRAINT "PaymentLinkMethod_paymentLinkId_fkey";

-- DropTable
DROP TABLE "PaymentLink";

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "defaultAmount" DOUBLE PRECISION,
    "defaultCurrency" TEXT,
    "details" JSONB,
    "verificationMethod" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoBalanceReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoBalanceReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CryptoBalanceReservation_status_idx" ON "CryptoBalanceReservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoBalanceReservation_userId_tokenAddress_chainId_key" ON "CryptoBalanceReservation"("userId", "tokenAddress", "chainId");

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLinkMethod" ADD CONSTRAINT "PaymentLinkMethod_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoBalanceReservation" ADD CONSTRAINT "CryptoBalanceReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

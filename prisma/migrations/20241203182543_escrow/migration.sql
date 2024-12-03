/*
  Warnings:

  - Added the required column `transactionType` to the `payment_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `payment_links` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payment_links" ADD COLUMN     "buyerAddress" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "escrowAddress" TEXT,
ADD COLUMN     "sellerAddress" TEXT,
ADD COLUMN     "transactionType" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "buyerConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escrowAddress" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "originalAmount" DOUBLE PRECISION,
ADD COLUMN     "originalCurrency" TEXT,
ADD COLUMN     "paymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentDetails" JSONB,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "sellerConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "resolverId" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[],
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

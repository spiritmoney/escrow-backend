-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('INITIATED', 'PENDING_DELIVERY', 'PROOF_SUBMITTED', 'PENDING_DOWNLOAD', 'AWAITING_CONFIRMATIONS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('LOGISTICS_API', 'PROOF_BASED', 'SMS_EMAIL', 'MILESTONE_BASED', 'TWO_WAY_CONFIRMATION', 'SECURE_DELIVERY', 'BLOCKCHAIN_ESCROW', 'MANUAL_HASH');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "data" JSONB,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "verificationState" TEXT DEFAULT 'INITIATED',
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

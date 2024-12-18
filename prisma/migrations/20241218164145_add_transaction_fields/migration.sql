-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "buyerConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "data" JSONB,
ADD COLUMN     "originalAmount" DOUBLE PRECISION,
ADD COLUMN     "originalCurrency" TEXT,
ADD COLUMN     "paymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellerConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationState" TEXT;

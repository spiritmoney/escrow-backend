-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "stripePaymentId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeAccountStatus" TEXT DEFAULT 'PENDING';

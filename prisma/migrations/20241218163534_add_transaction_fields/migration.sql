/*
  Warnings:

  - You are about to drop the column `amount` on the `milestones` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `milestones` table. All the data in the column will be lost.
  - You are about to drop the column `buyerConfirmed` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `originalAmount` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `originalCurrency` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `paymentConfirmed` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `sellerConfirmed` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `verificationState` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_customerId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_senderId_fkey";

-- AlterTable
ALTER TABLE "milestones" DROP COLUMN "amount",
DROP COLUMN "order",
ADD COLUMN     "dueDate" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "payment_links" ADD COLUMN     "completedStages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dealStages" JSONB,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "isSandbox" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sandboxMetadata" JSONB;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "buyerConfirmed",
DROP COLUMN "data",
DROP COLUMN "method",
DROP COLUMN "originalAmount",
DROP COLUMN "originalCurrency",
DROP COLUMN "paymentConfirmed",
DROP COLUMN "sellerConfirmed",
DROP COLUMN "verificationState",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "dealStage" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "sandboxData" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "senderId" DROP NOT NULL,
ALTER COLUMN "customerId" DROP NOT NULL;

-- DropTable
DROP TABLE "Customer";

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `details` on the `payment_links` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payment_links" DROP COLUMN "details",
ADD COLUMN     "stripeConnectId" TEXT,
ALTER COLUMN "serviceDetails" DROP NOT NULL,
ALTER COLUMN "serviceProof" DROP NOT NULL;

-- CreateTable
CREATE TABLE "stripe_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_accounts_userId_key" ON "stripe_accounts"("userId");

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_stripeConnectId_fkey" FOREIGN KEY ("stripeConnectId") REFERENCES "stripe_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_accounts" ADD CONSTRAINT "stripe_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

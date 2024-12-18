/*
  Warnings:

  - You are about to drop the column `details` on the `payment_links` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `payment_links` table. All the data in the column will be lost.
  - Added the required column `paymentMethods` to the `payment_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceDetails` to the `payment_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceProof` to the `payment_links` table without a default value. This is not possible if the table is not empty.
  - Made the column `defaultAmount` on table `payment_links` required. This step will fail if there are existing NULL values in that column.
  - Made the column `defaultCurrency` on table `payment_links` required. This step will fail if there are existing NULL values in that column.
  - Made the column `verificationMethod` on table `payment_links` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "payment_links" DROP COLUMN "details",
DROP COLUMN "url",
ADD COLUMN     "allowedBuyers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isAmountNegotiable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maximumAmount" DOUBLE PRECISION,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "minimumAmount" DOUBLE PRECISION,
ADD COLUMN     "paymentMethods" JSONB NOT NULL,
ADD COLUMN     "serviceDetails" JSONB NOT NULL,
ADD COLUMN     "serviceProof" JSONB NOT NULL,
ALTER COLUMN "defaultAmount" SET NOT NULL,
ALTER COLUMN "defaultCurrency" SET NOT NULL,
ALTER COLUMN "verificationMethod" SET NOT NULL;

/*
  Warnings:

  - You are about to drop the column `buyerAddress` on the `payment_links` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `payment_links` table. All the data in the column will be lost.
  - You are about to drop the column `sellerAddress` on the `payment_links` table. All the data in the column will be lost.
  - Made the column `defaultCurrency` on table `payment_links` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "payment_links_url_key";

-- AlterTable
ALTER TABLE "payment_links" DROP COLUMN "buyerAddress",
DROP COLUMN "description",
DROP COLUMN "sellerAddress",
ADD COLUMN     "details" JSONB,
ALTER COLUMN "defaultCurrency" SET NOT NULL;

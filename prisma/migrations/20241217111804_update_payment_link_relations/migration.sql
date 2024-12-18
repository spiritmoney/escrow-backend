/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `payment_links` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `url` to the `payment_links` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payment_links" ADD COLUMN     "details" JSONB,
ADD COLUMN     "url" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_url_key" ON "payment_links"("url");

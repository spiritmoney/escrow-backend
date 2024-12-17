/*
  Warnings:

  - Added the required column `verificationMethod` to the `PaymentLink` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PaymentLink" ADD COLUMN     "verificationMethod" TEXT NOT NULL;

/*
  Warnings:

  - You are about to drop the column `source` on the `growth_ledger_record` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "growth_ledger_record_source_created_at_idx";

-- AlterTable
ALTER TABLE "growth_ledger_record" DROP COLUMN "source";

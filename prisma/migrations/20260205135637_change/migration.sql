/*
  Warnings:

  - You are about to drop the column `order` on the `sys_dictionary_item` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "sys_dictionary_item_order_idx";

-- AlterTable
ALTER TABLE "sys_dictionary_item" DROP COLUMN "order",
ADD COLUMN     "sort_order" SMALLSERIAL;

-- CreateIndex
CREATE INDEX "sys_dictionary_item_sort_order_idx" ON "sys_dictionary_item"("sort_order");

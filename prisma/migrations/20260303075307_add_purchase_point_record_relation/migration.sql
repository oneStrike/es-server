-- AlterTable
ALTER TABLE "user_point_record" ADD COLUMN     "purchase_id" INTEGER;

-- CreateIndex
CREATE INDEX "user_point_record_purchase_id_idx" ON "user_point_record"("purchase_id");

-- AddForeignKey
ALTER TABLE "user_point_record" ADD CONSTRAINT "user_point_record_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "user_purchase_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

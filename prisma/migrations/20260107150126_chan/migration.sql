-- AlterTable
ALTER TABLE "forum_reply" ADD COLUMN     "actual_reply_to_id" INTEGER,
ADD COLUMN     "floor" INTEGER;

-- CreateIndex
CREATE INDEX "forum_reply_actual_reply_to_id_idx" ON "forum_reply"("actual_reply_to_id");

-- CreateIndex
CREATE INDEX "forum_reply_floor_idx" ON "forum_reply"("floor");

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

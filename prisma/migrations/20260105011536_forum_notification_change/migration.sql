/*
  Warnings:

  - You are about to drop the column `object_id` on the `forum_notification` table. All the data in the column will be lost.
  - You are about to drop the column `object_type` on the `forum_notification` table. All the data in the column will be lost.
  - You are about to alter the column `content` on the `forum_notification` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1000)`.

*/
-- DropIndex
DROP INDEX "forum_notification_object_type_object_id_idx";

-- AlterTable
ALTER TABLE "forum_notification" DROP COLUMN "object_id",
DROP COLUMN "object_type",
ADD COLUMN     "reply_id" INTEGER,
ADD COLUMN     "topic_id" INTEGER,
ALTER COLUMN "content" SET DATA TYPE VARCHAR(1000),
ALTER COLUMN "priority" SET DEFAULT 1;

-- CreateIndex
CREATE INDEX "forum_notification_topic_id_idx" ON "forum_notification"("topic_id");

-- CreateIndex
CREATE INDEX "forum_notification_reply_id_idx" ON "forum_notification"("reply_id");

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

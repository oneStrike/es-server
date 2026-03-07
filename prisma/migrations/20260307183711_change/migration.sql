/*
  Warnings:

  - The `status` column on the `message_outbox` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `subject_type` column on the `user_notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `domain` on the `message_outbox` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `event_type` on the `message_outbox` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `user_notification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "message_outbox" DROP COLUMN "domain",
ADD COLUMN     "domain" SMALLINT NOT NULL,
DROP COLUMN "event_type",
ADD COLUMN     "event_type" SMALLINT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" SMALLINT NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "user_notification" DROP COLUMN "type",
ADD COLUMN     "type" SMALLINT NOT NULL,
DROP COLUMN "subject_type",
ADD COLUMN     "subject_type" SMALLINT;

-- CreateIndex
CREATE INDEX "message_outbox_status_next_retry_at_id_idx" ON "message_outbox"("status", "next_retry_at", "id");

-- CreateIndex
CREATE INDEX "message_outbox_domain_status_created_at_idx" ON "message_outbox"("domain", "status", "created_at");

-- CreateIndex
CREATE INDEX "user_notification_type_created_at_idx" ON "user_notification"("type", "created_at" DESC);

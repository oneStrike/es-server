/*
  Warnings:

  - You are about to drop the column `order` on the `forum_tag` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_tag_order_idx";

-- AlterTable
ALTER TABLE "forum_tag" DROP COLUMN "order",
ADD COLUMN     "sortOrder" SMALLINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "forum_report" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "evidence_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "handler_id" INTEGER,
    "handling_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_view" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "reply_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(20),
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER DEFAULT 0,
    "device" VARCHAR(50),
    "ip_address" VARCHAR(45),

    CONSTRAINT "forum_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_report_reporter_id_idx" ON "forum_report"("reporter_id");

-- CreateIndex
CREATE INDEX "forum_report_type_idx" ON "forum_report"("type");

-- CreateIndex
CREATE INDEX "forum_report_target_id_idx" ON "forum_report"("target_id");

-- CreateIndex
CREATE INDEX "forum_report_status_idx" ON "forum_report"("status");

-- CreateIndex
CREATE INDEX "forum_report_created_at_idx" ON "forum_report"("created_at");

-- CreateIndex
CREATE INDEX "forum_view_topic_id_idx" ON "forum_view"("topic_id");

-- CreateIndex
CREATE INDEX "forum_view_user_id_idx" ON "forum_view"("user_id");

-- CreateIndex
CREATE INDEX "forum_view_viewed_at_idx" ON "forum_view"("viewed_at");

-- CreateIndex
CREATE INDEX "forum_view_topic_id_user_id_idx" ON "forum_view"("topic_id", "user_id");

-- CreateIndex
CREATE INDEX "forum_tag_sortOrder_idx" ON "forum_tag"("sortOrder");

-- AddForeignKey
ALTER TABLE "forum_report" ADD CONSTRAINT "forum_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_report" ADD CONSTRAINT "forum_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "forum_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_view" ADD CONSTRAINT "forum_view_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_view" ADD CONSTRAINT "forum_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

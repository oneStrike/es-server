/*
  Warnings:

  - You are about to drop the column `name` on the `user_point_rule` table. All the data in the column will be lost.
  - You are about to alter the column `type` on the `work_author` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.

*/
-- DropIndex
DROP INDEX "user_point_rule_name_key";

-- AlterTable
ALTER TABLE "user_point_rule" DROP COLUMN "name";

-- AlterTable
ALTER TABLE "work_author" ALTER COLUMN "type" SET DATA TYPE SMALLINT[];

-- CreateTable
CREATE TABLE "user_comment_like" (
    "id" SERIAL NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_comment_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_comment_report" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "comment_id" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "evidence_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "handling_note" VARCHAR(500),
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_comment_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_comment" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "floor" INTEGER,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_reason" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "audit_by_id" INTEGER,
    "audit_role" SMALLINT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "sensitive_word_hits" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_download" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorite" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_like" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_view" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ip_address" VARCHAR(45),
    "device" VARCHAR(20),
    "user_agent" VARCHAR(500),
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_comment_like_comment_id_idx" ON "user_comment_like"("comment_id");

-- CreateIndex
CREATE INDEX "user_comment_like_user_id_idx" ON "user_comment_like"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_comment_like_comment_id_user_id_key" ON "user_comment_like"("comment_id", "user_id");

-- CreateIndex
CREATE INDEX "user_comment_report_comment_id_idx" ON "user_comment_report"("comment_id");

-- CreateIndex
CREATE INDEX "user_comment_report_reporter_id_idx" ON "user_comment_report"("reporter_id");

-- CreateIndex
CREATE INDEX "user_comment_report_status_idx" ON "user_comment_report"("status");

-- CreateIndex
CREATE INDEX "user_comment_report_created_at_idx" ON "user_comment_report"("created_at");

-- CreateIndex
CREATE INDEX "user_comment_target_type_target_id_created_at_idx" ON "user_comment"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "user_comment_user_id_idx" ON "user_comment"("user_id");

-- CreateIndex
CREATE INDEX "user_comment_created_at_idx" ON "user_comment"("created_at");

-- CreateIndex
CREATE INDEX "user_comment_audit_status_idx" ON "user_comment"("audit_status");

-- CreateIndex
CREATE INDEX "user_comment_is_hidden_idx" ON "user_comment"("is_hidden");

-- CreateIndex
CREATE INDEX "user_comment_reply_to_id_idx" ON "user_comment"("reply_to_id");

-- CreateIndex
CREATE INDEX "user_comment_actual_reply_to_id_idx" ON "user_comment"("actual_reply_to_id");

-- CreateIndex
CREATE INDEX "user_comment_deleted_at_idx" ON "user_comment"("deleted_at");

-- CreateIndex
CREATE INDEX "user_download_target_type_target_id_idx" ON "user_download"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_download_user_id_idx" ON "user_download"("user_id");

-- CreateIndex
CREATE INDEX "user_download_work_id_idx" ON "user_download"("work_id");

-- CreateIndex
CREATE INDEX "user_download_work_type_idx" ON "user_download"("work_type");

-- CreateIndex
CREATE INDEX "user_download_created_at_idx" ON "user_download"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_download_target_type_target_id_user_id_key" ON "user_download"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_favorite_target_type_target_id_idx" ON "user_favorite"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_favorite_user_id_idx" ON "user_favorite"("user_id");

-- CreateIndex
CREATE INDEX "user_favorite_created_at_idx" ON "user_favorite"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_target_type_target_id_user_id_key" ON "user_favorite"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_like_target_type_target_id_idx" ON "user_like"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_like_user_id_idx" ON "user_like"("user_id");

-- CreateIndex
CREATE INDEX "user_like_created_at_idx" ON "user_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_like_target_type_target_id_user_id_key" ON "user_like"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_view_target_type_target_id_idx" ON "user_view"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_view_user_id_idx" ON "user_view"("user_id");

-- CreateIndex
CREATE INDEX "user_view_viewed_at_idx" ON "user_view"("viewed_at");

-- CreateIndex
CREATE INDEX "user_view_target_type_target_id_user_id_idx" ON "user_view"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_view_user_id_viewed_at_idx" ON "user_view"("user_id", "viewed_at");

-- AddForeignKey
ALTER TABLE "user_comment_like" ADD CONSTRAINT "user_comment_like_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "user_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_like" ADD CONSTRAINT "user_comment_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_report" ADD CONSTRAINT "user_comment_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_report" ADD CONSTRAINT "user_comment_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_report" ADD CONSTRAINT "user_comment_report_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "user_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment" ADD CONSTRAINT "user_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment" ADD CONSTRAINT "user_comment_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "user_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment" ADD CONSTRAINT "user_comment_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "user_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_download" ADD CONSTRAINT "user_download_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_like" ADD CONSTRAINT "user_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_view" ADD CONSTRAINT "user_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

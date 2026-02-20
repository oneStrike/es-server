/*
  Warnings:

  - You are about to drop the `forum_sensitive_word` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "sys_config" ADD COLUMN     "comment_rate_limit_config" JSONB,
ADD COLUMN     "content_review_policy" JSONB,
ADD COLUMN     "maintenance_config" JSONB,
ADD COLUMN     "notify_config" JSONB,
ADD COLUMN     "register_config" JSONB,
ADD COLUMN     "site_config" JSONB,
ADD COLUMN     "updated_by_id" INTEGER;

-- DropTable
DROP TABLE "forum_sensitive_word";

-- CreateTable
CREATE TABLE "sensitive_word" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(100) NOT NULL,
    "replace_word" VARCHAR(100),
    "level" SMALLINT NOT NULL DEFAULT 2,
    "type" SMALLINT NOT NULL DEFAULT 5,
    "match_mode" SMALLINT NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "remark" VARCHAR(500),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sensitive_word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_chapter_comment_report" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "comment_id" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "evidence_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "handling_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_comic_chapter_comment_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_chapter_comment" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sensitive_word_hits" JSONB,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "floor" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_reason" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "audit_by_id" INTEGER,
    "audit_role" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_comic_chapter_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_word_word_key" ON "sensitive_word"("word");

-- CreateIndex
CREATE INDEX "sensitive_word_word_idx" ON "sensitive_word"("word");

-- CreateIndex
CREATE INDEX "sensitive_word_type_idx" ON "sensitive_word"("type");

-- CreateIndex
CREATE INDEX "sensitive_word_level_idx" ON "sensitive_word"("level");

-- CreateIndex
CREATE INDEX "sensitive_word_is_enabled_idx" ON "sensitive_word"("is_enabled");

-- CreateIndex
CREATE INDEX "sensitive_word_match_mode_idx" ON "sensitive_word"("match_mode");

-- CreateIndex
CREATE INDEX "sensitive_word_created_at_idx" ON "sensitive_word"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_report_reporter_id_idx" ON "work_comic_chapter_comment_report"("reporter_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_report_handler_id_idx" ON "work_comic_chapter_comment_report"("handler_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_report_comment_id_idx" ON "work_comic_chapter_comment_report"("comment_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_report_status_idx" ON "work_comic_chapter_comment_report"("status");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_report_created_at_idx" ON "work_comic_chapter_comment_report"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_chapter_id_idx" ON "work_comic_chapter_comment"("chapter_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_user_id_idx" ON "work_comic_chapter_comment"("user_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_created_at_idx" ON "work_comic_chapter_comment"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_audit_status_idx" ON "work_comic_chapter_comment"("audit_status");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_is_hidden_idx" ON "work_comic_chapter_comment"("is_hidden");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_reply_to_id_idx" ON "work_comic_chapter_comment"("reply_to_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_actual_reply_to_id_idx" ON "work_comic_chapter_comment"("actual_reply_to_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_deleted_at_idx" ON "work_comic_chapter_comment"("deleted_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comment_chapter_id_created_at_idx" ON "work_comic_chapter_comment"("chapter_id", "created_at");

-- CreateIndex
CREATE INDEX "sys_config_updated_by_id_idx" ON "sys_config"("updated_by_id");

-- AddForeignKey
ALTER TABLE "sys_config" ADD CONSTRAINT "sys_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_comment_report" ADD CONSTRAINT "work_comic_chapter_comment_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_comment_report" ADD CONSTRAINT "work_comic_chapter_comment_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_comment_report" ADD CONSTRAINT "work_comic_chapter_comment_report_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "work_comic_chapter_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_comment" ADD CONSTRAINT "work_comic_chapter_comment_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "work_comic_chapter_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_comment" ADD CONSTRAINT "work_comic_chapter_comment_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "work_comic_chapter_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_comment" ADD CONSTRAINT "work_comic_chapter_comment_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_comic_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_comment" ADD CONSTRAINT "work_comic_chapter_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

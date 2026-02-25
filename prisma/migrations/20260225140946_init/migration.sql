-- AlterTable
ALTER TABLE "forum_notification" ADD COLUMN     "reply_id" INTEGER;

-- CreateTable
CREATE TABLE "forum_reply_like" (
    "id" SERIAL NOT NULL,
    "reply_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reply_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reply" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "content" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_reason" TEXT,
    "sensitive_word_hits" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comment_report" (
    "id" SERIAL NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "handling_note" TEXT,
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_comment_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comment" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" INTEGER NOT NULL,
    "chapter_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" INTEGER NOT NULL DEFAULT 1,
    "audit_reason" TEXT,
    "audit_at" TIMESTAMPTZ(6),
    "audit_by_id" INTEGER,
    "audit_role" SMALLINT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "sensitive_word_hits" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_reply_like_reply_id_idx" ON "forum_reply_like"("reply_id");

-- CreateIndex
CREATE INDEX "forum_reply_like_user_id_idx" ON "forum_reply_like"("user_id");

-- CreateIndex
CREATE INDEX "forum_reply_like_created_at_idx" ON "forum_reply_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reply_like_reply_id_user_id_key" ON "forum_reply_like"("reply_id", "user_id");

-- CreateIndex
CREATE INDEX "forum_reply_topic_id_idx" ON "forum_reply"("topic_id");

-- CreateIndex
CREATE INDEX "forum_reply_user_id_idx" ON "forum_reply"("user_id");

-- CreateIndex
CREATE INDEX "forum_reply_reply_to_id_idx" ON "forum_reply"("reply_to_id");

-- CreateIndex
CREATE INDEX "forum_reply_actual_reply_to_id_idx" ON "forum_reply"("actual_reply_to_id");

-- CreateIndex
CREATE INDEX "forum_reply_created_at_idx" ON "forum_reply"("created_at");

-- CreateIndex
CREATE INDEX "forum_reply_deleted_at_idx" ON "forum_reply"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_reply_audit_status_idx" ON "forum_reply"("audit_status");

-- CreateIndex
CREATE INDEX "work_comment_report_comment_id_idx" ON "work_comment_report"("comment_id");

-- CreateIndex
CREATE INDEX "work_comment_report_reporter_id_idx" ON "work_comment_report"("reporter_id");

-- CreateIndex
CREATE INDEX "work_comment_report_handler_id_idx" ON "work_comment_report"("handler_id");

-- CreateIndex
CREATE INDEX "work_comment_report_status_idx" ON "work_comment_report"("status");

-- CreateIndex
CREATE INDEX "work_comment_report_created_at_idx" ON "work_comment_report"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comment_report_comment_id_reporter_id_key" ON "work_comment_report"("comment_id", "reporter_id");

-- CreateIndex
CREATE INDEX "work_comment_work_id_idx" ON "work_comment"("work_id");

-- CreateIndex
CREATE INDEX "work_comment_chapter_id_idx" ON "work_comment"("chapter_id");

-- CreateIndex
CREATE INDEX "work_comment_user_id_idx" ON "work_comment"("user_id");

-- CreateIndex
CREATE INDEX "work_comment_audit_status_idx" ON "work_comment"("audit_status");

-- CreateIndex
CREATE INDEX "work_comment_created_at_idx" ON "work_comment"("created_at");

-- CreateIndex
CREATE INDEX "work_comment_deleted_at_idx" ON "work_comment"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_notification_reply_id_idx" ON "forum_notification"("reply_id");

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "work_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "work_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "work_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

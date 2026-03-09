/*
  说明：

  - 本次迁移不保留旧的点赞与举报数据。
  - 用户已确认只需要保证新结构与种子文件可直接工作。
*/

-- 为避免旧结构残留数据影响新约束，直接重建两张表
DROP TABLE IF EXISTS "user_like";
DROP TABLE IF EXISTS "user_report";

-- CreateTable
CREATE TABLE "user_like" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "scene_type" SMALLINT NOT NULL,
    "scene_id" INTEGER NOT NULL,
    "comment_level" SMALLINT,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_report" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "scene_type" SMALLINT NOT NULL,
    "scene_id" INTEGER NOT NULL,
    "comment_level" SMALLINT,
    "reason_type" SMALLINT NOT NULL,
    "description" VARCHAR(500),
    "evidence_url" VARCHAR(500),
    "status" SMALLINT NOT NULL DEFAULT 1,
    "handling_note" VARCHAR(500),
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_like_target_type_target_id_idx" ON "user_like"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_like_scene_type_scene_id_idx" ON "user_like"("scene_type", "scene_id");

-- CreateIndex
CREATE INDEX "user_like_user_id_scene_type_created_at_idx" ON "user_like"("user_id", "scene_type", "created_at");

-- CreateIndex
CREATE INDEX "user_like_created_at_idx" ON "user_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_like_target_type_target_id_user_id_key" ON "user_like"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_report_target_type_target_id_idx" ON "user_report"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_report_scene_type_scene_id_status_idx" ON "user_report"("scene_type", "scene_id", "status");

-- CreateIndex
CREATE INDEX "user_report_scene_type_status_created_at_idx" ON "user_report"("scene_type", "status", "created_at");

-- CreateIndex
CREATE INDEX "user_report_reason_type_status_created_at_idx" ON "user_report"("reason_type", "status", "created_at");

-- CreateIndex
CREATE INDEX "user_report_handler_id_status_handled_at_idx" ON "user_report"("handler_id", "status", "handled_at");

-- CreateIndex
CREATE INDEX "user_report_created_at_idx" ON "user_report"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_report_reporter_id_target_type_target_id_key" ON "user_report"("reporter_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "user_like" ADD CONSTRAINT "user_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

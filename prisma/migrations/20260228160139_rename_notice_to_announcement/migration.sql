/*
  Warnings:

  - You are about to drop the `app_notice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `app_notice_read` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "app_notice" DROP CONSTRAINT "app_notice_page_id_fkey";

-- DropForeignKey
ALTER TABLE "app_notice_read" DROP CONSTRAINT "app_notice_read_notice_id_fkey";

-- DropForeignKey
ALTER TABLE "app_notice_read" DROP CONSTRAINT "app_notice_read_user_id_fkey";

-- DropTable
DROP TABLE "app_notice";

-- DropTable
DROP TABLE "app_notice_read";

-- CreateTable
CREATE TABLE "app_announcement_read" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_announcement_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_announcement" (
    "id" SERIAL NOT NULL,
    "page_id" INTEGER,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "summary" VARCHAR(500),
    "announcement_type" SMALLINT NOT NULL DEFAULT 0,
    "priority_level" SMALLINT NOT NULL DEFAULT 1,
    "publish_start_time" TIMESTAMPTZ(6),
    "publish_end_time" TIMESTAMPTZ(6),
    "popup_background_image" VARCHAR(200),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "show_as_popup" BOOLEAN NOT NULL DEFAULT false,
    "enable_platform" INTEGER[],
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_announcement_read_announcement_id_idx" ON "app_announcement_read"("announcement_id");

-- CreateIndex
CREATE INDEX "app_announcement_read_user_id_idx" ON "app_announcement_read"("user_id");

-- CreateIndex
CREATE INDEX "app_announcement_read_read_at_idx" ON "app_announcement_read"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_announcement_read_announcement_id_user_id_key" ON "app_announcement_read"("announcement_id", "user_id");

-- CreateIndex
CREATE INDEX "app_announcement_is_published_publish_start_time_publish_en_idx" ON "app_announcement"("is_published", "publish_start_time", "publish_end_time");

-- CreateIndex
CREATE INDEX "app_announcement_announcement_type_is_published_idx" ON "app_announcement"("announcement_type", "is_published");

-- CreateIndex
CREATE INDEX "app_announcement_priority_level_is_pinned_idx" ON "app_announcement"("priority_level", "is_pinned");

-- CreateIndex
CREATE INDEX "app_announcement_created_at_idx" ON "app_announcement"("created_at");

-- CreateIndex
CREATE INDEX "app_announcement_page_id_idx" ON "app_announcement"("page_id");

-- CreateIndex
CREATE INDEX "app_announcement_show_as_popup_is_published_idx" ON "app_announcement"("show_as_popup", "is_published");

-- AddForeignKey
ALTER TABLE "app_announcement_read" ADD CONSTRAINT "app_announcement_read_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "app_announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_announcement_read" ADD CONSTRAINT "app_announcement_read_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_announcement" ADD CONSTRAINT "app_announcement_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "app_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

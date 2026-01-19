/*
  Warnings:

  - You are about to drop the `client_config` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_notice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_notice_read` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_page` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "client_notice" DROP CONSTRAINT "client_notice_page_id_fkey";

-- DropForeignKey
ALTER TABLE "client_notice_read" DROP CONSTRAINT "client_notice_read_notice_id_fkey";

-- DropForeignKey
ALTER TABLE "client_notice_read" DROP CONSTRAINT "client_notice_read_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_profile" DROP CONSTRAINT "forum_profile_user_id_fkey";

-- DropTable
DROP TABLE "client_config";

-- DropTable
DROP TABLE "client_notice";

-- DropTable
DROP TABLE "client_notice_read";

-- DropTable
DROP TABLE "client_page";

-- DropTable
DROP TABLE "client_user";

-- CreateTable
CREATE TABLE "app_config" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notice_read" (
    "id" SERIAL NOT NULL,
    "notice_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notice_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notice" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "notice_type" SMALLINT NOT NULL DEFAULT 0,
    "priority_level" SMALLINT NOT NULL DEFAULT 1,
    "publish_start_time" TIMESTAMPTZ(6),
    "publish_end_time" TIMESTAMPTZ(6),
    "page_id" INTEGER,
    "popup_background_image" VARCHAR(200),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "show_as_popup" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "enable_platform" INTEGER[],

    CONSTRAINT "app_notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_page" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "access_level" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "enable_platform" INTEGER[],

    CONSTRAINT "app_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" SERIAL NOT NULL,
    "account" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100),
    "password" VARCHAR(500) NOT NULL,
    "avatar_url" VARCHAR(500),
    "phone_number" VARCHAR(20),
    "email_address" VARCHAR(255),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "gender_type" SMALLINT NOT NULL DEFAULT 0,
    "birth_date" DATE,
    "is_signed_in" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_notice_read_notice_id_idx" ON "app_notice_read"("notice_id");

-- CreateIndex
CREATE INDEX "app_notice_read_user_id_idx" ON "app_notice_read"("user_id");

-- CreateIndex
CREATE INDEX "app_notice_read_read_at_idx" ON "app_notice_read"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_notice_read_notice_id_user_id_key" ON "app_notice_read"("notice_id", "user_id");

-- CreateIndex
CREATE INDEX "app_notice_is_published_publish_start_time_publish_end_time_idx" ON "app_notice"("is_published", "publish_start_time", "publish_end_time");

-- CreateIndex
CREATE INDEX "app_notice_notice_type_is_published_idx" ON "app_notice"("notice_type", "is_published");

-- CreateIndex
CREATE INDEX "app_notice_priority_level_is_pinned_idx" ON "app_notice"("priority_level", "is_pinned");

-- CreateIndex
CREATE INDEX "app_notice_created_at_idx" ON "app_notice"("created_at");

-- CreateIndex
CREATE INDEX "app_notice_page_id_idx" ON "app_notice"("page_id");

-- CreateIndex
CREATE INDEX "app_notice_show_as_popup_is_published_idx" ON "app_notice"("show_as_popup", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "app_page_code_key" ON "app_page"("code");

-- CreateIndex
CREATE UNIQUE INDEX "app_page_path_key" ON "app_page"("path");

-- CreateIndex
CREATE INDEX "app_page_access_level_is_enabled_idx" ON "app_page"("access_level", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_account_key" ON "app_user"("account");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_phone_number_key" ON "app_user"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_address_key" ON "app_user"("email_address");

-- CreateIndex
CREATE INDEX "app_user_is_enabled_idx" ON "app_user"("is_enabled");

-- CreateIndex
CREATE INDEX "app_user_gender_type_idx" ON "app_user"("gender_type");

-- CreateIndex
CREATE INDEX "app_user_created_at_idx" ON "app_user"("created_at");

-- CreateIndex
CREATE INDEX "app_user_last_login_at_idx" ON "app_user"("last_login_at");

-- CreateIndex
CREATE INDEX "app_user_phone_number_idx" ON "app_user"("phone_number");

-- CreateIndex
CREATE INDEX "app_user_email_address_idx" ON "app_user"("email_address");

-- AddForeignKey
ALTER TABLE "app_notice_read" ADD CONSTRAINT "app_notice_read_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "app_notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notice_read" ADD CONSTRAINT "app_notice_read_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notice" ADD CONSTRAINT "app_notice_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "app_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_user_action_log" ADD CONSTRAINT "forum_user_action_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

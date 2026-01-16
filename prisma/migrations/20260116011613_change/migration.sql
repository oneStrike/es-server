-- 自定义迁移脚本：将 client_* 表重命名为 app_* 表并保留数据

-- 步骤1: 创建新的 app_* 表（不带外键约束）
CREATE TABLE "app_config" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_notice_read" (
    "id" SERIAL NOT NULL,
    "notice_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_notice_read_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "app_user" (
    "id" SERIAL NOT NULL,
    "account" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "phone_number" VARCHAR(20),
    "email_address" VARCHAR(255),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "gender_type" SMALLINT NOT NULL DEFAULT 0,
    "birth_date" DATE,
    "is_signed_in" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- 步骤2: 创建索引
CREATE INDEX "app_notice_read_notice_id_idx" ON "app_notice_read"("notice_id");
CREATE INDEX "app_notice_read_user_id_idx" ON "app_notice_read"("user_id");
CREATE INDEX "app_notice_read_read_at_idx" ON "app_notice_read"("read_at");
CREATE UNIQUE INDEX "app_notice_read_notice_id_user_id_key" ON "app_notice_read"("notice_id", "user_id");

CREATE INDEX "app_notice_is_published_publish_start_time_publish_end_time_idx" ON "app_notice"("is_published", "publish_start_time", "publish_end_time");
CREATE INDEX "app_notice_notice_type_is_published_idx" ON "app_notice"("notice_type", "is_published");
CREATE INDEX "app_notice_priority_level_is_pinned_idx" ON "app_notice"("priority_level", "is_pinned");
CREATE INDEX "app_notice_created_at_idx" ON "app_notice"("created_at");
CREATE INDEX "app_notice_page_id_idx" ON "app_notice"("page_id");
CREATE INDEX "app_notice_show_as_popup_is_published_idx" ON "app_notice"("show_as_popup", "is_published");

CREATE UNIQUE INDEX "app_page_code_key" ON "app_page"("code");
CREATE UNIQUE INDEX "app_page_path_key" ON "app_page"("path");
CREATE INDEX "app_page_access_level_is_enabled_idx" ON "app_page"("access_level", "is_enabled");

CREATE UNIQUE INDEX "app_user_account_key" ON "app_user"("account");
CREATE UNIQUE INDEX "app_user_phone_number_key" ON "app_user"("phone_number");
CREATE UNIQUE INDEX "app_user_email_address_key" ON "app_user"("email_address");
CREATE INDEX "app_user_is_enabled_idx" ON "app_user"("is_enabled");
CREATE INDEX "app_user_gender_type_idx" ON "app_user"("gender_type");
CREATE INDEX "app_user_created_at_idx" ON "app_user"("created_at");
CREATE INDEX "app_user_last_login_at_idx" ON "app_user"("last_login_at");
CREATE INDEX "app_user_phone_number_idx" ON "app_user"("phone_number");
CREATE INDEX "app_user_email_address_idx" ON "app_user"("email_address");

-- 步骤3: 复制数据
INSERT INTO "app_config" SELECT * FROM "client_config";
INSERT INTO "app_user" SELECT * FROM "client_user";
INSERT INTO "app_page" SELECT * FROM "client_page";
INSERT INTO "app_notice" SELECT * FROM "client_notice";
INSERT INTO "app_notice_read" SELECT * FROM "client_notice_read";

-- 步骤4: 删除旧表的外键约束
ALTER TABLE "client_notice" DROP CONSTRAINT IF EXISTS "client_notice_page_id_fkey";
ALTER TABLE "client_notice_read" DROP CONSTRAINT IF EXISTS "client_notice_read_notice_id_fkey";
ALTER TABLE "client_notice_read" DROP CONSTRAINT IF EXISTS "client_notice_read_user_id_fkey";
ALTER TABLE "forum_profile" DROP CONSTRAINT IF EXISTS "forum_profile_user_id_fkey";

-- 步骤5: 删除旧表
DROP TABLE IF EXISTS "client_config" CASCADE;
DROP TABLE IF EXISTS "client_notice" CASCADE;
DROP TABLE IF EXISTS "client_notice_read" CASCADE;
DROP TABLE IF EXISTS "client_page" CASCADE;
DROP TABLE IF EXISTS "client_user" CASCADE;

-- 步骤6: 添加外键约束
ALTER TABLE "app_notice_read" ADD CONSTRAINT "app_notice_read_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "app_notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_notice_read" ADD CONSTRAINT "app_notice_read_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_notice" ADD CONSTRAINT "app_notice_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "app_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

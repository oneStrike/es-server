-- CreateTable
CREATE TABLE "admin_user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "password" VARCHAR(100) NOT NULL,
    "avatar" VARCHAR(200),
    "mobile" VARCHAR(11),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "role" SMALLINT NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "login_fail_at" TIMESTAMPTZ,
    "login_fail_ip" VARCHAR(45),
    "login_fail_count" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_config" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notice" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "notice_type" SMALLINT NOT NULL DEFAULT 0,
    "priority_level" SMALLINT NOT NULL DEFAULT 1,
    "publish_start_time" TIMESTAMPTZ,
    "publish_end_time" TIMESTAMPTZ,
    "page_id" INTEGER,
    "popup_background_image" VARCHAR(200),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "enable_platform" INTEGER NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "show_as_popup" BOOLEAN NOT NULL DEFAULT false,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_page" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200),
    "access_level" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "phone_number" VARCHAR(20),
    "email_address" VARCHAR(255),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "gender_type" SMALLINT NOT NULL DEFAULT 0,
    "birth_date" DATE,
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "client_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "username" TEXT,
    "api_type" VARCHAR(20),
    "ip" VARCHAR(45),
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "params" JSONB,
    "action_type" VARCHAR(50),
    "is_success" BOOLEAN NOT NULL,
    "user_agent" VARCHAR(255),
    "device" JSONB,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "cover" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_item" (
    "id" SERIAL NOT NULL,
    "dictionary_code" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "order" SMALLSERIAL,
    "cover" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "dictionary_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_author_role_type" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_author_role_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_author_role" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "role_type_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_author_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_author" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "avatar" VARCHAR(500),
    "description" VARCHAR(1000),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "nationality" VARCHAR(50),
    "gender" SMALLINT NOT NULL DEFAULT 0,
    "works_count" INTEGER NOT NULL DEFAULT 0,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "social_links" TEXT,
    "remark" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "work_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_author" (
    "id" SERIAL NOT NULL,
    "comic_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "role_type" SMALLINT NOT NULL DEFAULT 1,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_comic_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_category" (
    "comic_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_comic_category_pkey" PRIMARY KEY ("comic_id","category_id")
);

-- CreateTable
CREATE TABLE "work_comic_chapter" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "subtitle" VARCHAR(200),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "comic_id" INTEGER NOT NULL,
    "version_id" INTEGER,
    "chapter_number" DOUBLE PRECISION NOT NULL,
    "read_rule" SMALLINT NOT NULL DEFAULT 0,
    "purchase_amount" INTEGER NOT NULL DEFAULT 0,
    "contents" TEXT NOT NULL DEFAULT '[]',
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "publish_at" TIMESTAMPTZ,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "remark" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "work_comic_chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_version" (
    "id" SERIAL NOT NULL,
    "comic_id" INTEGER NOT NULL,
    "versionName" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "translator_group" VARCHAR(100),
    "description" TEXT,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "publish_at" TIMESTAMPTZ,
    "last_updated" TIMESTAMPTZ,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "read_rule" SMALLINT NOT NULL DEFAULT 0,
    "purchase_amount" INTEGER NOT NULL DEFAULT 0,
    "copyright" VARCHAR(500),
    "disclaimer" TEXT,
    "remark" VARCHAR(1000),
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_comic_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "alias" VARCHAR(200),
    "cover" VARCHAR(500) NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "popularity_weight" INTEGER NOT NULL DEFAULT 0,
    "language" VARCHAR(10) NOT NULL,
    "region" VARCHAR(10) NOT NULL,
    "age_rating" VARCHAR(10),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "publish_at" DATE,
    "last_updated" TIMESTAMPTZ,
    "description" TEXT NOT NULL,
    "publisher" VARCHAR(100),
    "original_source" VARCHAR(100),
    "serial_status" SMALLINT NOT NULL DEFAULT 0,
    "total_chapters" INTEGER NOT NULL DEFAULT 0,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "can_download" BOOLEAN NOT NULL DEFAULT true,
    "can_comment" BOOLEAN NOT NULL DEFAULT true,
    "read_rule" SMALLINT NOT NULL DEFAULT 0,
    "purchase_amount" INTEGER DEFAULT 0,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(500),
    "seo_keywords" VARCHAR(500),
    "recommend_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "is_hot" BOOLEAN NOT NULL DEFAULT false,
    "is_new" BOOLEAN NOT NULL DEFAULT false,
    "copyright" VARCHAR(500),
    "disclaimer" TEXT,
    "remark" VARCHAR(1000),
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_comic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_category" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "popularity_weight" INTEGER NOT NULL DEFAULT 0,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_category_content_type" (
    "category_id" INTEGER NOT NULL,
    "content_type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_category_content_type_pkey" PRIMARY KEY ("category_id","content_type_id")
);

-- CreateTable
CREATE TABLE "work_content_type" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_content_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");

-- CreateIndex
CREATE INDEX "admin_user_is_enabled_idx" ON "admin_user"("is_enabled");

-- CreateIndex
CREATE INDEX "admin_user_role_idx" ON "admin_user"("role");

-- CreateIndex
CREATE INDEX "admin_user_created_at_idx" ON "admin_user"("created_at");

-- CreateIndex
CREATE INDEX "admin_user_last_login_at_idx" ON "admin_user"("last_login_at");

-- CreateIndex
CREATE INDEX "admin_user_is_locked_idx" ON "admin_user"("is_locked");

-- CreateIndex
CREATE INDEX "client_notice_is_published_publish_start_time_publish_end_t_idx" ON "client_notice"("is_published", "publish_start_time", "publish_end_time");

-- CreateIndex
CREATE INDEX "client_notice_notice_type_is_published_idx" ON "client_notice"("notice_type", "is_published");

-- CreateIndex
CREATE INDEX "client_notice_priority_level_is_pinned_idx" ON "client_notice"("priority_level", "is_pinned");

-- CreateIndex
CREATE INDEX "client_notice_created_at_idx" ON "client_notice"("created_at");

-- CreateIndex
CREATE INDEX "client_notice_page_id_idx" ON "client_notice"("page_id");

-- CreateIndex
CREATE INDEX "client_notice_show_as_popup_is_published_idx" ON "client_notice"("show_as_popup", "is_published");

-- CreateIndex
CREATE INDEX "client_notice_read_count_idx" ON "client_notice"("read_count");

-- CreateIndex
CREATE UNIQUE INDEX "client_page_code_key" ON "client_page"("code");

-- CreateIndex
CREATE UNIQUE INDEX "client_page_path_key" ON "client_page"("path");

-- CreateIndex
CREATE INDEX "client_page_access_level_is_enabled_idx" ON "client_page"("access_level", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_username_key" ON "client_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_phone_number_key" ON "client_user"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_email_address_key" ON "client_user"("email_address");

-- CreateIndex
CREATE INDEX "client_user_is_enabled_idx" ON "client_user"("is_enabled");

-- CreateIndex
CREATE INDEX "client_user_gender_type_idx" ON "client_user"("gender_type");

-- CreateIndex
CREATE INDEX "client_user_created_at_idx" ON "client_user"("created_at");

-- CreateIndex
CREATE INDEX "client_user_last_login_at_idx" ON "client_user"("last_login_at");

-- CreateIndex
CREATE INDEX "client_user_phone_number_idx" ON "client_user"("phone_number");

-- CreateIndex
CREATE INDEX "client_user_email_address_idx" ON "client_user"("email_address");

-- CreateIndex
CREATE INDEX "request_log_created_at_idx" ON "request_log"("created_at");

-- CreateIndex
CREATE INDEX "request_log_user_id_idx" ON "request_log"("user_id");

-- CreateIndex
CREATE INDEX "request_log_username_idx" ON "request_log"("username");

-- CreateIndex
CREATE INDEX "request_log_is_success_idx" ON "request_log"("is_success");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_name_key" ON "dictionary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_code_key" ON "dictionary"("code");

-- CreateIndex
CREATE INDEX "dictionary_item_dictionary_code_idx" ON "dictionary_item"("dictionary_code");

-- CreateIndex
CREATE INDEX "dictionary_item_order_idx" ON "dictionary_item"("order");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_item_dictionary_code_code_key" ON "dictionary_item"("dictionary_code", "code");

-- CreateIndex
CREATE UNIQUE INDEX "work_author_role_type_code_key" ON "work_author_role_type"("code");

-- CreateIndex
CREATE INDEX "work_author_role_type_is_enabled_idx" ON "work_author_role_type"("is_enabled");

-- CreateIndex
CREATE INDEX "work_author_role_author_id_idx" ON "work_author_role"("author_id");

-- CreateIndex
CREATE INDEX "work_author_role_role_type_id_idx" ON "work_author_role"("role_type_id");

-- CreateIndex
CREATE INDEX "work_author_role_is_primary_idx" ON "work_author_role"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "work_author_role_author_id_role_type_id_key" ON "work_author_role"("author_id", "role_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_author_name_key" ON "work_author"("name");

-- CreateIndex
CREATE INDEX "work_author_is_enabled_idx" ON "work_author"("is_enabled");

-- CreateIndex
CREATE INDEX "work_author_is_enabled_featured_idx" ON "work_author"("is_enabled", "featured");

-- CreateIndex
CREATE INDEX "work_author_is_enabled_deleted_at_idx" ON "work_author"("is_enabled", "deleted_at");

-- CreateIndex
CREATE INDEX "work_author_nationality_idx" ON "work_author"("nationality");

-- CreateIndex
CREATE INDEX "work_author_gender_idx" ON "work_author"("gender");

-- CreateIndex
CREATE INDEX "work_author_featured_works_count_idx" ON "work_author"("featured", "works_count" DESC);

-- CreateIndex
CREATE INDEX "work_author_created_at_idx" ON "work_author"("created_at");

-- CreateIndex
CREATE INDEX "work_author_deleted_at_idx" ON "work_author"("deleted_at");

-- CreateIndex
CREATE INDEX "work_comic_author_comic_id_idx" ON "work_comic_author"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_author_author_id_idx" ON "work_comic_author"("author_id");

-- CreateIndex
CREATE INDEX "work_comic_author_role_type_idx" ON "work_comic_author"("role_type");

-- CreateIndex
CREATE INDEX "work_comic_author_is_primary_idx" ON "work_comic_author"("is_primary");

-- CreateIndex
CREATE INDEX "work_comic_author_sort_order_idx" ON "work_comic_author"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_author_comic_id_author_id_key" ON "work_comic_author"("comic_id", "author_id");

-- CreateIndex
CREATE INDEX "work_comic_category_category_id_idx" ON "work_comic_category"("category_id");

-- CreateIndex
CREATE INDEX "work_comic_category_is_primary_idx" ON "work_comic_category"("is_primary");

-- CreateIndex
CREATE INDEX "work_comic_category_weight_idx" ON "work_comic_category"("weight");

-- CreateIndex
CREATE INDEX "work_comic_category_comic_id_weight_idx" ON "work_comic_category"("comic_id", "weight");

-- CreateIndex
CREATE INDEX "work_comic_category_category_id_is_primary_idx" ON "work_comic_category"("category_id", "is_primary");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comic_id_idx" ON "work_comic_chapter"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_version_id_idx" ON "work_comic_chapter"("version_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comic_id_version_id_idx" ON "work_comic_chapter"("comic_id", "version_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comic_id_chapter_number_idx" ON "work_comic_chapter"("comic_id", "chapter_number");

-- CreateIndex
CREATE INDEX "work_comic_chapter_version_id_chapter_number_idx" ON "work_comic_chapter"("version_id", "chapter_number");

-- CreateIndex
CREATE INDEX "work_comic_chapter_is_published_publish_at_idx" ON "work_comic_chapter"("is_published", "publish_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_read_rule_idx" ON "work_comic_chapter"("read_rule");

-- CreateIndex
CREATE INDEX "work_comic_chapter_is_preview_idx" ON "work_comic_chapter"("is_preview");

-- CreateIndex
CREATE INDEX "work_comic_chapter_view_count_idx" ON "work_comic_chapter"("view_count");

-- CreateIndex
CREATE INDEX "work_comic_chapter_like_count_idx" ON "work_comic_chapter"("like_count");

-- CreateIndex
CREATE INDEX "work_comic_chapter_created_at_idx" ON "work_comic_chapter"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_publish_at_idx" ON "work_comic_chapter"("publish_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_chapter_comic_id_version_id_chapter_number_key" ON "work_comic_chapter"("comic_id", "version_id", "chapter_number");

-- CreateIndex
CREATE INDEX "work_comic_version_comic_id_idx" ON "work_comic_version"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_version_language_idx" ON "work_comic_version"("language");

-- CreateIndex
CREATE INDEX "work_comic_version_is_published_publish_at_idx" ON "work_comic_version"("is_published", "publish_at");

-- CreateIndex
CREATE INDEX "work_comic_version_is_recommended_idx" ON "work_comic_version"("is_recommended");

-- CreateIndex
CREATE INDEX "work_comic_version_total_views_idx" ON "work_comic_version"("total_views");

-- CreateIndex
CREATE INDEX "work_comic_version_favorite_count_idx" ON "work_comic_version"("favorite_count");

-- CreateIndex
CREATE INDEX "work_comic_version_rating_rating_count_idx" ON "work_comic_version"("rating", "rating_count");

-- CreateIndex
CREATE INDEX "work_comic_version_last_updated_idx" ON "work_comic_version"("last_updated");

-- CreateIndex
CREATE INDEX "work_comic_version_sort_order_idx" ON "work_comic_version"("sort_order");

-- CreateIndex
CREATE INDEX "work_comic_version_translator_group_idx" ON "work_comic_version"("translator_group");

-- CreateIndex
CREATE INDEX "work_comic_version_created_at_idx" ON "work_comic_version"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_version_deleted_at_idx" ON "work_comic_version"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_version_comic_id_language_versionName_key" ON "work_comic_version"("comic_id", "language", "versionName");

-- CreateIndex
CREATE INDEX "work_comic_is_published_publish_at_idx" ON "work_comic"("is_published", "publish_at");

-- CreateIndex
CREATE INDEX "work_comic_popularity_popularity_weight_idx" ON "work_comic"("popularity", "popularity_weight");

-- CreateIndex
CREATE INDEX "work_comic_language_region_idx" ON "work_comic"("language", "region");

-- CreateIndex
CREATE INDEX "work_comic_serial_status_idx" ON "work_comic"("serial_status");

-- CreateIndex
CREATE INDEX "work_comic_read_rule_idx" ON "work_comic"("read_rule");

-- CreateIndex
CREATE INDEX "work_comic_last_updated_idx" ON "work_comic"("last_updated");

-- CreateIndex
CREATE INDEX "work_comic_name_idx" ON "work_comic"("name");

-- CreateIndex
CREATE INDEX "work_comic_age_rating_idx" ON "work_comic"("age_rating");

-- CreateIndex
CREATE INDEX "work_comic_rating_rating_count_idx" ON "work_comic"("rating", "rating_count");

-- CreateIndex
CREATE INDEX "work_comic_total_views_idx" ON "work_comic"("total_views");

-- CreateIndex
CREATE INDEX "work_comic_favorite_count_idx" ON "work_comic"("favorite_count");

-- CreateIndex
CREATE INDEX "work_comic_is_recommended_idx" ON "work_comic"("is_recommended");

-- CreateIndex
CREATE INDEX "work_comic_is_hot_is_new_idx" ON "work_comic"("is_hot", "is_new");

-- CreateIndex
CREATE INDEX "work_comic_is_published_is_recommended_idx" ON "work_comic"("is_published", "is_recommended");

-- CreateIndex
CREATE INDEX "work_comic_is_published_serial_status_last_updated_idx" ON "work_comic"("is_published", "serial_status", "last_updated");

-- CreateIndex
CREATE INDEX "work_comic_created_at_idx" ON "work_comic"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_deleted_at_idx" ON "work_comic"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_category_name_key" ON "work_category"("name");

-- CreateIndex
CREATE INDEX "work_category_order_idx" ON "work_category"("order");

-- CreateIndex
CREATE INDEX "work_category_name_idx" ON "work_category"("name");

-- CreateIndex
CREATE INDEX "work_category_content_type_content_type_id_idx" ON "work_category_content_type"("content_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_content_type_code_key" ON "work_content_type"("code");

-- CreateIndex
CREATE INDEX "work_content_type_is_enabled_idx" ON "work_content_type"("is_enabled");

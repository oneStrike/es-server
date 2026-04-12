CREATE TABLE "app_update_release" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "platform" varchar(20) NOT NULL,
  "version_name" varchar(50) NOT NULL,
  "build_code" integer NOT NULL,
  "release_notes" varchar(5000),
  "force_update" boolean DEFAULT false NOT NULL,
  "package_source_type" varchar(20),
  "package_url" varchar(1000),
  "package_original_name" varchar(255),
  "package_file_size" integer,
  "package_mime_type" varchar(100),
  "custom_download_url" varchar(1000),
  "is_published" boolean DEFAULT false NOT NULL,
  "published_at" timestamp (6) with time zone,
  "created_by_id" integer,
  "updated_by_id" integer,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL,
  CONSTRAINT "app_update_release_build_code_positive_chk" CHECK ("build_code" > 0)
);

CREATE TABLE "app_update_store_link" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "release_id" integer NOT NULL,
  "channel_code" varchar(50) NOT NULL,
  "channel_name" varchar(50) NOT NULL,
  "store_url" varchar(1000) NOT NULL,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL
);

ALTER TABLE "app_update_store_link"
ADD CONSTRAINT "app_update_store_link_release_id_fkey"
FOREIGN KEY ("release_id") REFERENCES "app_update_release"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "app_update_release_platform_build_code_key"
ON "app_update_release" ("platform", "build_code");

CREATE INDEX "app_update_release_platform_is_published_build_code_idx"
ON "app_update_release" ("platform", "is_published", "build_code");

CREATE INDEX "app_update_release_published_at_idx"
ON "app_update_release" ("published_at");

CREATE UNIQUE INDEX "app_update_store_link_release_id_channel_code_key"
ON "app_update_store_link" ("release_id", "channel_code");

CREATE INDEX "app_update_store_link_release_id_idx"
ON "app_update_store_link" ("release_id");

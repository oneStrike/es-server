CREATE TABLE "work_third_party_chapter_binding" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_third_party_chapter_binding_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_third_party_source_binding_id" integer NOT NULL,
	"chapter_id" integer NOT NULL,
	"provider_chapter_id" varchar(100) NOT NULL,
	"remote_sort_order" integer,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "work_third_party_chapter_binding_provider_chapter_id_nonblank_chk" CHECK (length(trim("provider_chapter_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "work_third_party_source_binding" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_third_party_source_binding_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_id" integer NOT NULL,
	"platform" varchar(30) NOT NULL,
	"provider_comic_id" varchar(100) NOT NULL,
	"provider_path_word" varchar(100) NOT NULL,
	"provider_group_path_word" varchar(100) NOT NULL,
	"provider_uuid" varchar(100),
	"source_snapshot" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "work_third_party_source_binding_platform_nonblank_chk" CHECK (length(trim("platform")) > 0),
	CONSTRAINT "work_third_party_source_binding_provider_comic_id_nonblank_chk" CHECK (length(trim("provider_comic_id")) > 0),
	CONSTRAINT "work_third_party_source_binding_provider_path_word_nonblank_chk" CHECK (length(trim("provider_path_word")) > 0),
	CONSTRAINT "work_third_party_source_binding_provider_group_path_word_nonblank_chk" CHECK (length(trim("provider_group_path_word")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "work_third_party_chapter_binding_source_provider_chapter_live_idx" ON "work_third_party_chapter_binding" ("work_third_party_source_binding_id","provider_chapter_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_third_party_chapter_binding_chapter_id_live_idx" ON "work_third_party_chapter_binding" ("chapter_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_third_party_chapter_binding_source_created_at_idx" ON "work_third_party_chapter_binding" ("work_third_party_source_binding_id","created_at");--> statement-breakpoint
CREATE INDEX "work_third_party_chapter_binding_deleted_at_idx" ON "work_third_party_chapter_binding" ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_third_party_source_binding_work_id_live_idx" ON "work_third_party_source_binding" ("work_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_third_party_source_binding_platform_comic_group_live_idx" ON "work_third_party_source_binding" ("platform","provider_comic_id","provider_group_path_word") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_third_party_source_binding_platform_path_group_idx" ON "work_third_party_source_binding" ("platform","provider_path_word","provider_group_path_word");--> statement-breakpoint
CREATE INDEX "work_third_party_source_binding_deleted_at_idx" ON "work_third_party_source_binding" ("deleted_at");
CREATE TABLE "emoji_asset" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "emoji_asset_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pack_id" integer NOT NULL,
	"kind" smallint NOT NULL,
	"shortcode" varchar(32),
	"unicode_sequence" varchar(191),
	"image_url" varchar(500),
	"static_url" varchar(500),
	"is_animated" boolean DEFAULT false NOT NULL,
	"category" varchar(32),
	"keywords" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "emoji_asset_kind_chk" CHECK ("kind" in (1, 2)),
	CONSTRAINT "emoji_asset_kind_unicode_required_chk" CHECK (("kind" <> 1) or ("unicode_sequence" is not null)),
	CONSTRAINT "emoji_asset_kind_custom_required_chk" CHECK (("kind" <> 2) or ("shortcode" is not null and "image_url" is not null)),
	CONSTRAINT "emoji_asset_shortcode_format_chk" CHECK ("shortcode" is null or "shortcode" ~ '^[a-z0-9_]{2,32}$')
);
--> statement-breakpoint
CREATE TABLE "emoji_pack" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "emoji_pack_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL CONSTRAINT "emoji_pack_code_key" UNIQUE,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"icon_url" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"visible_in_picker" boolean DEFAULT true NOT NULL,
	"scene_type" smallint[] DEFAULT ARRAY[1,2,3]::smallint[] NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "emoji_pack_scene_type_valid_chk" CHECK ("scene_type" <@ ARRAY[1,2,3]::smallint[]),
	CONSTRAINT "emoji_pack_scene_type_non_empty_chk" CHECK (cardinality("scene_type") > 0)
);
--> statement-breakpoint
CREATE TABLE "emoji_recent_usage" (
	"user_id" integer,
	"scene" smallint,
	"emoji_asset_id" integer,
	"use_count" integer DEFAULT 1 NOT NULL,
	"last_used_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "emoji_recent_usage_pkey" PRIMARY KEY("user_id","scene","emoji_asset_id"),
	CONSTRAINT "emoji_recent_usage_scene_chk" CHECK ("scene" in (1, 2, 3)),
	CONSTRAINT "emoji_recent_usage_use_count_chk" CHECK ("use_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "emoji_asset_pack_id_sort_order_idx" ON "emoji_asset" ("pack_id","sort_order");--> statement-breakpoint
CREATE INDEX "emoji_asset_pack_id_is_enabled_deleted_at_sort_order_idx" ON "emoji_asset" ("pack_id","is_enabled","deleted_at","sort_order");--> statement-breakpoint
CREATE INDEX "emoji_asset_kind_idx" ON "emoji_asset" ("kind");--> statement-breakpoint
CREATE INDEX "emoji_asset_category_idx" ON "emoji_asset" ("category");--> statement-breakpoint
CREATE INDEX "emoji_asset_deleted_at_idx" ON "emoji_asset" ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "emoji_asset_shortcode_live_key" ON "emoji_asset" ("shortcode") WHERE "shortcode" is not null and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "emoji_pack_is_enabled_idx" ON "emoji_pack" ("is_enabled");--> statement-breakpoint
CREATE INDEX "emoji_pack_sort_order_idx" ON "emoji_pack" ("sort_order");--> statement-breakpoint
CREATE INDEX "emoji_pack_deleted_at_idx" ON "emoji_pack" ("deleted_at");--> statement-breakpoint
CREATE INDEX "emoji_pack_scene_type_idx" ON "emoji_pack" USING gin ("scene_type");--> statement-breakpoint
CREATE INDEX "emoji_pack_is_enabled_deleted_at_idx" ON "emoji_pack" ("is_enabled","deleted_at");--> statement-breakpoint
CREATE INDEX "emoji_pack_is_enabled_deleted_at_sort_order_idx" ON "emoji_pack" ("is_enabled","deleted_at","sort_order");--> statement-breakpoint
CREATE INDEX "emoji_recent_usage_user_id_scene_last_used_at_idx" ON "emoji_recent_usage" ("user_id","scene","last_used_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "emoji_recent_usage_emoji_asset_id_idx" ON "emoji_recent_usage" ("emoji_asset_id");
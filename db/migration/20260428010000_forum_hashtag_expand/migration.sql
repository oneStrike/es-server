ALTER TABLE "app_user_count"
  ADD COLUMN "following_hashtag_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "user_follow"
  ADD CONSTRAINT "user_follow_target_type_valid_chk"
  CHECK ("target_type" in (1, 2, 3, 4));

CREATE TABLE "forum_hashtag" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "slug" varchar(64) NOT NULL,
  "display_name" varchar(64) NOT NULL,
  "description" varchar(200),
  "manual_boost" smallint DEFAULT 0 NOT NULL,
  "audit_status" smallint DEFAULT 0 NOT NULL,
  "is_hidden" boolean DEFAULT false NOT NULL,
  "audit_by_id" integer,
  "audit_role" smallint,
  "audit_reason" varchar(500),
  "audit_at" timestamp(6) with time zone,
  "create_source_type" smallint NOT NULL,
  "created_by_user_id" integer,
  "sensitive_word_hits" jsonb,
  "topic_ref_count" integer DEFAULT 0 NOT NULL,
  "comment_ref_count" integer DEFAULT 0 NOT NULL,
  "follower_count" integer DEFAULT 0 NOT NULL,
  "last_referenced_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "deleted_at" timestamp(6) with time zone
);

ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_slug_key" UNIQUE ("slug");
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_audit_status_valid_chk"
  CHECK ("audit_status" in (0, 1, 2));
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_create_source_type_valid_chk"
  CHECK ("create_source_type" in (1, 2, 3));
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_manual_boost_non_negative_chk"
  CHECK ("manual_boost" >= 0);
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_topic_ref_count_non_negative_chk"
  CHECK ("topic_ref_count" >= 0);
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_comment_ref_count_non_negative_chk"
  CHECK ("comment_ref_count" >= 0);
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_follower_count_non_negative_chk"
  CHECK ("follower_count" >= 0);

CREATE INDEX "forum_hashtag_audit_hidden_last_ref_idx"
  ON "forum_hashtag" ("audit_status", "is_hidden", "last_referenced_at");
CREATE INDEX "forum_hashtag_follower_last_ref_idx"
  ON "forum_hashtag" ("follower_count", "last_referenced_at");
CREATE INDEX "forum_hashtag_created_at_idx"
  ON "forum_hashtag" ("created_at");
CREATE INDEX "forum_hashtag_deleted_at_idx"
  ON "forum_hashtag" ("deleted_at");

CREATE TABLE "forum_hashtag_reference" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "hashtag_id" integer NOT NULL,
  "source_type" smallint NOT NULL,
  "source_id" integer NOT NULL,
  "topic_id" integer NOT NULL,
  "section_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "occurrence_count" smallint DEFAULT 1 NOT NULL,
  "source_audit_status" smallint NOT NULL,
  "source_is_hidden" boolean DEFAULT false NOT NULL,
  "is_source_visible" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "forum_hashtag_reference"
  ADD CONSTRAINT "forum_hashtag_reference_unique_key"
  UNIQUE ("hashtag_id", "source_type", "source_id");
ALTER TABLE "forum_hashtag_reference"
  ADD CONSTRAINT "forum_hashtag_reference_source_type_valid_chk"
  CHECK ("source_type" in (1, 2));
ALTER TABLE "forum_hashtag_reference"
  ADD CONSTRAINT "forum_hashtag_reference_source_audit_status_valid_chk"
  CHECK ("source_audit_status" in (0, 1, 2));
ALTER TABLE "forum_hashtag_reference"
  ADD CONSTRAINT "forum_hashtag_reference_occurrence_count_positive_chk"
  CHECK ("occurrence_count" > 0);

CREATE INDEX "forum_hashtag_reference_hashtag_visible_created_idx"
  ON "forum_hashtag_reference" ("hashtag_id", "is_source_visible", "created_at");
CREATE INDEX "forum_hashtag_reference_source_idx"
  ON "forum_hashtag_reference" ("source_type", "source_id");
CREATE INDEX "forum_hashtag_reference_topic_created_idx"
  ON "forum_hashtag_reference" ("topic_id", "created_at");
CREATE INDEX "forum_hashtag_reference_section_created_idx"
  ON "forum_hashtag_reference" ("section_id", "created_at");

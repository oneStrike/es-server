ALTER TABLE "forum_topic"
ADD COLUMN "body" jsonb;
--> statement-breakpoint
ALTER TABLE "forum_topic"
ADD COLUMN "body_version" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "forum_topic"
SET "body" = jsonb_build_object(
  'type',
  'doc',
  'content',
  jsonb_build_array(
    jsonb_build_object(
      'type',
      'paragraph',
      'content',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'text',
          'text',
          COALESCE("content", '')
        )
      )
    )
  )
)
WHERE "body" IS NULL;
--> statement-breakpoint
ALTER TABLE "forum_topic"
ADD CONSTRAINT "forum_topic_body_version_valid_chk"
CHECK ("body_version" in (1));
--> statement-breakpoint
ALTER TABLE "user_comment"
ADD COLUMN "body" jsonb;
--> statement-breakpoint
ALTER TABLE "user_comment"
ADD COLUMN "body_version" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "user_comment"
SET "body" = jsonb_build_object(
  'type',
  'doc',
  'content',
  jsonb_build_array(
    jsonb_build_object(
      'type',
      'paragraph',
      'content',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'text',
          'text',
          COALESCE("content", '')
        )
      )
    )
  )
)
WHERE "body" IS NULL;
--> statement-breakpoint
CREATE INDEX "user_comment_body_version_idx"
ON "user_comment" USING btree ("body_version");
--> statement-breakpoint
ALTER TABLE "user_comment"
ADD CONSTRAINT "user_comment_body_version_valid_chk"
CHECK ("body_version" in (1));

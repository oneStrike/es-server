-- Hand-written guard: Drizzle cannot express safe legacy text JSON parsing,
-- audit preservation, and pre-drop normalization in schema-generated DDL.
-- Scope: only non-blank comic work_chapter.content values that are not JSON
-- arrays. Risk: audited values leave the runtime content column after they are
-- preserved in this migration-owned table.
CREATE TABLE IF NOT EXISTS "work_chapter_content_breaking_audit" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "work_chapter_id" integer NOT NULL,
  "work_id" integer NOT NULL,
  "work_type" smallint NOT NULL,
  "old_content" text NOT NULL,
  "old_description" varchar(1000),
  "audit_reason" varchar(64) NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_chapter_content_breaking_audit_chapter_reason_key"
    UNIQUE ("work_chapter_id", "audit_reason"),
  CONSTRAINT "work_chapter_content_breaking_audit_work_type_chk"
    CHECK ("work_type" = 1),
  CONSTRAINT "work_chapter_content_breaking_audit_reason_chk"
    CHECK ("audit_reason" IN ('comic_content_not_json_array'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_chapter_content_breaking_audit_work_id_idx"
  ON "work_chapter_content_breaking_audit" ("work_id", "work_chapter_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "__work_chapter_content_breaking_is_json_array"(
  raw_content text
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF raw_content IS NULL OR btrim(raw_content) = '' THEN
    RETURN true;
  END IF;

  IF left(btrim(raw_content), 1) <> '[' THEN
    RETURN false;
  END IF;

  BEGIN
    parsed := raw_content::jsonb;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN jsonb_typeof(parsed) = 'array';
END $$;
--> statement-breakpoint
DO $$
DECLARE
  has_content_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'work_chapter'
      AND column_name = 'content'
  )
    INTO has_content_column;

  IF has_content_column THEN
    EXECUTE $audit$
      INSERT INTO "work_chapter_content_breaking_audit" (
        "work_chapter_id",
        "work_id",
        "work_type",
        "old_content",
        "old_description",
        "audit_reason"
      )
      SELECT
        "id",
        "work_id",
        "work_type",
        "content",
        "description",
        'comic_content_not_json_array'
      FROM "work_chapter"
      WHERE "work_type" = 1
        AND "content" IS NOT NULL
        AND btrim("content") <> ''
        AND "__work_chapter_content_breaking_is_json_array"("content") = false
      ON CONFLICT ("work_chapter_id", "audit_reason") DO NOTHING
    $audit$;

    EXECUTE $normalize$
      UPDATE "work_chapter"
      SET "content" = NULL
      WHERE "work_type" = 1
        AND "content" IS NOT NULL
        AND btrim("content") <> ''
        AND "__work_chapter_content_breaking_is_json_array"("content") = false
    $normalize$;
  END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS "__work_chapter_content_breaking_is_json_array"(text);

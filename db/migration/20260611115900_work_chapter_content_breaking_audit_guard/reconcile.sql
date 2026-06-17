CREATE TEMP TABLE IF NOT EXISTS "__work_chapter_content_breaking_reconcile" (
  "indicator" varchar(64) NOT NULL,
  "value" bigint NOT NULL
) ON COMMIT DROP;

TRUNCATE TABLE "__work_chapter_content_breaking_reconcile";

CREATE OR REPLACE FUNCTION "__work_chapter_content_breaking_reconcile_is_json_array"(
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
    EXECUTE $sql$
      INSERT INTO "__work_chapter_content_breaking_reconcile" (
        "indicator",
        "value"
      )
      SELECT
        'invalid_comic_content_count',
        count(*)
      FROM "work_chapter"
      WHERE "work_type" = 1
        AND "content" IS NOT NULL
        AND btrim("content") <> ''
        AND "__work_chapter_content_breaking_reconcile_is_json_array"("content") = false
    $sql$;
  ELSE
    INSERT INTO "__work_chapter_content_breaking_reconcile" (
      "indicator",
      "value"
    )
    VALUES ('invalid_comic_content_count', 0);
  END IF;
END $$;

DROP FUNCTION IF EXISTS "__work_chapter_content_breaking_reconcile_is_json_array"(text);

SELECT "indicator", "value"
FROM "__work_chapter_content_breaking_reconcile"
ORDER BY "indicator";

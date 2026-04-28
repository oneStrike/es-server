DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM forum_section
    WHERE deleted_at IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create forum_section_name_live_key: duplicate live forum_section.name values exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "forum_section_name_live_key"
  ON "forum_section" ("name")
  WHERE "deleted_at" IS NULL;

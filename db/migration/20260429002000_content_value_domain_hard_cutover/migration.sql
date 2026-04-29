UPDATE "work_author"
SET "gender" = 0
WHERE "gender" NOT IN (0, 1, 2, 3, 4);

UPDATE "work_author"
SET "type" = normalized."type"
FROM (
  SELECT
    "id",
    CASE
      WHEN COUNT(item.value) = 0 THEN NULL
      ELSE array_agg(item.value::smallint ORDER BY item.ord)
    END AS "type"
  FROM "work_author"
  LEFT JOIN LATERAL unnest("type") WITH ORDINALITY AS item(value, ord)
    ON item.value IN (1, 2)
  GROUP BY "id"
) AS normalized
WHERE "work_author"."id" = normalized."id"
  AND "work_author"."type" IS NOT NULL;

UPDATE "work_category"
SET "content_type" = normalized."content_type"
FROM (
  SELECT
    "id",
    CASE
      WHEN COUNT(item.value) = 0 THEN NULL
      ELSE array_agg(item.value::smallint ORDER BY item.ord)
    END AS "content_type"
  FROM "work_category"
  LEFT JOIN LATERAL unnest("content_type") WITH ORDINALITY AS item(value, ord)
    ON item.value IN (1, 2, 3)
  GROUP BY "id"
) AS normalized
WHERE "work_category"."id" = normalized."id"
  AND "work_category"."content_type" IS NOT NULL;

UPDATE "work"
SET "type" = 1
WHERE "type" NOT IN (1, 2);

UPDATE "work"
SET "serial_status" = 0
WHERE "serial_status" NOT IN (0, 1, 2, 3, 4);

UPDATE "work"
SET "view_rule" = 0
WHERE "view_rule" NOT IN (0, 1, 2, 3);

UPDATE "work_chapter"
SET "work_type" = 1
WHERE "work_type" NOT IN (1, 2);

UPDATE "work_chapter"
SET "view_rule" = -1
WHERE "view_rule" NOT IN (-1, 0, 1, 2, 3);

ALTER TABLE "work_author"
  ADD CONSTRAINT "work_author_gender_valid_chk" CHECK ("gender" in (0, 1, 2, 3, 4)),
  ADD CONSTRAINT "work_author_type_valid_chk" CHECK ("type" is null or "type" <@ '{1,2}'::smallint[]);

ALTER TABLE "work_category"
  ADD CONSTRAINT "work_category_content_type_valid_chk" CHECK ("content_type" is null or "content_type" <@ '{1,2,3}'::smallint[]);

ALTER TABLE "work"
  ADD CONSTRAINT "work_type_valid_chk" CHECK ("type" in (1, 2)),
  ADD CONSTRAINT "work_serial_status_valid_chk" CHECK ("serial_status" in (0, 1, 2, 3, 4)),
  ADD CONSTRAINT "work_view_rule_valid_chk" CHECK ("view_rule" in (0, 1, 2, 3));

ALTER TABLE "work_chapter"
  ADD CONSTRAINT "work_chapter_work_type_valid_chk" CHECK ("work_type" in (1, 2)),
  ADD CONSTRAINT "work_chapter_view_rule_valid_chk" CHECK ("view_rule" in (-1, 0, 1, 2, 3));

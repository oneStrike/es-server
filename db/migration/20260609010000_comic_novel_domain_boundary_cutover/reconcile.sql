WITH chapter_type_mismatch AS (
  SELECT wc.id, wc.work_id, wc.work_type, w.type AS work_type_actual
  FROM work_chapter wc
  JOIN work w ON w.id = wc.work_id
  WHERE wc.deleted_at IS NULL
    AND w.deleted_at IS NULL
    AND wc.work_type <> w.type
),
orphan_chapter AS (
  SELECT wc.id, wc.work_id, wc.work_type
  FROM work_chapter wc
  LEFT JOIN work w
    ON w.id = wc.work_id
   AND w.deleted_at IS NULL
  WHERE wc.deleted_at IS NULL
    AND w.id IS NULL
),
content_shape_review_required AS (
  SELECT wc.id, wc.work_id, wc.work_type
  FROM work_chapter wc
  WHERE wc.deleted_at IS NULL
    AND wc.content IS NOT NULL
    AND (
      (wc.work_type = 1 AND left(ltrim(wc.content), 1) <> '[')
      OR (wc.work_type = 2 AND left(ltrim(wc.content), 1) = '[')
    )
)
SELECT
  (SELECT count(*) FROM chapter_type_mismatch) AS chapter_type_mismatch_count,
  (SELECT count(*) FROM orphan_chapter) AS orphan_chapter_count,
  (SELECT count(*) FROM content_shape_review_required) AS content_shape_review_required_count;

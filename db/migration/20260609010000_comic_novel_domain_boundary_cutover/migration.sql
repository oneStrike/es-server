DO $$
DECLARE
  chapter_type_mismatch_count bigint;
  orphan_chapter_count bigint;
BEGIN
  SELECT count(*)
    INTO chapter_type_mismatch_count
  FROM work_chapter wc
  JOIN work w ON w.id = wc.work_id
  WHERE wc.deleted_at IS NULL
    AND w.deleted_at IS NULL
    AND wc.work_type <> w.type;

  SELECT count(*)
    INTO orphan_chapter_count
  FROM work_chapter wc
  LEFT JOIN work w
    ON w.id = wc.work_id
   AND w.deleted_at IS NULL
  WHERE wc.deleted_at IS NULL
    AND w.id IS NULL;

  IF chapter_type_mismatch_count <> 0 OR orphan_chapter_count <> 0 THEN
    RAISE EXCEPTION
      'comic/novel domain boundary cutover blocked: chapter_type_mismatch_count=%, orphan_chapter_count=%',
      chapter_type_mismatch_count,
      orphan_chapter_count;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_work_chapter_domain_boundary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM work w
    WHERE w.id = NEW.work_id
      AND w.type = NEW.work_type
      AND w.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'work_chapter domain boundary violation: chapter_id=%, work_id=%, work_type=%',
      NEW.id,
      NEW.work_id,
      NEW.work_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_chapter_domain_boundary_trg ON work_chapter;

CREATE TRIGGER work_chapter_domain_boundary_trg
BEFORE INSERT OR UPDATE OF work_id, work_type, deleted_at
ON work_chapter
FOR EACH ROW
EXECUTE FUNCTION enforce_work_chapter_domain_boundary();

CREATE OR REPLACE FUNCTION enforce_work_domain_boundary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  live_chapter_count bigint;
BEGIN
  IF NEW.type <> OLD.type THEN
    RAISE EXCEPTION
      'work type cannot change after creation: work_id=%',
      OLD.id;
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    SELECT count(*)
      INTO live_chapter_count
    FROM work_chapter wc
    WHERE wc.work_id = OLD.id
      AND wc.deleted_at IS NULL;

    IF live_chapter_count <> 0 THEN
      RAISE EXCEPTION
        'work cannot be deleted while live chapters exist: work_id=%, live_chapter_count=%',
        OLD.id,
        live_chapter_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_domain_boundary_trg ON work;

CREATE TRIGGER work_domain_boundary_trg
BEFORE UPDATE OF type, deleted_at
ON work
FOR EACH ROW
EXECUTE FUNCTION enforce_work_domain_boundary();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM work_author
    WHERE deleted_at IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'work_author has duplicate active names; merge or soft-delete duplicates before migrating';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM work_author_relation relation
    LEFT JOIN work ON work.id = relation.work_id
    WHERE work.id IS NULL
  ) THEN
    RAISE EXCEPTION 'work_author_relation has orphan work_id rows; repair relations before migrating';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM work_author_relation relation
    LEFT JOIN work_author author ON author.id = relation.author_id
    WHERE author.id IS NULL
  ) THEN
    RAISE EXCEPTION 'work_author_relation has orphan author_id rows; repair relations before migrating';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM work_author_relation relation
    INNER JOIN work ON work.id = relation.work_id
    INNER JOIN work_author author ON author.id = relation.author_id
    WHERE work.deleted_at IS NULL
      AND author.deleted_at IS NULL
      AND (
        (work.type = 1 AND NOT (author.type @> ARRAY[1]::smallint[]))
        OR (work.type = 2 AND NOT (author.type @> ARRAY[2]::smallint[]))
      )
  ) THEN
    RAISE EXCEPTION 'work_author_relation contains author role mismatches; repair comic/novel author assignments before migrating';
  END IF;
END $$;

ALTER TABLE work_author
  DROP CONSTRAINT IF EXISTS work_author_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS work_author_active_name_key
  ON work_author (name)
  WHERE deleted_at IS NULL;

ALTER TABLE work_author_relation
  ADD CONSTRAINT work_author_relation_work_id_fkey
  FOREIGN KEY (work_id)
  REFERENCES work(id)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT;

ALTER TABLE work_author_relation
  ADD CONSTRAINT work_author_relation_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES work_author(id)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT;

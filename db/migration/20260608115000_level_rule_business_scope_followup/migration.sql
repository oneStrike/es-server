DO $$
DECLARE
  duplicate_threshold_count integer;
BEGIN
  SELECT count(*)
  INTO duplicate_threshold_count
  FROM (
    SELECT NULLIF(btrim(COALESCE(business, '')), '') AS normalized_business,
      required_experience
    FROM user_level_rule
    WHERE is_enabled = true
    GROUP BY NULLIF(btrim(COALESCE(business, '')), ''), required_experience
    HAVING count(*) > 1
  ) AS duplicate_threshold;

  IF duplicate_threshold_count > 0 THEN
    RAISE EXCEPTION 'user_level_rule normalized business domains contain duplicate enabled required_experience thresholds';
  END IF;
END;
$$;

UPDATE user_level_rule
SET business = NULL,
  updated_at = now()
WHERE business IS NOT NULL
  AND btrim(business) = '';

DROP INDEX IF EXISTS user_like_user_id_target_type_created_at_idx;
DROP INDEX IF EXISTS user_favorite_user_id_target_type_created_at_idx;

CREATE INDEX IF NOT EXISTS user_like_user_id_created_at_idx
  ON user_like (user_id, created_at);

CREATE INDEX IF NOT EXISTS user_favorite_user_id_created_at_idx
  ON user_favorite (user_id, created_at);

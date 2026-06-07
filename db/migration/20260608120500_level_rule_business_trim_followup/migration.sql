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
SET business = NULLIF(btrim(business), ''),
  updated_at = now()
WHERE business IS DISTINCT FROM NULLIF(btrim(business), '');

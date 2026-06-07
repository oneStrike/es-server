DO $$
DECLARE
  invalid_base_count integer;
  duplicate_threshold_count integer;
BEGIN
  SELECT count(*)
  INTO invalid_base_count
  FROM (
    SELECT COALESCE(business, '') AS business_key
    FROM user_level_rule
    WHERE is_enabled = true
    GROUP BY COALESCE(business, '')
    HAVING count(*) FILTER (WHERE required_experience = 0) <> 1
  ) AS invalid_base;

  IF invalid_base_count > 0 THEN
    RAISE EXCEPTION 'user_level_rule enabled business domains must have exactly one base level';
  END IF;

  SELECT count(*)
  INTO duplicate_threshold_count
  FROM (
    SELECT COALESCE(business, '') AS business_key, required_experience
    FROM user_level_rule
    WHERE is_enabled = true
    GROUP BY COALESCE(business, ''), required_experience
    HAVING count(*) > 1
  ) AS duplicate_threshold;

  IF duplicate_threshold_count > 0 THEN
    RAISE EXCEPTION 'user_level_rule enabled business domains contain duplicate required_experience thresholds';
  END IF;
END;
$$;

ALTER TABLE user_level_rule
  DROP CONSTRAINT IF EXISTS user_level_rule_login_days_non_negative_chk,
  DROP CONSTRAINT IF EXISTS user_level_rule_blacklist_limit_non_negative_chk,
  DROP CONSTRAINT IF EXISTS user_level_rule_work_collection_limit_non_negative_chk;

ALTER TABLE user_level_rule
  DROP COLUMN IF EXISTS login_days,
  DROP COLUMN IF EXISTS blacklist_limit,
  DROP COLUMN IF EXISTS work_collection_limit;

DROP INDEX IF EXISTS user_level_rule_enabled_business_exp_unique_idx;
DROP INDEX IF EXISTS user_level_rule_enabled_business_base_unique_idx;
DROP INDEX IF EXISTS user_level_rule_business_enabled_exp_id_idx;
DROP INDEX IF EXISTS user_like_user_id_target_type_created_at_idx;
DROP INDEX IF EXISTS user_favorite_user_id_target_type_created_at_idx;

CREATE UNIQUE INDEX user_level_rule_enabled_business_exp_unique_idx
  ON user_level_rule (COALESCE(business, ''), required_experience)
  WHERE is_enabled = true;

CREATE UNIQUE INDEX user_level_rule_enabled_business_base_unique_idx
  ON user_level_rule (COALESCE(business, ''))
  WHERE is_enabled = true AND required_experience = 0;

CREATE INDEX user_level_rule_business_enabled_exp_id_idx
  ON user_level_rule (business, is_enabled, required_experience DESC, id DESC);

CREATE INDEX user_like_user_id_target_type_created_at_idx
  ON user_like (user_id, target_type, created_at);

CREATE INDEX user_favorite_user_id_target_type_created_at_idx
  ON user_favorite (user_id, target_type, created_at);

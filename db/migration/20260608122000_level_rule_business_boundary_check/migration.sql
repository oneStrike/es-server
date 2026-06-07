UPDATE user_level_rule
SET business = NULLIF(btrim(business), ''),
  updated_at = now()
WHERE business IS DISTINCT FROM NULLIF(btrim(business), '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_level_rule_business_trimmed_not_blank_chk'
      AND conrelid = 'user_level_rule'::regclass
  ) THEN
    ALTER TABLE user_level_rule
      ADD CONSTRAINT user_level_rule_business_trimmed_not_blank_chk
      CHECK (
        business IS NULL
        OR (business = btrim(business) AND business <> '')
      );
  END IF;
END;
$$;

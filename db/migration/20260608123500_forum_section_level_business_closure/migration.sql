UPDATE forum_section
SET user_level_rule_id = NULL,
  updated_at = now()
WHERE user_level_rule_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_level_rule
    WHERE user_level_rule.id = forum_section.user_level_rule_id
      AND user_level_rule.business = 'forum'
  );

CREATE OR REPLACE FUNCTION forum_section_level_rule_business_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_level_rule_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM user_level_rule
    WHERE id = NEW.user_level_rule_id
      AND business = 'forum'
  ) THEN
    RAISE EXCEPTION 'forum_section.user_level_rule_id must reference a forum business level rule';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_section_level_rule_business_guard_trg ON forum_section;

CREATE TRIGGER forum_section_level_rule_business_guard_trg
BEFORE INSERT OR UPDATE OF user_level_rule_id
ON forum_section
FOR EACH ROW
EXECUTE FUNCTION forum_section_level_rule_business_guard();

CREATE OR REPLACE FUNCTION user_level_rule_forum_reference_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM forum_section
      WHERE user_level_rule_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'cannot delete user_level_rule referenced by forum_section';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.business = 'forum'
    AND NEW.business IS DISTINCT FROM 'forum'
    AND EXISTS (
      SELECT 1
      FROM forum_section
      WHERE user_level_rule_id = OLD.id
    ) THEN
    RAISE EXCEPTION 'cannot move forum-referenced user_level_rule out of forum business';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_level_rule_forum_reference_update_guard_trg ON user_level_rule;
DROP TRIGGER IF EXISTS user_level_rule_forum_reference_delete_guard_trg ON user_level_rule;

CREATE TRIGGER user_level_rule_forum_reference_update_guard_trg
BEFORE UPDATE OF business
ON user_level_rule
FOR EACH ROW
EXECUTE FUNCTION user_level_rule_forum_reference_guard();

CREATE TRIGGER user_level_rule_forum_reference_delete_guard_trg
BEFORE DELETE
ON user_level_rule
FOR EACH ROW
EXECUTE FUNCTION user_level_rule_forum_reference_guard();

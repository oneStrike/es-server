UPDATE "forum_section"
SET "topic_review_policy" = 1
WHERE "topic_review_policy" NOT IN (0, 1, 2, 3, 4);

ALTER TABLE "forum_section"
  ALTER COLUMN "topic_review_policy" TYPE smallint
  USING "topic_review_policy"::smallint;

ALTER TABLE "forum_section"
  DROP CONSTRAINT IF EXISTS "forum_section_topic_review_policy_valid_chk";

ALTER TABLE "forum_section"
  ADD CONSTRAINT "forum_section_topic_review_policy_valid_chk"
  CHECK ("topic_review_policy" in (0, 1, 2, 3, 4));

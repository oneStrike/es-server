ALTER TABLE "work" DROP CONSTRAINT IF EXISTS "work_rating_count_non_negative_chk";
ALTER TABLE "work" DROP COLUMN IF EXISTS "ratingCount";

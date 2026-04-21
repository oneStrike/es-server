-- 敏感词词表不再保留未使用的 version 字段；
-- 同时收紧 level/type 闭集约束前先归一化历史坏值。
ALTER TABLE "sensitive_word"
  DROP COLUMN IF EXISTS "version";

UPDATE "sensitive_word"
SET "level" = 2
WHERE "level" NOT IN (1, 2, 3);

UPDATE "sensitive_word"
SET "type" = 5
WHERE "type" NOT IN (1, 2, 3, 4, 5);

ALTER TABLE "sensitive_word"
  DROP CONSTRAINT IF EXISTS "sensitive_word_level_valid_chk";

ALTER TABLE "sensitive_word"
  ADD CONSTRAINT "sensitive_word_level_valid_chk"
  CHECK ("level" in (1, 2, 3));

ALTER TABLE "sensitive_word"
  DROP CONSTRAINT IF EXISTS "sensitive_word_type_valid_chk";

ALTER TABLE "sensitive_word"
  ADD CONSTRAINT "sensitive_word_type_valid_chk"
  CHECK ("type" in (1, 2, 3, 4, 5));

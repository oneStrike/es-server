-- regex 匹配模式已下线，历史 regex 词条没有可安全自动转换的新语义，
-- 因此在收紧约束前直接清理旧记录，避免升级被 legacy 数据阻断。
DELETE FROM "sensitive_word"
WHERE "match_mode" = 3;

ALTER TABLE "sensitive_word"
  ADD CONSTRAINT "sensitive_word_match_mode_valid_chk"
  CHECK ("match_mode" in (1, 2));

CREATE TABLE "sensitive_word_hit_log" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "sensitive_word_id" integer NOT NULL,
  "entity_type" smallint NOT NULL,
  "entity_id" integer NOT NULL,
  "operation_type" smallint NOT NULL,
  "matched_word" varchar(100) NOT NULL,
  "level" smallint NOT NULL,
  "type" smallint NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sensitive_word_hit_log_entity_type_valid_chk"
    CHECK ("entity_type" in (1, 2)),
  CONSTRAINT "sensitive_word_hit_log_operation_type_valid_chk"
    CHECK ("operation_type" in (1, 2)),
  CONSTRAINT "sensitive_word_hit_log_level_valid_chk"
    CHECK ("level" in (1, 2, 3)),
  CONSTRAINT "sensitive_word_hit_log_type_valid_chk"
    CHECK ("type" in (1, 2, 3, 4, 5))
);

CREATE INDEX "sensitive_word_hit_log_sensitive_word_id_created_at_idx"
  ON "sensitive_word_hit_log" ("sensitive_word_id", "created_at");

CREATE INDEX "sensitive_word_hit_log_entity_type_entity_id_created_at_idx"
  ON "sensitive_word_hit_log" ("entity_type", "entity_id", "created_at");

CREATE INDEX "sensitive_word_hit_log_created_at_idx"
  ON "sensitive_word_hit_log" ("created_at");

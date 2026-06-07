CREATE TABLE IF NOT EXISTS "migration_audit" (
  "migration_key" varchar(160) NOT NULL,
  "metric" varchar(160) NOT NULL,
  "value" bigint NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "migration_audit_migration_key_metric_key" UNIQUE ("migration_key", "metric")
);
--> statement-breakpoint
ALTER TABLE "growth_reward_rule"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_by" integer,
  ADD COLUMN IF NOT EXISTS "archive_reason_code" varchar(80),
  ADD COLUMN IF NOT EXISTS "archive_reason" varchar(500);
--> statement-breakpoint
WITH "ranked_active_rule" AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "type", "asset_type", "asset_key"
      ORDER BY "updated_at" DESC, "id" DESC
    ) AS "row_no"
  FROM "growth_reward_rule"
  WHERE "archived_at" IS NULL
),
"archived_duplicate_rule" AS (
  UPDATE "growth_reward_rule" AS "rule"
  SET
    "is_enabled" = false,
    "archived_at" = now(),
    "archive_reason_code" = 'DUPLICATE_ACTIVE_RULE',
    "archive_reason" = '同一事件和资产存在重复 active 规则，破坏性修复保留最新一条并自动归档旧规则',
    "updated_at" = now()
  FROM "ranked_active_rule" AS "ranked"
  WHERE "rule"."id" = "ranked"."id"
    AND "ranked"."row_no" > 1
  RETURNING 1
),
"upsert_audit" AS (
  INSERT INTO "migration_audit" ("migration_key", "metric", "value")
  SELECT
    '20260607183000_experience_rule_archive_audit_indexes',
    'archived_duplicate_active_rule_count',
    count(*)::bigint
  FROM "archived_duplicate_rule"
  ON CONFLICT ("migration_key", "metric") DO UPDATE
    SET "value" = EXCLUDED."value", "created_at" = now()
  RETURNING 1
)
SELECT count(*) FROM "upsert_audit";
--> statement-breakpoint
WITH "archived_unconfigurable_experience_rule" AS (
  UPDATE "growth_reward_rule"
  SET
    "is_enabled" = false,
    "archived_at" = now(),
    "archive_reason_code" = CASE
      WHEN "type" = 7 THEN 'EVENT_NOT_CONFIGURABLE'
      ELSE 'EVENT_NOT_IMPLEMENTED'
    END,
    "archive_reason" = CASE
      WHEN "type" = 7 THEN '事件不支持配置基础奖励规则，破坏性修复自动归档'
      ELSE '事件未实现，破坏性修复自动归档'
    END,
    "updated_at" = now()
  WHERE "asset_type" = 2
    AND "archived_at" IS NULL
    AND "type" NOT IN (
      1, 3, 5, 8, 10, 11, 100, 101, 102, 200, 201, 202,
      301, 401, 700, 701, 800, 801
    )
  RETURNING 1
),
"upsert_audit" AS (
  INSERT INTO "migration_audit" ("migration_key", "metric", "value")
  SELECT
    '20260607183000_experience_rule_archive_audit_indexes',
    'archived_unconfigurable_experience_rule_count',
    count(*)::bigint
  FROM "archived_unconfigurable_experience_rule"
  ON CONFLICT ("migration_key", "metric") DO UPDATE
    SET "value" = EXCLUDED."value", "created_at" = now()
  RETURNING 1
)
SELECT count(*) FROM "upsert_audit";
--> statement-breakpoint
ALTER TABLE "growth_reward_rule"
  DROP CONSTRAINT IF EXISTS "growth_reward_rule_type_asset_type_asset_key_key";
--> statement-breakpoint
DROP INDEX IF EXISTS "growth_reward_rule_type_asset_type_asset_key_active_key";
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_reward_rule_type_asset_type_asset_key_active_key"
  ON "growth_reward_rule" ("type", "asset_type", "asset_key")
  WHERE "archived_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_reward_rule_archived_at_idx"
  ON "growth_reward_rule" ("archived_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_ledger_record_asset_type_created_id_idx"
  ON "growth_ledger_record" ("asset_type", "created_at" DESC, "id" DESC);
--> statement-breakpoint
COMMENT ON COLUMN "growth_reward_rule"."archived_at" IS '归档时间；为空表示当前 active 规则。';
--> statement-breakpoint
COMMENT ON COLUMN "growth_reward_rule"."archived_by" IS '归档操作者管理员 ID；系统迁移自动归档为空。';
--> statement-breakpoint
COMMENT ON COLUMN "growth_reward_rule"."archive_reason_code" IS '归档原因码。';
--> statement-breakpoint
COMMENT ON COLUMN "growth_reward_rule"."archive_reason" IS '归档原因说明。';

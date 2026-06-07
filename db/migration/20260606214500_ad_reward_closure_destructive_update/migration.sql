CREATE TABLE IF NOT EXISTS "migration_audit" (
  "migration_key" varchar(160) NOT NULL,
  "metric" varchar(160) NOT NULL,
  "value" bigint NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "migration_audit_migration_key_metric_key" UNIQUE ("migration_key", "metric")
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ad_provider_config"
    WHERE "target_scope" NOT IN (1, 2, 3)
  ) THEN
    RAISE EXCEPTION 'Refusing ad reward closure migration: ad_provider_config contains unsupported target_scope';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "ad_reward_record"
  ADD COLUMN IF NOT EXISTS "target_scope" smallint;
--> statement-breakpoint
UPDATE "ad_reward_record"
SET "target_scope" = ("verify_payload"->>'targetScope')::smallint
WHERE "target_scope" IS NULL
  AND "verify_payload" IS NOT NULL
  AND ("verify_payload"->>'targetScope') ~ '^[0-9]+$'
  AND ("verify_payload"->>'targetScope')::smallint IN (1, 2, 3);
--> statement-breakpoint
UPDATE "ad_reward_record" AS "arr"
SET "target_scope" = "apc"."target_scope"
FROM "ad_provider_config" AS "apc"
WHERE "arr"."target_scope" IS NULL
  AND "apc"."id" = "arr"."ad_provider_config_id"
  AND "apc"."target_scope" IN (1, 2, 3);
--> statement-breakpoint
WITH "unbackfilled_reward_scope" AS (
  SELECT count(*)::bigint AS "issue_count"
  FROM "ad_reward_record"
  WHERE "target_scope" IS NULL
),
"upsert_audit" AS (
  INSERT INTO "migration_audit" ("migration_key", "metric", "value")
  SELECT
    '20260606214500_ad_reward_closure_destructive_update',
    'unbackfilled_reward_target_scope_count',
    "issue_count"
  FROM "unbackfilled_reward_scope"
  ON CONFLICT ("migration_key", "metric") DO UPDATE
    SET "value" = EXCLUDED."value", "created_at" = now()
  RETURNING 1
)
SELECT count(*) FROM "upsert_audit";
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ad_reward_record"
    WHERE "target_scope" IS NULL
  ) THEN
    RAISE EXCEPTION 'Refusing ad reward closure migration: ad_reward_record.target_scope could not be backfilled';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "ad_reward_record"
  ALTER COLUMN "target_scope" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ad_reward_record"
  DROP CONSTRAINT IF EXISTS "ad_reward_record_target_scope_valid_chk";
--> statement-breakpoint
ALTER TABLE "ad_reward_record"
  ADD CONSTRAINT "ad_reward_record_target_scope_valid_chk"
  CHECK ("target_scope" in (1, 2, 3));
--> statement-breakpoint
COMMENT ON COLUMN "ad_reward_record"."target_scope" IS '目标范围快照（1=低价章节；2=新用户冷启动；3=运营白名单）。';
--> statement-breakpoint
WITH "ranked_ad_entitlement" AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "grant_source", "source_id"
      ORDER BY
        CASE WHEN "status" = 1 THEN 0 ELSE 1 END,
        "created_at",
        "id"
    ) AS "row_no"
  FROM "user_content_entitlement"
  WHERE "grant_source" = 3
    AND "source_id" IS NOT NULL
),
"deleted_duplicate_ad_entitlement" AS (
  DELETE FROM "user_content_entitlement" AS "uce"
  USING "ranked_ad_entitlement" AS "ranked"
  WHERE "uce"."id" = "ranked"."id"
    AND "ranked"."row_no" > 1
  RETURNING 1
),
"upsert_audit" AS (
  INSERT INTO "migration_audit" ("migration_key", "metric", "value")
  SELECT
    '20260606214500_ad_reward_closure_destructive_update',
    'deleted_duplicate_ad_entitlement_count',
    count(*)::bigint
  FROM "deleted_duplicate_ad_entitlement"
  ON CONFLICT ("migration_key", "metric") DO UPDATE
    SET "value" = EXCLUDED."value", "created_at" = now()
  RETURNING 1
)
SELECT count(*) FROM "upsert_audit";
--> statement-breakpoint
DROP INDEX IF EXISTS "ad_provider_config_enabled_unique_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "ad_provider_config_enabled_unique_idx"
  ON "ad_provider_config" (
    "provider",
    "platform",
    "client_app_key",
    "app_id",
    "placement_key",
    "environment",
    "target_scope"
  )
  WHERE "is_enabled" = true;
--> statement-breakpoint
DROP INDEX IF EXISTS "ad_provider_config_selection_idx";
--> statement-breakpoint
CREATE INDEX "ad_provider_config_selection_idx"
  ON "ad_provider_config" (
    "provider",
    "platform",
    "client_app_key",
    "app_id",
    "placement_key",
    "environment",
    "target_scope",
    "is_enabled",
    "sort_order",
    "id"
  );
--> statement-breakpoint
DROP INDEX IF EXISTS "ad_reward_record_user_target_status_idx";
--> statement-breakpoint
CREATE INDEX "ad_reward_record_user_target_status_idx"
  ON "ad_reward_record" ("user_id", "target_scope", "target_type", "target_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_config_scope_status_idx"
  ON "ad_reward_record" ("ad_provider_config_id", "target_scope", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_user_config_status_created_at_idx"
  ON "ad_reward_record" ("user_id", "ad_provider_config_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_status_created_at_id_idx"
  ON "ad_reward_record" ("status", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_target_scope_status_created_at_idx"
  ON "ad_reward_record" ("target_scope", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_target_status_idx"
  ON "ad_reward_record" ("target_type", "target_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_user_created_at_idx"
  ON "ad_reward_record" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_config_created_at_idx"
  ON "ad_reward_record" ("ad_provider_config_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reward_record_created_at_idx"
  ON "ad_reward_record" ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_content_entitlement_ad_source_unique_idx"
  ON "user_content_entitlement" ("grant_source", "source_id")
  WHERE "grant_source" = 3 AND "source_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "migration_audit" (
  "migration_key" varchar(160) NOT NULL,
  "metric" varchar(160) NOT NULL,
  "value" bigint NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "migration_audit_migration_key_metric_key" UNIQUE ("migration_key", "metric")
);
--> statement-breakpoint
WITH deleted_invalid_plan_benefits AS (
  DELETE FROM "membership_plan_benefit" mpb
  USING "membership_benefit_definition" mbd
  WHERE mpb."benefit_id" = mbd."id"
    AND (
      mbd."benefit_type" NOT IN (1, 2)
      OR mpb."grant_policy" NOT IN (1, 2)
      OR (mbd."benefit_type" = 1 AND mpb."grant_policy" <> 1)
      OR (mbd."benefit_type" = 2 AND mpb."grant_policy" <> 2)
    )
  RETURNING 1
),
upsert_audit AS (
  INSERT INTO "migration_audit" ("migration_key", "metric", "value")
  SELECT
    '20260603081500_membership_benefit_closure_breaking',
    'deleted_invalid_plan_benefit_count',
    count(*)::bigint
  FROM deleted_invalid_plan_benefits
  ON CONFLICT ("migration_key", "metric") DO UPDATE
    SET "value" = EXCLUDED."value", "created_at" = now()
  RETURNING 1
)
SELECT count(*) FROM upsert_audit;
--> statement-breakpoint
WITH deleted_orphan_plan_benefits AS (
  DELETE FROM "membership_plan_benefit" mpb
  WHERE NOT EXISTS (
      SELECT 1
      FROM "membership_plan" mp
      WHERE mp."id" = mpb."plan_id"
    )
    OR NOT EXISTS (
      SELECT 1
      FROM "membership_benefit_definition" mbd
      WHERE mbd."id" = mpb."benefit_id"
    )
  RETURNING 1
),
upsert_audit AS (
  INSERT INTO "migration_audit" ("migration_key", "metric", "value")
  SELECT
    '20260603081500_membership_benefit_closure_breaking',
    'deleted_orphan_plan_benefit_count',
    count(*)::bigint
  FROM deleted_orphan_plan_benefits
  ON CONFLICT ("migration_key", "metric") DO UPDATE
    SET "value" = EXCLUDED."value", "created_at" = now()
  RETURNING 1
)
SELECT count(*) FROM upsert_audit;
--> statement-breakpoint
WITH deleted_unsupported_benefits AS (
  DELETE FROM "membership_benefit_definition"
  WHERE "benefit_type" NOT IN (1, 2)
  RETURNING 1
),
upsert_audit AS (
  INSERT INTO "migration_audit" ("migration_key", "metric", "value")
  SELECT
    '20260603081500_membership_benefit_closure_breaking',
    'deleted_unsupported_benefit_definition_count',
    count(*)::bigint
  FROM deleted_unsupported_benefits
  ON CONFLICT ("migration_key", "metric") DO UPDATE
    SET "value" = EXCLUDED."value", "created_at" = now()
  RETURNING 1
)
SELECT count(*) FROM upsert_audit;
--> statement-breakpoint
DROP TABLE IF EXISTS "membership_benefit_claim_record" CASCADE;
--> statement-breakpoint
ALTER TABLE "membership_benefit_definition"
  DROP CONSTRAINT IF EXISTS "membership_benefit_definition_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "membership_benefit_definition"
  ADD CONSTRAINT "membership_benefit_definition_type_valid_chk"
  CHECK ("benefit_type" in (1, 2));
--> statement-breakpoint
ALTER TABLE "membership_plan_benefit"
  DROP CONSTRAINT IF EXISTS "membership_plan_benefit_grant_policy_valid_chk";
--> statement-breakpoint
ALTER TABLE "membership_plan_benefit"
  ADD CONSTRAINT "membership_plan_benefit_grant_policy_valid_chk"
  CHECK ("grant_policy" in (1, 2));

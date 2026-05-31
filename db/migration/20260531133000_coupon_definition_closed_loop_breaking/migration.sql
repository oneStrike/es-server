DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "coupon_definition"
    WHERE "coupon_type" NOT IN (1, 2, 3, 4, 5)
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: coupon_definition contains unknown coupon_type';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_definition"
    WHERE "target_scope" NOT IN (1, 2, 3, 4)
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: coupon_definition contains unknown target_scope';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_definition"
    WHERE "target_scope" = 3
      AND "coupon_type" <> 4
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: old ad target_scope=3 appears on a non-no-ad definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_definition"
    WHERE ("coupon_type" IN (1, 2) AND "target_scope" <> 1)
       OR ("coupon_type" = 3 AND "target_scope" <> 2)
       OR ("coupon_type" = 4 AND "target_scope" <> 3)
       OR ("coupon_type" = 5 AND "target_scope" <> 4)
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: coupon_type and target_scope contain an ambiguous old combination';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_definition"
    WHERE "usage_limit" < 1
       OR "valid_days" < 0
       OR "discount_amount" < 0
       OR "discount_rate_bps" < 0
       OR "discount_rate_bps" > 10000
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: coupon_definition contains invalid numeric ability fields';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_coupon_instance"
    WHERE "coupon_type" NOT IN (1, 2, 3, 4, 5)
       OR "source_type" NOT IN (1, 2, 3, 4)
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: user_coupon_instance contains unknown coupon/source type';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_redemption_record"
    WHERE "coupon_type" NOT IN (1, 2, 3, 4, 5)
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: coupon_redemption_record contains unknown coupon_type';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_coupon_instance"
    WHERE "grant_snapshot" ? 'couponType'
      AND NOT ("grant_snapshot"->>'couponType' ~ '^[0-9]+$')
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: user_coupon_instance grant_snapshot.couponType is not numeric';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_coupon_instance"
    WHERE "grant_snapshot" ? 'targetScope'
      AND NOT ("grant_snapshot"->>'targetScope' ~ '^[0-9]+$')
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: user_coupon_instance grant_snapshot.targetScope is not numeric';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_redemption_record"
    WHERE "redemption_snapshot" ? 'couponType'
      AND NOT ("redemption_snapshot"->>'couponType' ~ '^[0-9]+$')
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: coupon_redemption_record redemption_snapshot.couponType is not numeric';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_redemption_record"
    WHERE "redemption_snapshot" ? 'targetScope'
      AND NOT ("redemption_snapshot"->>'targetScope' ~ '^[0-9]+$')
  ) THEN
    RAISE EXCEPTION 'Refusing coupon definition migration: coupon_redemption_record redemption_snapshot.targetScope is not numeric';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD COLUMN IF NOT EXISTS "benefit_days" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD COLUMN IF NOT EXISTS "benefit_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_coupon_instance"
  ADD COLUMN IF NOT EXISTS "grant_key" varchar(180);
--> statement-breakpoint
DELETE FROM "coupon_redemption_record"
WHERE "coupon_type" = 4;
--> statement-breakpoint
DELETE FROM "user_coupon_instance"
WHERE "coupon_type" = 4;
--> statement-breakpoint
DELETE FROM "coupon_definition"
WHERE "coupon_type" = 4
   OR "target_scope" = 3;
--> statement-breakpoint
UPDATE "coupon_definition"
SET
  "coupon_type" = 4,
  "target_scope" = 3,
  "benefit_count" = GREATEST("usage_limit", 1),
  "benefit_days" = 0,
  "discount_amount" = 0,
  "discount_rate_bps" = 10000,
  "usage_limit" = 1
WHERE "coupon_type" = 5;
--> statement-breakpoint
UPDATE "coupon_definition"
SET
  "benefit_days" = GREATEST("valid_days", 1),
  "benefit_count" = 0,
  "discount_amount" = 0,
  "discount_rate_bps" = 10000,
  "usage_limit" = 1
WHERE "coupon_type" = 3;
--> statement-breakpoint
UPDATE "coupon_definition"
SET
  "benefit_days" = 0,
  "benefit_count" = 0
WHERE "coupon_type" IN (1, 2);
--> statement-breakpoint
UPDATE "user_coupon_instance"
SET "coupon_type" = 4
WHERE "coupon_type" = 5;
--> statement-breakpoint
UPDATE "coupon_redemption_record"
SET "coupon_type" = 4
WHERE "coupon_type" = 5;
--> statement-breakpoint
UPDATE "user_coupon_instance" AS "uci"
SET "grant_snapshot" = (
  CASE
    WHEN jsonb_typeof("uci"."grant_snapshot") = 'object'
      THEN "uci"."grant_snapshot" - 'couponName'
    ELSE '{}'::jsonb
  END
) || jsonb_build_object(
  'name',
  COALESCE(
    NULLIF("uci"."grant_snapshot"->>'name', ''),
    NULLIF("uci"."grant_snapshot"->>'couponName', ''),
    "cd"."name"
  ),
  'couponType', "uci"."coupon_type",
  'targetScope', "cd"."target_scope",
  'usageLimit', "cd"."usage_limit",
  'discountRateBps', "cd"."discount_rate_bps",
  'discountAmount', "cd"."discount_amount",
  'benefitDays', "cd"."benefit_days",
  'benefitCount', "cd"."benefit_count",
  'validDays', "cd"."valid_days",
  'issuedAt',
  COALESCE(
    NULLIF("uci"."grant_snapshot"->>'issuedAt', ''),
    to_char("uci"."created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
)
FROM "coupon_definition" AS "cd"
WHERE "cd"."id" = "uci"."coupon_definition_id";
--> statement-breakpoint
UPDATE "coupon_redemption_record"
SET "redemption_snapshot" = jsonb_set(
  jsonb_set(
    CASE
      WHEN "redemption_snapshot" ? 'couponName'
        THEN ("redemption_snapshot" - 'couponName') || jsonb_build_object('name', "redemption_snapshot"->>'couponName')
      ELSE "redemption_snapshot"
    END,
    '{couponType}',
    to_jsonb("coupon_type"),
    true
  ),
  '{targetScope}',
  to_jsonb(
    CASE
      WHEN "coupon_type" IN (1, 2) THEN 1
      WHEN "coupon_type" = 3 THEN 2
      WHEN "coupon_type" = 4 THEN 3
    END
  ),
  true
)
WHERE "redemption_snapshot" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP COLUMN IF EXISTS "budget_limit";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP COLUMN IF EXISTS "config_payload";
--> statement-breakpoint
ALTER TABLE "coupon_redemption_record"
  ALTER COLUMN "target_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_coupon_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_target_scope_valid_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_usage_limit_positive_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_valid_days_non_negative_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_benefit_days_non_negative_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_benefit_count_non_negative_chk";
--> statement-breakpoint
ALTER TABLE "user_coupon_instance"
  DROP CONSTRAINT IF EXISTS "user_coupon_instance_coupon_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "user_coupon_instance"
  DROP CONSTRAINT IF EXISTS "user_coupon_instance_source_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "coupon_redemption_record"
  DROP CONSTRAINT IF EXISTS "coupon_redemption_record_coupon_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_coupon_type_valid_chk"
  CHECK ("coupon_type" IN (1, 2, 3, 4));
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_target_scope_valid_chk"
  CHECK ("target_scope" IN (1, 2, 3));
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_usage_limit_positive_chk"
  CHECK ("usage_limit" >= 1);
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_valid_days_non_negative_chk"
  CHECK ("valid_days" >= 0);
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_benefit_days_non_negative_chk"
  CHECK ("benefit_days" >= 0);
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_benefit_count_non_negative_chk"
  CHECK ("benefit_count" >= 0);
--> statement-breakpoint
ALTER TABLE "user_coupon_instance"
  ADD CONSTRAINT "user_coupon_instance_coupon_type_valid_chk"
  CHECK ("coupon_type" IN (1, 2, 3, 4));
--> statement-breakpoint
ALTER TABLE "user_coupon_instance"
  ADD CONSTRAINT "user_coupon_instance_source_type_valid_chk"
  CHECK ("source_type" IN (1, 2, 3, 4, 5));
--> statement-breakpoint
ALTER TABLE "coupon_redemption_record"
  ADD CONSTRAINT "coupon_redemption_record_coupon_type_valid_chk"
  CHECK ("coupon_type" IN (1, 2, 3, 4));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_coupon_instance_user_grant_key_unique_idx"
  ON "user_coupon_instance" ("user_id", "grant_key")
  WHERE "grant_key" IS NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "coupon_definition" WHERE "coupon_type" NOT IN (1, 2, 3, 4)) THEN
    RAISE EXCEPTION 'Coupon definition migration failed: coupon_definition still has old coupon_type';
  END IF;

  IF EXISTS (SELECT 1 FROM "coupon_definition" WHERE "target_scope" NOT IN (1, 2, 3)) THEN
    RAISE EXCEPTION 'Coupon definition migration failed: coupon_definition still has old target_scope';
  END IF;

  IF EXISTS (SELECT 1 FROM "user_coupon_instance" WHERE "coupon_type" NOT IN (1, 2, 3, 4)) THEN
    RAISE EXCEPTION 'Coupon definition migration failed: user_coupon_instance still has old coupon_type';
  END IF;

  IF EXISTS (SELECT 1 FROM "coupon_redemption_record" WHERE "coupon_type" NOT IN (1, 2, 3, 4)) THEN
    RAISE EXCEPTION 'Coupon definition migration failed: coupon_redemption_record still has old coupon_type';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_coupon_instance"
    WHERE ("grant_snapshot"->>'couponType') = '5'
       OR ("grant_snapshot"->>'targetScope') = '4'
  ) THEN
    RAISE EXCEPTION 'Coupon definition migration failed: old enum values remain in grant_snapshot';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_coupon_instance"
    WHERE "grant_snapshot" IS NULL
       OR NOT (
      "grant_snapshot" ? 'name'
      AND "grant_snapshot" ? 'couponType'
      AND "grant_snapshot" ? 'targetScope'
      AND "grant_snapshot" ? 'usageLimit'
      AND "grant_snapshot" ? 'discountRateBps'
      AND "grant_snapshot" ? 'discountAmount'
      AND "grant_snapshot" ? 'benefitDays'
      AND "grant_snapshot" ? 'benefitCount'
      AND "grant_snapshot" ? 'validDays'
      AND "grant_snapshot" ? 'issuedAt'
    )
  ) THEN
    RAISE EXCEPTION 'Coupon definition migration failed: grant_snapshot is not closed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coupon_redemption_record"
    WHERE ("redemption_snapshot"->>'couponType') = '5'
       OR ("redemption_snapshot"->>'targetScope') = '4'
  ) THEN
    RAISE EXCEPTION 'Coupon definition migration failed: old enum values remain in redemption_snapshot';
  END IF;
END $$;

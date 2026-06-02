DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "coupon_definition"
    WHERE ("coupon_type" = 1 AND NOT ("target_scope" = 1 AND "usage_limit" >= 1))
       OR ("coupon_type" = 2 AND NOT ("target_scope" = 1 AND ("discount_amount" > 0 OR "discount_rate_bps" < 10000)))
       OR ("coupon_type" = 3 AND NOT ("target_scope" = 2 AND "benefit_days" >= 1))
       OR ("coupon_type" = 4 AND NOT ("target_scope" = 3 AND "benefit_count" >= 1))
  ) THEN
    RAISE EXCEPTION 'Refusing coupon review migration: coupon_definition contains rows that violate coupon ability matrix';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ALTER COLUMN "valid_days" SET DEFAULT 7;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_reading_ability_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_discount_ability_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_vip_trial_ability_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  DROP CONSTRAINT IF EXISTS "coupon_definition_check_in_makeup_ability_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_reading_ability_chk"
  CHECK ("coupon_type" != 1 OR ("target_scope" = 1 AND "usage_limit" >= 1))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_discount_ability_chk"
  CHECK ("coupon_type" != 2 OR ("target_scope" = 1 AND ("discount_amount" > 0 OR "discount_rate_bps" < 10000)))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_vip_trial_ability_chk"
  CHECK ("coupon_type" != 3 OR ("target_scope" = 2 AND "benefit_days" >= 1))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_check_in_makeup_ability_chk"
  CHECK ("coupon_type" != 4 OR ("target_scope" = 3 AND "benefit_count" >= 1))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  VALIDATE CONSTRAINT "coupon_definition_reading_ability_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  VALIDATE CONSTRAINT "coupon_definition_discount_ability_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  VALIDATE CONSTRAINT "coupon_definition_vip_trial_ability_chk";
--> statement-breakpoint
ALTER TABLE "coupon_definition"
  VALIDATE CONSTRAINT "coupon_definition_check_in_makeup_ability_chk";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_definition_created_at_idx"
  ON "coupon_definition" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_coupon_instance_user_available_type_created_idx"
  ON "user_coupon_instance" ("user_id", "status", "coupon_type", "created_at" DESC)
  WHERE "remaining_uses" > 0;

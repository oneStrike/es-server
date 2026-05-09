ALTER TABLE "membership_plan"
  ADD COLUMN IF NOT EXISTS "tier" smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "price_amount" integer,
  ADD COLUMN IF NOT EXISTS "original_price_amount" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "display_tag" varchar(32) DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bonus_point_amount" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "benefit_group_key" varchar(64) DEFAULT '',
  ADD COLUMN IF NOT EXISTS "benefit_snapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "auto_renew_enabled" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "agreement_codes" jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'membership_plan'
      AND column_name = 'price'
  ) THEN
    UPDATE "membership_plan"
    SET "price_amount" = "price"
    WHERE "price_amount" IS NULL;
  END IF;
END $$;

UPDATE "membership_plan"
SET
  "tier" = COALESCE("tier", 1),
  "price_amount" = COALESCE("price_amount", 0),
  "original_price_amount" = GREATEST(COALESCE("original_price_amount", 0), COALESCE("price_amount", 0)),
  "display_tag" = COALESCE("display_tag", ''),
  "bonus_point_amount" = COALESCE("bonus_point_amount", 0),
  "benefit_group_key" = COALESCE("benefit_group_key", ''),
  "auto_renew_enabled" = COALESCE("auto_renew_enabled", false);

ALTER TABLE "membership_plan"
  ALTER COLUMN "tier" SET NOT NULL,
  ALTER COLUMN "price_amount" SET NOT NULL,
  ALTER COLUMN "original_price_amount" SET NOT NULL,
  ALTER COLUMN "display_tag" SET NOT NULL,
  ALTER COLUMN "bonus_point_amount" SET NOT NULL,
  ALTER COLUMN "benefit_group_key" SET NOT NULL,
  ALTER COLUMN "auto_renew_enabled" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_plan'::regclass
      AND conname = 'membership_plan_tier_valid_chk'
  ) THEN
    ALTER TABLE "membership_plan"
      ADD CONSTRAINT "membership_plan_tier_valid_chk" CHECK ("tier" in (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_plan'::regclass
      AND conname = 'membership_plan_original_price_amount_valid_chk'
  ) THEN
    ALTER TABLE "membership_plan"
      ADD CONSTRAINT "membership_plan_original_price_amount_valid_chk" CHECK ("original_price_amount" >= "price_amount");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_plan'::regclass
      AND conname = 'membership_plan_bonus_point_amount_non_negative_chk'
  ) THEN
    ALTER TABLE "membership_plan"
      ADD CONSTRAINT "membership_plan_bonus_point_amount_non_negative_chk" CHECK ("bonus_point_amount" >= 0);
  END IF;
END $$;

DROP INDEX IF EXISTS "membership_plan_enabled_sort_order_idx";
CREATE INDEX "membership_plan_enabled_sort_order_idx"
  ON "membership_plan" ("is_enabled", "tier", "sort_order");

ALTER TABLE "membership_plan"
  DROP COLUMN IF EXISTS "price";

--> statement-breakpoint

ALTER TABLE "payment_provider_config"
  ADD COLUMN IF NOT EXISTS "config_name" varchar(120) DEFAULT '',
  ADD COLUMN IF NOT EXISTS "agreement_notify_url" varchar(500),
  ADD COLUMN IF NOT EXISTS "allowed_return_domains" jsonb,
  ADD COLUMN IF NOT EXISTS "cert_mode" smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "public_key_ref" varchar(160),
  ADD COLUMN IF NOT EXISTS "private_key_ref" varchar(160),
  ADD COLUMN IF NOT EXISTS "api_v3_key_ref" varchar(160),
  ADD COLUMN IF NOT EXISTS "app_cert_ref" varchar(160),
  ADD COLUMN IF NOT EXISTS "platform_cert_ref" varchar(160),
  ADD COLUMN IF NOT EXISTS "root_cert_ref" varchar(160),
  ADD COLUMN IF NOT EXISTS "supports_auto_renew" boolean DEFAULT false;

UPDATE "payment_provider_config"
SET
  "config_name" = COALESCE("config_name", ''),
  "cert_mode" = COALESCE("cert_mode", 1),
  "supports_auto_renew" = COALESCE("supports_auto_renew", false);

ALTER TABLE "payment_provider_config"
  ALTER COLUMN "config_name" SET NOT NULL,
  ALTER COLUMN "cert_mode" SET NOT NULL,
  ALTER COLUMN "supports_auto_renew" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payment_provider_config'::regclass
      AND conname = 'payment_provider_config_cert_mode_valid_chk'
  ) THEN
    ALTER TABLE "payment_provider_config"
      ADD CONSTRAINT "payment_provider_config_cert_mode_valid_chk" CHECK ("cert_mode" in (1, 2));
  END IF;
END $$;

DROP INDEX IF EXISTS "payment_provider_config_enabled_unique_idx";
CREATE UNIQUE INDEX "payment_provider_config_enabled_unique_idx"
  ON "payment_provider_config" ("channel", "payment_scene", "platform", "client_app_key", "app_id", "mch_id", "environment")
  WHERE "is_enabled" = true;

DROP INDEX IF EXISTS "payment_provider_config_selection_idx";
CREATE INDEX "payment_provider_config_selection_idx"
  ON "payment_provider_config" ("channel", "payment_scene", "platform", "client_app_key", "environment", "is_enabled", "sort_order");

--> statement-breakpoint

ALTER TABLE "payment_order"
  ADD COLUMN IF NOT EXISTS "platform" smallint,
  ADD COLUMN IF NOT EXISTS "environment" smallint,
  ADD COLUMN IF NOT EXISTS "client_app_key" varchar(80) DEFAULT '',
  ADD COLUMN IF NOT EXISTS "subscription_mode" smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "auto_renew_agreement_id" integer,
  ADD COLUMN IF NOT EXISTS "client_pay_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "closed_at" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "refunded_at" timestamp(6) with time zone;

UPDATE "payment_order"
SET
  "platform" = COALESCE("platform", 4),
  "environment" = COALESCE("environment", 2),
  "client_app_key" = COALESCE("client_app_key", ''),
  "subscription_mode" = COALESCE("subscription_mode", 1);

ALTER TABLE "payment_order"
  ALTER COLUMN "platform" SET NOT NULL,
  ALTER COLUMN "environment" SET NOT NULL,
  ALTER COLUMN "client_app_key" SET NOT NULL,
  ALTER COLUMN "subscription_mode" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payment_order'::regclass
      AND conname = 'payment_order_platform_valid_chk'
  ) THEN
    ALTER TABLE "payment_order"
      ADD CONSTRAINT "payment_order_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payment_order'::regclass
      AND conname = 'payment_order_environment_valid_chk'
  ) THEN
    ALTER TABLE "payment_order"
      ADD CONSTRAINT "payment_order_environment_valid_chk" CHECK ("environment" in (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payment_order'::regclass
      AND conname = 'payment_order_subscription_mode_valid_chk'
  ) THEN
    ALTER TABLE "payment_order"
      ADD CONSTRAINT "payment_order_subscription_mode_valid_chk" CHECK ("subscription_mode" in (1, 2, 3));
  END IF;
END $$;

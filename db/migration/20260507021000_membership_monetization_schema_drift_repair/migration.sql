CREATE TABLE IF NOT EXISTS "membership_benefit_definition" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "code" varchar(80) NOT NULL,
  "name" varchar(80) NOT NULL,
  "icon" varchar(300) DEFAULT '' NOT NULL,
  "benefit_type" smallint NOT NULL,
  "description" varchar(500) DEFAULT '' NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_benefit_definition'::regclass
      AND conname = 'membership_benefit_definition_code_key'
  ) THEN
    ALTER TABLE "membership_benefit_definition"
      ADD CONSTRAINT "membership_benefit_definition_code_key" UNIQUE ("code");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_benefit_definition'::regclass
      AND conname = 'membership_benefit_definition_type_valid_chk'
  ) THEN
    ALTER TABLE "membership_benefit_definition"
      ADD CONSTRAINT "membership_benefit_definition_type_valid_chk" CHECK ("benefit_type" in (1, 2, 3, 4, 5, 6));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_benefit_definition'::regclass
      AND conname = 'membership_benefit_definition_sort_order_non_negative_chk'
  ) THEN
    ALTER TABLE "membership_benefit_definition"
      ADD CONSTRAINT "membership_benefit_definition_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "membership_benefit_definition_enabled_sort_order_idx"
  ON "membership_benefit_definition" ("is_enabled", "sort_order");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "membership_plan_benefit" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "plan_id" integer NOT NULL,
  "benefit_id" integer NOT NULL,
  "grant_policy" smallint NOT NULL,
  "benefit_value" jsonb,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_plan_benefit'::regclass
      AND conname = 'membership_plan_benefit_plan_benefit_key'
  ) THEN
    ALTER TABLE "membership_plan_benefit"
      ADD CONSTRAINT "membership_plan_benefit_plan_benefit_key" UNIQUE ("plan_id", "benefit_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_plan_benefit'::regclass
      AND conname = 'membership_plan_benefit_grant_policy_valid_chk'
  ) THEN
    ALTER TABLE "membership_plan_benefit"
      ADD CONSTRAINT "membership_plan_benefit_grant_policy_valid_chk" CHECK ("grant_policy" in (1, 2, 3, 4, 5));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_plan_benefit'::regclass
      AND conname = 'membership_plan_benefit_sort_order_non_negative_chk'
  ) THEN
    ALTER TABLE "membership_plan_benefit"
      ADD CONSTRAINT "membership_plan_benefit_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "membership_plan_benefit_plan_enabled_sort_order_idx"
  ON "membership_plan_benefit" ("plan_id", "is_enabled", "sort_order");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "membership_page_config" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "page_key" varchar(80) NOT NULL,
  "title" varchar(80) NOT NULL,
  "member_notice_items" jsonb,
  "auto_renew_notice" text DEFAULT '' NOT NULL,
  "checkout_agreement_text" text DEFAULT '' NOT NULL,
  "service_agreement_code" varchar(80) DEFAULT '' NOT NULL,
  "privacy_agreement_code" varchar(80) DEFAULT '' NOT NULL,
  "renewal_agreement_code" varchar(80) DEFAULT '' NOT NULL,
  "submit_button_template" varchar(120) DEFAULT '' NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_page_config'::regclass
      AND conname = 'membership_page_config_page_key_key'
  ) THEN
    ALTER TABLE "membership_page_config"
      ADD CONSTRAINT "membership_page_config_page_key_key" UNIQUE ("page_key");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_page_config'::regclass
      AND conname = 'membership_page_config_sort_order_non_negative_chk'
  ) THEN
    ALTER TABLE "membership_page_config"
      ADD CONSTRAINT "membership_page_config_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "membership_page_config_enabled_sort_order_idx"
  ON "membership_page_config" ("is_enabled", "sort_order");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "membership_auto_renew_agreement" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "plan_id" integer NOT NULL,
  "channel" smallint NOT NULL,
  "payment_scene" smallint NOT NULL,
  "platform" smallint NOT NULL,
  "environment" smallint NOT NULL,
  "client_app_key" varchar(80) DEFAULT '' NOT NULL,
  "provider_config_id" integer NOT NULL,
  "provider_config_version" integer NOT NULL,
  "credential_version_ref" varchar(160) NOT NULL,
  "agreement_no" varchar(160) NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "signed_at" timestamp(6) with time zone,
  "next_renew_at" timestamp(6) with time zone,
  "cancelled_at" timestamp(6) with time zone,
  "raw_payload" jsonb,
  "agreement_snapshot" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_auto_renew_agreement'::regclass
      AND conname = 'membership_auto_renew_agreement_no_key'
  ) THEN
    ALTER TABLE "membership_auto_renew_agreement"
      ADD CONSTRAINT "membership_auto_renew_agreement_no_key" UNIQUE ("provider_config_id", "agreement_no");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_auto_renew_agreement'::regclass
      AND conname = 'membership_auto_renew_agreement_channel_valid_chk'
  ) THEN
    ALTER TABLE "membership_auto_renew_agreement"
      ADD CONSTRAINT "membership_auto_renew_agreement_channel_valid_chk" CHECK ("channel" in (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_auto_renew_agreement'::regclass
      AND conname = 'membership_auto_renew_agreement_scene_valid_chk'
  ) THEN
    ALTER TABLE "membership_auto_renew_agreement"
      ADD CONSTRAINT "membership_auto_renew_agreement_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_auto_renew_agreement'::regclass
      AND conname = 'membership_auto_renew_agreement_platform_valid_chk'
  ) THEN
    ALTER TABLE "membership_auto_renew_agreement"
      ADD CONSTRAINT "membership_auto_renew_agreement_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_auto_renew_agreement'::regclass
      AND conname = 'membership_auto_renew_agreement_environment_valid_chk'
  ) THEN
    ALTER TABLE "membership_auto_renew_agreement"
      ADD CONSTRAINT "membership_auto_renew_agreement_environment_valid_chk" CHECK ("environment" in (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_auto_renew_agreement'::regclass
      AND conname = 'membership_auto_renew_agreement_status_valid_chk'
  ) THEN
    ALTER TABLE "membership_auto_renew_agreement"
      ADD CONSTRAINT "membership_auto_renew_agreement_status_valid_chk" CHECK ("status" in (1, 2, 3, 4));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "membership_auto_renew_agreement_user_status_idx"
  ON "membership_auto_renew_agreement" ("user_id", "status");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "membership_benefit_claim_record" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "plan_id" integer NOT NULL,
  "benefit_id" integer NOT NULL,
  "subscription_id" integer NOT NULL,
  "claim_date" date NOT NULL,
  "grant_target_type" smallint,
  "grant_target_id" integer,
  "biz_key" varchar(160) NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "grant_snapshot" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_benefit_claim_record'::regclass
      AND conname = 'membership_benefit_claim_record_biz_key_key'
  ) THEN
    ALTER TABLE "membership_benefit_claim_record"
      ADD CONSTRAINT "membership_benefit_claim_record_biz_key_key" UNIQUE ("biz_key");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.membership_benefit_claim_record'::regclass
      AND conname = 'membership_benefit_claim_record_status_valid_chk'
  ) THEN
    ALTER TABLE "membership_benefit_claim_record"
      ADD CONSTRAINT "membership_benefit_claim_record_status_valid_chk" CHECK ("status" in (1, 2, 3));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "membership_benefit_claim_record_user_benefit_date_idx"
  ON "membership_benefit_claim_record" ("user_id", "benefit_id", "claim_date");

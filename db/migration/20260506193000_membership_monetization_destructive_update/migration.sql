CREATE TABLE "membership_plan" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" varchar(80) NOT NULL,
  "plan_key" varchar(64) NOT NULL,
  "tier" smallint DEFAULT 1 NOT NULL,
  "price_amount" integer NOT NULL,
  "original_price_amount" integer DEFAULT 0 NOT NULL,
  "duration_days" integer NOT NULL,
  "display_tag" varchar(32) DEFAULT '' NOT NULL,
  "bonus_point_amount" integer DEFAULT 0 NOT NULL,
  "benefit_group_key" varchar(64) DEFAULT '' NOT NULL,
  "benefit_snapshot" jsonb,
  "auto_renew_enabled" boolean DEFAULT false NOT NULL,
  "agreement_codes" jsonb,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "membership_plan"
  ADD CONSTRAINT "membership_plan_plan_key_key" UNIQUE ("plan_key");
CREATE INDEX "membership_plan_enabled_sort_order_idx"
  ON "membership_plan" ("is_enabled", "tier", "sort_order");
ALTER TABLE "membership_plan"
  ADD CONSTRAINT "membership_plan_tier_valid_chk" CHECK ("tier" in (1, 2));
ALTER TABLE "membership_plan"
  ADD CONSTRAINT "membership_plan_price_amount_non_negative_chk" CHECK ("price_amount" >= 0);
ALTER TABLE "membership_plan"
  ADD CONSTRAINT "membership_plan_original_price_amount_valid_chk" CHECK ("original_price_amount" >= "price_amount");
ALTER TABLE "membership_plan"
  ADD CONSTRAINT "membership_plan_duration_days_positive_chk" CHECK ("duration_days" > 0);
ALTER TABLE "membership_plan"
  ADD CONSTRAINT "membership_plan_bonus_point_amount_non_negative_chk" CHECK ("bonus_point_amount" >= 0);
ALTER TABLE "membership_plan"
  ADD CONSTRAINT "membership_plan_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE TABLE "membership_benefit_definition" (
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

ALTER TABLE "membership_benefit_definition"
  ADD CONSTRAINT "membership_benefit_definition_code_key" UNIQUE ("code");
CREATE INDEX "membership_benefit_definition_enabled_sort_order_idx"
  ON "membership_benefit_definition" ("is_enabled", "sort_order");
ALTER TABLE "membership_benefit_definition"
  ADD CONSTRAINT "membership_benefit_definition_type_valid_chk" CHECK ("benefit_type" in (1, 2, 3, 4, 5, 6));
ALTER TABLE "membership_benefit_definition"
  ADD CONSTRAINT "membership_benefit_definition_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE TABLE "membership_plan_benefit" (
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

ALTER TABLE "membership_plan_benefit"
  ADD CONSTRAINT "membership_plan_benefit_plan_benefit_key" UNIQUE ("plan_id", "benefit_id");
CREATE INDEX "membership_plan_benefit_plan_enabled_sort_order_idx"
  ON "membership_plan_benefit" ("plan_id", "is_enabled", "sort_order");
ALTER TABLE "membership_plan_benefit"
  ADD CONSTRAINT "membership_plan_benefit_grant_policy_valid_chk" CHECK ("grant_policy" in (1, 2, 3, 4, 5));
ALTER TABLE "membership_plan_benefit"
  ADD CONSTRAINT "membership_plan_benefit_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE TABLE "membership_page_config" (
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

ALTER TABLE "membership_page_config"
  ADD CONSTRAINT "membership_page_config_page_key_key" UNIQUE ("page_key");
CREATE INDEX "membership_page_config_enabled_sort_order_idx"
  ON "membership_page_config" ("is_enabled", "sort_order");
ALTER TABLE "membership_page_config"
  ADD CONSTRAINT "membership_page_config_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE TABLE "user_membership_subscription" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "plan_id" integer,
  "source_type" smallint NOT NULL,
  "source_id" integer,
  "status" smallint DEFAULT 1 NOT NULL,
  "starts_at" timestamp(6) with time zone NOT NULL,
  "ends_at" timestamp(6) with time zone NOT NULL,
  "cancelled_at" timestamp(6) with time zone,
  "refunded_at" timestamp(6) with time zone,
  "source_snapshot" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

CREATE INDEX "user_membership_subscription_user_status_ends_at_idx"
  ON "user_membership_subscription" ("user_id", "status", "ends_at");
CREATE INDEX "user_membership_subscription_source_idx"
  ON "user_membership_subscription" ("source_type", "source_id");
CREATE UNIQUE INDEX "user_membership_subscription_payment_order_source_key"
  ON "user_membership_subscription" ("source_type", "source_id")
  WHERE "source_type" = 1 AND "source_id" IS NOT NULL;
CREATE UNIQUE INDEX "user_membership_subscription_vip_trial_coupon_source_key"
  ON "user_membership_subscription" ("source_type", "source_id")
  WHERE "source_type" = 2 AND "source_id" IS NOT NULL;
ALTER TABLE "user_membership_subscription"
  ADD CONSTRAINT "user_membership_subscription_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3));
ALTER TABLE "user_membership_subscription"
  ADD CONSTRAINT "user_membership_subscription_status_valid_chk" CHECK ("status" in (1, 2, 3, 4));
ALTER TABLE "user_membership_subscription"
  ADD CONSTRAINT "user_membership_subscription_time_range_chk" CHECK ("ends_at" > "starts_at");

CREATE TABLE "membership_auto_renew_agreement" (
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

ALTER TABLE "membership_auto_renew_agreement"
  ADD CONSTRAINT "membership_auto_renew_agreement_no_key" UNIQUE ("provider_config_id", "agreement_no");
CREATE INDEX "membership_auto_renew_agreement_user_status_idx"
  ON "membership_auto_renew_agreement" ("user_id", "status");
ALTER TABLE "membership_auto_renew_agreement"
  ADD CONSTRAINT "membership_auto_renew_agreement_channel_valid_chk" CHECK ("channel" in (1, 2));
ALTER TABLE "membership_auto_renew_agreement"
  ADD CONSTRAINT "membership_auto_renew_agreement_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3));
ALTER TABLE "membership_auto_renew_agreement"
  ADD CONSTRAINT "membership_auto_renew_agreement_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5));
ALTER TABLE "membership_auto_renew_agreement"
  ADD CONSTRAINT "membership_auto_renew_agreement_environment_valid_chk" CHECK ("environment" in (1, 2));
ALTER TABLE "membership_auto_renew_agreement"
  ADD CONSTRAINT "membership_auto_renew_agreement_status_valid_chk" CHECK ("status" in (1, 2, 3, 4));

CREATE TABLE "membership_benefit_claim_record" (
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

ALTER TABLE "membership_benefit_claim_record"
  ADD CONSTRAINT "membership_benefit_claim_record_biz_key_key" UNIQUE ("biz_key");
CREATE INDEX "membership_benefit_claim_record_user_benefit_date_idx"
  ON "membership_benefit_claim_record" ("user_id", "benefit_id", "claim_date");
ALTER TABLE "membership_benefit_claim_record"
  ADD CONSTRAINT "membership_benefit_claim_record_status_valid_chk" CHECK ("status" in (1, 2, 3));

CREATE TABLE "user_content_entitlement" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "target_type" smallint NOT NULL,
  "target_id" integer NOT NULL,
  "grant_source" smallint NOT NULL,
  "source_id" integer,
  "source_key" varchar(120),
  "status" smallint DEFAULT 1 NOT NULL,
  "starts_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp(6) with time zone,
  "revoked_at" timestamp(6) with time zone,
  "grant_snapshot" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

CREATE UNIQUE INDEX "user_content_entitlement_purchase_active_unique_idx"
  ON "user_content_entitlement" ("user_id", "target_type", "target_id")
  WHERE "grant_source" = 1 AND "status" = 1;
CREATE UNIQUE INDEX "user_content_entitlement_coupon_source_unique_idx"
  ON "user_content_entitlement" ("grant_source", "source_id")
  WHERE "grant_source" = 2 AND "source_id" IS NOT NULL;
CREATE INDEX "user_content_entitlement_user_target_status_idx"
  ON "user_content_entitlement" ("user_id", "target_type", "target_id", "status");
CREATE INDEX "user_content_entitlement_source_idx"
  ON "user_content_entitlement" ("grant_source", "source_id");
CREATE INDEX "user_content_entitlement_target_status_idx"
  ON "user_content_entitlement" ("target_type", "target_id", "status");
ALTER TABLE "user_content_entitlement"
  ADD CONSTRAINT "user_content_entitlement_target_type_valid_chk" CHECK ("target_type" in (1, 2));
ALTER TABLE "user_content_entitlement"
  ADD CONSTRAINT "user_content_entitlement_grant_source_valid_chk" CHECK ("grant_source" in (1, 2, 3, 4, 5));
ALTER TABLE "user_content_entitlement"
  ADD CONSTRAINT "user_content_entitlement_status_valid_chk" CHECK ("status" in (1, 2, 3));

CREATE TABLE "currency_package" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "package_key" varchar(64) NOT NULL,
  "name" varchar(80) NOT NULL,
  "price" integer NOT NULL,
  "currency_amount" integer NOT NULL,
  "bonus_amount" integer DEFAULT 0 NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "currency_package"
  ADD CONSTRAINT "currency_package_package_key_key" UNIQUE ("package_key");
CREATE INDEX "currency_package_enabled_sort_order_idx"
  ON "currency_package" ("is_enabled", "sort_order");
ALTER TABLE "currency_package"
  ADD CONSTRAINT "currency_package_price_non_negative_chk" CHECK ("price" >= 0);
ALTER TABLE "currency_package"
  ADD CONSTRAINT "currency_package_currency_amount_positive_chk" CHECK ("currency_amount" > 0);
ALTER TABLE "currency_package"
  ADD CONSTRAINT "currency_package_bonus_amount_non_negative_chk" CHECK ("bonus_amount" >= 0);

CREATE TABLE "payment_provider_config" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "channel" smallint NOT NULL,
  "payment_scene" smallint NOT NULL,
  "platform" smallint NOT NULL,
  "environment" smallint NOT NULL,
  "client_app_key" varchar(80) DEFAULT '' NOT NULL,
  "config_name" varchar(120) DEFAULT '' NOT NULL,
  "app_id" varchar(120) DEFAULT '' NOT NULL,
  "mch_id" varchar(120) DEFAULT '' NOT NULL,
  "notify_url" varchar(500),
  "return_url" varchar(500),
  "agreement_notify_url" varchar(500),
  "allowed_return_domains" jsonb,
  "cert_mode" smallint DEFAULT 1 NOT NULL,
  "public_key_ref" varchar(160),
  "private_key_ref" varchar(160),
  "api_v3_key_ref" varchar(160),
  "app_cert_ref" varchar(160),
  "platform_cert_ref" varchar(160),
  "root_cert_ref" varchar(160),
  "config_version" integer DEFAULT 1 NOT NULL,
  "credential_version_ref" varchar(160) NOT NULL,
  "config_metadata" jsonb,
  "supports_auto_renew" boolean DEFAULT false NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

CREATE UNIQUE INDEX "payment_provider_config_enabled_unique_idx"
  ON "payment_provider_config" ("channel", "payment_scene", "platform", "client_app_key", "app_id", "mch_id", "environment")
  WHERE "is_enabled" = true;
CREATE INDEX "payment_provider_config_selection_idx"
  ON "payment_provider_config" ("channel", "payment_scene", "platform", "client_app_key", "environment", "is_enabled", "sort_order");
ALTER TABLE "payment_provider_config"
  ADD CONSTRAINT "payment_provider_config_channel_valid_chk" CHECK ("channel" in (1, 2));
ALTER TABLE "payment_provider_config"
  ADD CONSTRAINT "payment_provider_config_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3));
ALTER TABLE "payment_provider_config"
  ADD CONSTRAINT "payment_provider_config_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5));
ALTER TABLE "payment_provider_config"
  ADD CONSTRAINT "payment_provider_config_environment_valid_chk" CHECK ("environment" in (1, 2));
ALTER TABLE "payment_provider_config"
  ADD CONSTRAINT "payment_provider_config_cert_mode_valid_chk" CHECK ("cert_mode" in (1, 2));
ALTER TABLE "payment_provider_config"
  ADD CONSTRAINT "payment_provider_config_version_positive_chk" CHECK ("config_version" > 0);

CREATE TABLE "payment_order" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "order_no" varchar(80) NOT NULL,
  "user_id" integer NOT NULL,
  "order_type" smallint NOT NULL,
  "channel" smallint NOT NULL,
  "payment_scene" smallint NOT NULL,
  "platform" smallint NOT NULL,
  "environment" smallint NOT NULL,
  "client_app_key" varchar(80) DEFAULT '' NOT NULL,
  "subscription_mode" smallint DEFAULT 1 NOT NULL,
  "auto_renew_agreement_id" integer,
  "status" smallint DEFAULT 1 NOT NULL,
  "payable_amount" integer NOT NULL,
  "paid_amount" integer DEFAULT 0 NOT NULL,
  "target_id" integer NOT NULL,
  "provider_config_id" integer NOT NULL,
  "provider_config_version" integer NOT NULL,
  "credential_version_ref" varchar(160) NOT NULL,
  "config_snapshot" jsonb,
  "client_context" jsonb,
  "client_pay_payload" jsonb,
  "provider_trade_no" varchar(120),
  "notify_payload" jsonb,
  "paid_at" timestamp(6) with time zone,
  "closed_at" timestamp(6) with time zone,
  "refunded_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_order_no_key" UNIQUE ("order_no");
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_provider_trade_no_key" UNIQUE ("provider_trade_no");
CREATE INDEX "payment_order_user_status_created_at_idx"
  ON "payment_order" ("user_id", "status", "created_at");
CREATE INDEX "payment_order_provider_config_status_idx"
  ON "payment_order" ("provider_config_id", "status");
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_type_valid_chk" CHECK ("order_type" in (1, 2));
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_channel_valid_chk" CHECK ("channel" in (1, 2));
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3));
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5));
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_environment_valid_chk" CHECK ("environment" in (1, 2));
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_subscription_mode_valid_chk" CHECK ("subscription_mode" in (1, 2, 3));
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5));
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_payable_amount_non_negative_chk" CHECK ("payable_amount" >= 0);
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_paid_amount_non_negative_chk" CHECK ("paid_amount" >= 0);

CREATE TABLE "ad_provider_config" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "provider" smallint NOT NULL,
  "platform" smallint NOT NULL,
  "environment" smallint NOT NULL,
  "client_app_key" varchar(80) DEFAULT '' NOT NULL,
  "app_id" varchar(120) DEFAULT '' NOT NULL,
  "placement_key" varchar(120) NOT NULL,
  "target_scope" smallint NOT NULL,
  "daily_limit" smallint DEFAULT 0 NOT NULL,
  "config_version" integer DEFAULT 1 NOT NULL,
  "credential_version_ref" varchar(160) NOT NULL,
  "callback_url" varchar(500),
  "config_metadata" jsonb,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

CREATE UNIQUE INDEX "ad_provider_config_enabled_unique_idx"
  ON "ad_provider_config" ("provider", "platform", "client_app_key", "app_id", "placement_key", "environment")
  WHERE "is_enabled" = true;
CREATE INDEX "ad_provider_config_selection_idx"
  ON "ad_provider_config" ("provider", "platform", "client_app_key", "app_id", "placement_key", "environment", "is_enabled");
ALTER TABLE "ad_provider_config"
  ADD CONSTRAINT "ad_provider_config_provider_valid_chk" CHECK ("provider" in (1, 2));
ALTER TABLE "ad_provider_config"
  ADD CONSTRAINT "ad_provider_config_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5));
ALTER TABLE "ad_provider_config"
  ADD CONSTRAINT "ad_provider_config_environment_valid_chk" CHECK ("environment" in (1, 2));
ALTER TABLE "ad_provider_config"
  ADD CONSTRAINT "ad_provider_config_target_scope_valid_chk" CHECK ("target_scope" in (1, 2, 3));
ALTER TABLE "ad_provider_config"
  ADD CONSTRAINT "ad_provider_config_daily_limit_chk" CHECK ("daily_limit" >= 0);

CREATE TABLE "ad_reward_record" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "ad_provider_config_id" integer NOT NULL,
  "ad_provider_config_version" integer NOT NULL,
  "credential_version_ref" varchar(160) NOT NULL,
  "provider_reward_id" varchar(160) NOT NULL,
  "placement_key" varchar(120) NOT NULL,
  "target_type" smallint NOT NULL,
  "target_id" integer NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "client_context" jsonb,
  "raw_notify_payload" jsonb,
  "verify_payload" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "ad_reward_record"
  ADD CONSTRAINT "ad_reward_record_config_reward_key" UNIQUE ("ad_provider_config_id", "provider_reward_id");
CREATE INDEX "ad_reward_record_user_target_status_idx"
  ON "ad_reward_record" ("user_id", "target_type", "target_id", "status");
ALTER TABLE "ad_reward_record"
  ADD CONSTRAINT "ad_reward_record_target_type_valid_chk" CHECK ("target_type" in (1, 2));
ALTER TABLE "ad_reward_record"
  ADD CONSTRAINT "ad_reward_record_status_valid_chk" CHECK ("status" in (1, 2, 3));

CREATE TABLE "coupon_definition" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" varchar(80) NOT NULL,
  "coupon_type" smallint NOT NULL,
  "target_scope" smallint NOT NULL,
  "discount_amount" integer DEFAULT 0 NOT NULL,
  "discount_rate_bps" integer DEFAULT 10000 NOT NULL,
  "usage_limit" integer DEFAULT 1 NOT NULL,
  "valid_days" integer DEFAULT 0 NOT NULL,
  "budget_limit" integer DEFAULT 0 NOT NULL,
  "config_payload" jsonb,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

CREATE INDEX "coupon_definition_type_enabled_idx"
  ON "coupon_definition" ("coupon_type", "is_enabled");
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_coupon_type_valid_chk" CHECK ("coupon_type" in (1, 2, 3, 4, 5));
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_target_scope_valid_chk" CHECK ("target_scope" in (1, 2, 3, 4));
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_discount_amount_non_negative_chk" CHECK ("discount_amount" >= 0);
ALTER TABLE "coupon_definition"
  ADD CONSTRAINT "coupon_definition_discount_rate_range_chk" CHECK ("discount_rate_bps" >= 0 and "discount_rate_bps" <= 10000);

CREATE TABLE "user_coupon_instance" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "coupon_definition_id" integer NOT NULL,
  "coupon_type" smallint NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "remaining_uses" integer NOT NULL,
  "source_type" smallint NOT NULL,
  "source_id" integer,
  "expires_at" timestamp(6) with time zone,
  "grant_snapshot" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

CREATE INDEX "user_coupon_instance_user_status_expires_at_idx"
  ON "user_coupon_instance" ("user_id", "status", "expires_at");
CREATE INDEX "user_coupon_instance_source_idx"
  ON "user_coupon_instance" ("source_type", "source_id");
ALTER TABLE "user_coupon_instance"
  ADD CONSTRAINT "user_coupon_instance_coupon_type_valid_chk" CHECK ("coupon_type" in (1, 2, 3, 4, 5));
ALTER TABLE "user_coupon_instance"
  ADD CONSTRAINT "user_coupon_instance_status_valid_chk" CHECK ("status" in (1, 2, 3, 4));
ALTER TABLE "user_coupon_instance"
  ADD CONSTRAINT "user_coupon_instance_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3, 4));
ALTER TABLE "user_coupon_instance"
  ADD CONSTRAINT "user_coupon_instance_remaining_uses_non_negative_chk" CHECK ("remaining_uses" >= 0);

CREATE TABLE "coupon_redemption_record" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "coupon_instance_id" integer NOT NULL,
  "coupon_type" smallint NOT NULL,
  "target_type" smallint NOT NULL,
  "target_id" integer NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "biz_key" varchar(120) NOT NULL,
  "redemption_snapshot" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "coupon_redemption_record"
  ADD CONSTRAINT "coupon_redemption_record_user_biz_key_key" UNIQUE ("user_id", "biz_key");
CREATE INDEX "coupon_redemption_record_instance_status_idx"
  ON "coupon_redemption_record" ("coupon_instance_id", "status");
CREATE INDEX "coupon_redemption_record_target_idx"
  ON "coupon_redemption_record" ("target_type", "target_id");
ALTER TABLE "coupon_redemption_record"
  ADD CONSTRAINT "coupon_redemption_record_coupon_type_valid_chk" CHECK ("coupon_type" in (1, 2, 3, 4, 5));
ALTER TABLE "coupon_redemption_record"
  ADD CONSTRAINT "coupon_redemption_record_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4));
ALTER TABLE "coupon_redemption_record"
  ADD CONSTRAINT "coupon_redemption_record_status_valid_chk" CHECK ("status" in (1, 2, 3));

ALTER TABLE "user_purchase_record"
  ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_purchase_record"
  ADD COLUMN "coupon_instance_id" integer;
ALTER TABLE "user_purchase_record"
  ADD COLUMN "discount_source" smallint DEFAULT 0 NOT NULL;
ALTER TABLE "user_purchase_record"
  ADD CONSTRAINT "user_purchase_record_discount_amount_non_negative_chk" CHECK ("discount_amount" >= 0);
ALTER TABLE "user_purchase_record"
  ADD CONSTRAINT "user_purchase_record_discount_source_valid_chk" CHECK ("discount_source" in (0, 1));

UPDATE "user_purchase_record"
SET "payment_method" = 4
WHERE "payment_method" = 1;

INSERT INTO "user_content_entitlement" (
  "user_id",
  "target_type",
  "target_id",
  "grant_source",
  "source_id",
  "status",
  "starts_at",
  "grant_snapshot",
  "created_at",
  "updated_at"
)
SELECT
  "user_id",
  "target_type",
  "target_id",
  1,
  "id",
  1,
  "created_at",
  jsonb_build_object(
    'originalPrice', "original_price",
    'paidPrice', "paid_price",
    'payableRate', "payable_rate",
    'paymentMethod', "payment_method",
    'outTradeNo', "out_trade_no",
    'discountAmount', "discount_amount",
    'couponInstanceId', "coupon_instance_id",
    'discountSource', "discount_source"
  ),
  "created_at",
  COALESCE("updated_at", "created_at")
FROM "user_purchase_record"
WHERE "status" = 1
  AND "target_type" in (1, 2)
ON CONFLICT DO NOTHING;

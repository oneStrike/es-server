CREATE TABLE IF NOT EXISTS "payment_provider_credential" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "channel" smallint NOT NULL,
  "credential_type" smallint NOT NULL,
  "credential_ref" varchar(180) NOT NULL,
  "version_label" varchar(80) DEFAULT '' NOT NULL,
  "display_name" varchar(160) DEFAULT '' NOT NULL,
  "masked_identifier" varchar(160) DEFAULT '' NOT NULL,
  "fingerprint" varchar(160) DEFAULT '' NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "expired_at" timestamp(6) with time zone,
  "metadata" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "payment_provider_credential_channel_valid_chk" CHECK ("channel" in (1, 2)),
  CONSTRAINT "payment_provider_credential_type_valid_chk" CHECK ("credential_type" in (1, 2, 3, 4)),
  CONSTRAINT "payment_provider_credential_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_credential_ref_key"
  ON "payment_provider_credential" ("credential_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_credential_option_idx"
  ON "payment_provider_credential" ("channel", "credential_type", "status", "expired_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_provider_certificate" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "channel" smallint NOT NULL,
  "certificate_type" smallint NOT NULL,
  "certificate_ref" varchar(180) NOT NULL,
  "serial_no" varchar(160) DEFAULT '' NOT NULL,
  "version_label" varchar(80) DEFAULT '' NOT NULL,
  "display_name" varchar(160) DEFAULT '' NOT NULL,
  "fingerprint" varchar(160) DEFAULT '' NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "expired_at" timestamp(6) with time zone,
  "metadata" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "payment_provider_certificate_channel_valid_chk" CHECK ("channel" in (1, 2)),
  CONSTRAINT "payment_provider_certificate_type_valid_chk" CHECK ("certificate_type" in (1, 2, 3, 4)),
  CONSTRAINT "payment_provider_certificate_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_certificate_ref_key"
  ON "payment_provider_certificate" ("certificate_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_certificate_option_idx"
  ON "payment_provider_certificate" ("channel", "certificate_type", "status", "expired_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_certificate_serial_idx"
  ON "payment_provider_certificate" ("channel", "serial_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_provider_config_version" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "provider_config_id" integer NOT NULL,
  "config_version" integer NOT NULL,
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
  "allowed_return_domains" jsonb,
  "cert_mode" smallint DEFAULT 1 NOT NULL,
  "app_private_credential_id" integer,
  "alipay_public_credential_id" integer,
  "wechat_api_v3_credential_id" integer,
  "app_certificate_id" integer,
  "platform_certificate_id" integer,
  "root_certificate_id" integer,
  "credential_snapshot" jsonb,
  "config_snapshot" jsonb,
  "status" smallint DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "payment_provider_config_version_number_positive_chk" CHECK ("config_version" > 0),
  CONSTRAINT "payment_provider_config_version_channel_valid_chk" CHECK ("channel" in (1, 2)),
  CONSTRAINT "payment_provider_config_version_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3)),
  CONSTRAINT "payment_provider_config_version_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5)),
  CONSTRAINT "payment_provider_config_version_environment_valid_chk" CHECK ("environment" in (1, 2)),
  CONSTRAINT "payment_provider_config_version_cert_mode_valid_chk" CHECK ("cert_mode" in (1, 2)),
  CONSTRAINT "payment_provider_config_version_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_config_version_key"
  ON "payment_provider_config_version" ("provider_config_id", "config_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_config_version_active_idx"
  ON "payment_provider_config_version" ("provider_config_id", "is_active", "config_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_config_version_selection_idx"
  ON "payment_provider_config_version" ("channel", "payment_scene", "platform", "client_app_key", "environment", "status", "is_active");
--> statement-breakpoint
INSERT INTO "payment_provider_config_version" (
  "provider_config_id",
  "config_version",
  "channel",
  "payment_scene",
  "platform",
  "environment",
  "client_app_key",
  "config_name",
  "app_id",
  "mch_id",
  "notify_url",
  "return_url",
  "allowed_return_domains",
  "cert_mode",
  "credential_snapshot",
  "config_snapshot",
  "status",
  "is_active",
  "updated_at"
)
SELECT
  "id",
  "config_version",
  "channel",
  "payment_scene",
  "platform",
  "environment",
  "client_app_key",
  "config_name",
  "app_id",
  "mch_id",
  "notify_url",
  "return_url",
  "allowed_return_domains",
  "cert_mode",
  jsonb_strip_nulls(jsonb_build_object(
    'credentialVersionRef', "credential_version_ref",
    'publicKeyRef', "public_key_ref",
    'privateKeyRef', "private_key_ref",
    'apiV3KeyRef', "api_v3_key_ref",
    'appCertRef', "app_cert_ref",
    'platformCertRef', "platform_cert_ref",
    'rootCertRef', "root_cert_ref"
  )),
  "config_metadata",
  CASE WHEN "is_enabled" = true THEN 1 ELSE 2 END,
  "is_enabled",
  now()
FROM "payment_provider_config"
ON CONFLICT ("provider_config_id", "config_version") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "payment_order"
  ADD COLUMN IF NOT EXISTS "provider_config_version_id" integer,
  ADD COLUMN IF NOT EXISTS "app_private_credential_id" integer,
  ADD COLUMN IF NOT EXISTS "alipay_public_credential_id" integer,
  ADD COLUMN IF NOT EXISTS "wechat_api_v3_credential_id" integer,
  ADD COLUMN IF NOT EXISTS "provider_certificate_ids" jsonb;
--> statement-breakpoint
UPDATE "payment_order" AS "po"
SET "provider_config_version_id" = "pcv"."id"
FROM "payment_provider_config_version" AS "pcv"
WHERE "po"."provider_config_version_id" IS NULL
  AND "pcv"."provider_config_id" = "po"."provider_config_id"
  AND "pcv"."config_version" = "po"."provider_config_version";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_status_created_at_id_idx"
  ON "payment_order" ("status", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_channel_status_created_at_idx"
  ON "payment_order" ("channel", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_provider_config_status_created_at_idx"
  ON "payment_order" ("provider_config_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_user_created_at_idx"
  ON "payment_order" ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_notify_event" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "channel" smallint NOT NULL,
  "event_type" smallint DEFAULT 4 NOT NULL,
  "payment_order_id" integer,
  "order_no" varchar(80),
  "provider_trade_no" varchar(120),
  "provider_event_id" varchar(160),
  "payload_hash" varchar(128) NOT NULL,
  "headers" jsonb,
  "redacted_payload" jsonb,
  "verify_status" smallint DEFAULT 1 NOT NULL,
  "process_status" smallint DEFAULT 1 NOT NULL,
  "error_code" varchar(80),
  "error_message" varchar(500),
  "received_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "payment_notify_event_channel_valid_chk" CHECK ("channel" in (1, 2)),
  CONSTRAINT "payment_notify_event_type_valid_chk" CHECK ("event_type" in (1, 2, 3, 4)),
  CONSTRAINT "payment_notify_event_verify_status_valid_chk" CHECK ("verify_status" in (1, 2, 3)),
  CONSTRAINT "payment_notify_event_process_status_valid_chk" CHECK ("process_status" in (1, 2, 3, 4))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_notify_event_provider_event_key"
  ON "payment_notify_event" ("channel", "provider_event_id")
  WHERE "provider_event_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_notify_event_payload_hash_key"
  ON "payment_notify_event" ("channel", "payload_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_notify_event_order_idx"
  ON "payment_notify_event" ("order_no", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_notify_event_trade_idx"
  ON "payment_notify_event" ("provider_trade_no", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_notify_event_status_idx"
  ON "payment_notify_event" ("verify_status", "process_status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_reconciliation_record" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "payment_order_id" integer,
  "order_no" varchar(80) NOT NULL,
  "channel" smallint NOT NULL,
  "mismatch_type" smallint NOT NULL,
  "status" smallint DEFAULT 1 NOT NULL,
  "local_status" smallint NOT NULL,
  "provider_status" varchar(80) DEFAULT '' NOT NULL,
  "provider_trade_no" varchar(120),
  "local_amount" integer NOT NULL,
  "provider_amount" integer,
  "currency" varchar(16) DEFAULT 'CNY' NOT NULL,
  "evidence" jsonb,
  "handled_remark" varchar(500),
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "payment_reconciliation_record_channel_valid_chk" CHECK ("channel" in (1, 2)),
  CONSTRAINT "payment_reconciliation_record_mismatch_type_valid_chk" CHECK ("mismatch_type" in (1, 2, 3, 4, 5, 6)),
  CONSTRAINT "payment_reconciliation_record_status_valid_chk" CHECK ("status" in (1, 2, 3, 4))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliation_record_status_created_at_idx"
  ON "payment_reconciliation_record" ("status", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliation_record_order_idx"
  ON "payment_reconciliation_record" ("order_no", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliation_record_channel_status_idx"
  ON "payment_reconciliation_record" ("channel", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliation_record_mismatch_status_idx"
  ON "payment_reconciliation_record" ("mismatch_type", "status", "created_at");

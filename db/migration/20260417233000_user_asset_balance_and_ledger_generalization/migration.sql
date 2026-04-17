CREATE TABLE "user_asset_balance" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(64) DEFAULT '' NOT NULL,
  "balance" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "user_asset_balance"
  ADD CONSTRAINT "user_asset_balance_user_id_asset_type_asset_key_key"
  UNIQUE ("user_id", "asset_type", "asset_key");

CREATE INDEX "user_asset_balance_user_id_asset_type_idx"
  ON "user_asset_balance" ("user_id", "asset_type");

ALTER TABLE "user_asset_balance"
  ADD CONSTRAINT "user_asset_balance_asset_type_valid_chk"
  CHECK ("asset_type" in (1, 2, 3, 4, 5));

ALTER TABLE "user_asset_balance"
  ADD CONSTRAINT "user_asset_balance_asset_key_not_blank_chk"
  CHECK (btrim("asset_key") = '' or btrim("asset_key") <> '');

ALTER TABLE "user_asset_balance"
  ADD CONSTRAINT "user_asset_balance_balance_non_negative_chk"
  CHECK ("balance" >= 0);

INSERT INTO "user_asset_balance" (
  "user_id",
  "asset_type",
  "asset_key",
  "balance",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  1,
  '',
  "points",
  "created_at",
  COALESCE("updated_at", "created_at")
FROM "app_user"
WHERE "points" <> 0;

INSERT INTO "user_asset_balance" (
  "user_id",
  "asset_type",
  "asset_key",
  "balance",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  2,
  '',
  "experience",
  "created_at",
  COALESCE("updated_at", "created_at")
FROM "app_user"
WHERE "experience" <> 0;

ALTER TABLE "growth_audit_log"
  ADD COLUMN "asset_key" varchar(64) DEFAULT '' NOT NULL;

ALTER TABLE "growth_audit_log"
  DROP CONSTRAINT IF EXISTS "growth_audit_log_asset_type_valid_chk";

ALTER TABLE "growth_audit_log"
  ADD CONSTRAINT "growth_audit_log_asset_type_valid_chk"
  CHECK ("asset_type" in (1, 2, 3, 4, 5));

ALTER TABLE "growth_ledger_record"
  ADD COLUMN "asset_key" varchar(64) DEFAULT '' NOT NULL;

CREATE INDEX "growth_ledger_record_user_id_asset_type_asset_key_created_idx"
  ON "growth_ledger_record" ("user_id", "asset_type", "asset_key", "created_at");

CREATE INDEX "growth_ledger_record_rule_type_asset_type_created_at_idx"
  ON "growth_ledger_record" ("rule_type", "asset_type", "created_at");

CREATE TABLE "growth_rule_usage_counter" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(64) DEFAULT '' NOT NULL,
  "rule_key" varchar(80) NOT NULL,
  "scope_type" smallint NOT NULL,
  "scope_key" varchar(60) NOT NULL,
  "used_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "growth_rule_usage_counter"
  ADD CONSTRAINT "growth_rule_usage_counter_user_id_asset_type_asset_key_rul_key"
  UNIQUE ("user_id", "asset_type", "asset_key", "rule_key", "scope_type", "scope_key");

CREATE INDEX "growth_rule_usage_counter_user_id_asset_type_rule_key_idx"
  ON "growth_rule_usage_counter" ("user_id", "asset_type", "rule_key", "updated_at");

ALTER TABLE "growth_rule_usage_counter"
  ADD CONSTRAINT "growth_rule_usage_counter_asset_type_valid_chk"
  CHECK ("asset_type" in (1, 2, 3, 4, 5));

ALTER TABLE "growth_rule_usage_counter"
  ADD CONSTRAINT "growth_rule_usage_counter_scope_type_valid_chk"
  CHECK ("scope_type" in (1, 2, 3));

ALTER TABLE "growth_rule_usage_counter"
  ADD CONSTRAINT "growth_rule_usage_counter_used_count_positive_chk"
  CHECK ("used_count" >= 0);

INSERT INTO "growth_rule_usage_counter" (
  "user_id",
  "asset_type",
  "asset_key",
  "rule_key",
  "scope_type",
  "scope_key",
  "used_count",
  "created_at",
  "updated_at"
)
SELECT
  "user_id",
  "asset_type",
  '',
  "rule_key",
  "slot_type",
  regexp_replace("slot_value", ':[0-9]+$', ''),
  count(*)::integer,
  min("created_at"),
  max("created_at")
FROM "growth_rule_usage_slot"
GROUP BY
  "user_id",
  "asset_type",
  "rule_key",
  "slot_type",
  regexp_replace("slot_value", ':[0-9]+$', '');

ALTER TABLE "app_user"
  DROP COLUMN "points";

ALTER TABLE "app_user"
  DROP COLUMN "experience";

DROP TABLE "growth_rule_usage_slot";

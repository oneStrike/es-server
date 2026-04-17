CREATE TABLE "growth_reward_rule" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "type" smallint NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(64) DEFAULT '' NOT NULL,
  "delta" integer NOT NULL,
  "daily_limit" integer DEFAULT 0 NOT NULL,
  "total_limit" integer DEFAULT 0 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "remark" varchar(500),
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL
);

ALTER TABLE "growth_reward_rule"
  ADD CONSTRAINT "growth_reward_rule_type_asset_type_asset_key_key"
  UNIQUE ("type", "asset_type", "asset_key");

ALTER TABLE "growth_reward_rule"
  ADD CONSTRAINT "growth_reward_rule_asset_type_valid_chk"
  CHECK ("asset_type" in (1, 2, 3, 4, 5));

ALTER TABLE "growth_reward_rule"
  ADD CONSTRAINT "growth_reward_rule_daily_limit_non_negative_chk"
  CHECK ("daily_limit" >= 0);

ALTER TABLE "growth_reward_rule"
  ADD CONSTRAINT "growth_reward_rule_total_limit_non_negative_chk"
  CHECK ("total_limit" >= 0);

ALTER TABLE "growth_reward_rule"
  ADD CONSTRAINT "growth_reward_rule_delta_non_zero_chk"
  CHECK ("delta" <> 0);

CREATE INDEX "growth_reward_rule_type_idx"
  ON "growth_reward_rule" ("type");

CREATE INDEX "growth_reward_rule_asset_type_idx"
  ON "growth_reward_rule" ("asset_type");

CREATE INDEX "growth_reward_rule_is_enabled_idx"
  ON "growth_reward_rule" ("is_enabled");

INSERT INTO "growth_reward_rule" (
  "type",
  "asset_type",
  "asset_key",
  "delta",
  "daily_limit",
  "total_limit",
  "is_enabled",
  "remark",
  "created_at",
  "updated_at"
)
SELECT
  "type",
  1 AS "asset_type",
  '' AS "asset_key",
  "points" AS "delta",
  "daily_limit",
  "total_limit",
  "is_enabled",
  "remark",
  "created_at",
  "updated_at"
FROM "user_point_rule";

INSERT INTO "growth_reward_rule" (
  "type",
  "asset_type",
  "asset_key",
  "delta",
  "daily_limit",
  "total_limit",
  "is_enabled",
  "remark",
  "created_at",
  "updated_at"
)
SELECT
  "type",
  2 AS "asset_type",
  '' AS "asset_key",
  "experience" AS "delta",
  "daily_limit",
  "total_limit",
  "is_enabled",
  "remark",
  "created_at",
  "updated_at"
FROM "user_experience_rule";

DROP TABLE "user_point_rule";
DROP TABLE "user_experience_rule";

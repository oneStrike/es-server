ALTER TABLE IF EXISTS "check_in_daily_streak_config"
  DROP COLUMN IF EXISTS "reward_rules";

CREATE TABLE IF NOT EXISTS "check_in_daily_streak_rule" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "config_id" integer NOT NULL,
  "rule_code" varchar(50) NOT NULL,
  "streak_days" integer NOT NULL,
  "repeatable" boolean NOT NULL DEFAULT false,
  "status" smallint NOT NULL DEFAULT 1,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_config_streak_days_key'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule"
      ADD CONSTRAINT "check_in_daily_streak_rule_config_streak_days_key"
      UNIQUE ("config_id", "streak_days");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_config_rule_code_key'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule"
      ADD CONSTRAINT "check_in_daily_streak_rule_config_rule_code_key"
      UNIQUE ("config_id", "rule_code");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_config_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule"
      ADD CONSTRAINT "check_in_daily_streak_rule_config_id_positive_chk"
      CHECK ("config_id" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_streak_days_positive_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule"
      ADD CONSTRAINT "check_in_daily_streak_rule_streak_days_positive_chk"
      CHECK ("streak_days" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_status_valid_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule"
      ADD CONSTRAINT "check_in_daily_streak_rule_status_valid_chk"
      CHECK ("status" in (0, 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_rule_code_not_blank_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule"
      ADD CONSTRAINT "check_in_daily_streak_rule_rule_code_not_blank_chk"
      CHECK (btrim("rule_code") <> '');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "check_in_daily_streak_rule_config_id_idx"
  ON "check_in_daily_streak_rule" ("config_id");

CREATE TABLE IF NOT EXISTS "check_in_daily_streak_rule_reward_item" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "rule_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(50) NOT NULL DEFAULT '',
  "amount" integer NOT NULL,
  "sort_order" smallint NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_reward_item_rule_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_rule_id_positive_chk"
      CHECK ("rule_id" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_reward_item_asset_type_valid_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_asset_type_valid_chk"
      CHECK ("asset_type" in (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_reward_item_amount_positive_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_amount_positive_chk"
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_daily_streak_rule_reward_item_sort_order_non_negative_chk'
  ) THEN
    ALTER TABLE "check_in_daily_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_sort_order_non_negative_chk"
      CHECK ("sort_order" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "check_in_daily_streak_rule_reward_item_rule_id_idx"
  ON "check_in_daily_streak_rule_reward_item" ("rule_id");

ALTER TABLE IF EXISTS "check_in_activity_streak"
  DROP COLUMN IF EXISTS "reward_rules";

CREATE TABLE IF NOT EXISTS "check_in_activity_streak_rule" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "activity_id" integer NOT NULL,
  "rule_code" varchar(50) NOT NULL,
  "streak_days" integer NOT NULL,
  "repeatable" boolean NOT NULL DEFAULT false,
  "status" smallint NOT NULL DEFAULT 1,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_activity_streak_days_key'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule"
      ADD CONSTRAINT "check_in_activity_streak_rule_activity_streak_days_key"
      UNIQUE ("activity_id", "streak_days");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_activity_rule_code_key'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule"
      ADD CONSTRAINT "check_in_activity_streak_rule_activity_rule_code_key"
      UNIQUE ("activity_id", "rule_code");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_activity_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule"
      ADD CONSTRAINT "check_in_activity_streak_rule_activity_id_positive_chk"
      CHECK ("activity_id" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_streak_days_positive_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule"
      ADD CONSTRAINT "check_in_activity_streak_rule_streak_days_positive_chk"
      CHECK ("streak_days" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_status_valid_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule"
      ADD CONSTRAINT "check_in_activity_streak_rule_status_valid_chk"
      CHECK ("status" in (0, 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_rule_code_not_blank_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule"
      ADD CONSTRAINT "check_in_activity_streak_rule_rule_code_not_blank_chk"
      CHECK (btrim("rule_code") <> '');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "check_in_activity_streak_rule_activity_id_idx"
  ON "check_in_activity_streak_rule" ("activity_id");

CREATE TABLE IF NOT EXISTS "check_in_activity_streak_rule_reward_item" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "rule_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(50) NOT NULL DEFAULT '',
  "amount" integer NOT NULL,
  "sort_order" smallint NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_reward_item_rule_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_rule_id_positive_chk"
      CHECK ("rule_id" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_reward_item_asset_type_valid_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_asset_type_valid_chk"
      CHECK ("asset_type" in (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_reward_item_amount_positive_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_amount_positive_chk"
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_activity_streak_rule_reward_item_sort_order_non_negative_chk'
  ) THEN
    ALTER TABLE "check_in_activity_streak_rule_reward_item"
      ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_sort_order_non_negative_chk"
      CHECK ("sort_order" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "check_in_activity_streak_rule_reward_item_rule_id_idx"
  ON "check_in_activity_streak_rule_reward_item" ("rule_id");

ALTER TABLE IF EXISTS "check_in_streak_grant"
  ADD COLUMN IF NOT EXISTS "daily_rule_id" integer,
  ADD COLUMN IF NOT EXISTS "activity_rule_id" integer,
  DROP COLUMN IF EXISTS "reward_items";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_streak_grant_daily_rule_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_streak_grant"
      ADD CONSTRAINT "check_in_streak_grant_daily_rule_id_positive_chk"
      CHECK ("daily_rule_id" is null or "daily_rule_id" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_streak_grant_activity_rule_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_streak_grant"
      ADD CONSTRAINT "check_in_streak_grant_activity_rule_id_positive_chk"
      CHECK ("activity_rule_id" is null or "activity_rule_id" > 0);
  END IF;
END $$;

ALTER TABLE IF EXISTS "check_in_streak_grant"
  DROP CONSTRAINT IF EXISTS "check_in_streak_grant_scope_ref_consistent_chk";

ALTER TABLE "check_in_streak_grant"
  ADD CONSTRAINT "check_in_streak_grant_scope_ref_consistent_chk" CHECK ((
    "scope_type" = 1
    and "config_version_id" is not null
    and "daily_rule_id" is not null
    and "activity_id" is null
    and "activity_rule_id" is null
  ) or (
    "scope_type" = 2
    and "config_version_id" is null
    and "daily_rule_id" is null
    and "activity_id" is not null
    and "activity_rule_id" is not null
  ));

CREATE INDEX IF NOT EXISTS "check_in_streak_grant_daily_rule_id_idx"
  ON "check_in_streak_grant" ("daily_rule_id");
CREATE INDEX IF NOT EXISTS "check_in_streak_grant_activity_rule_id_idx"
  ON "check_in_streak_grant" ("activity_rule_id");

CREATE TABLE IF NOT EXISTS "check_in_streak_grant_reward_item" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "grant_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(50) NOT NULL DEFAULT '',
  "amount" integer NOT NULL,
  "sort_order" smallint NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_streak_grant_reward_item_grant_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_streak_grant_reward_item"
      ADD CONSTRAINT "check_in_streak_grant_reward_item_grant_id_positive_chk"
      CHECK ("grant_id" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_streak_grant_reward_item_asset_type_valid_chk'
  ) THEN
    ALTER TABLE "check_in_streak_grant_reward_item"
      ADD CONSTRAINT "check_in_streak_grant_reward_item_asset_type_valid_chk"
      CHECK ("asset_type" in (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_streak_grant_reward_item_amount_positive_chk'
  ) THEN
    ALTER TABLE "check_in_streak_grant_reward_item"
      ADD CONSTRAINT "check_in_streak_grant_reward_item_amount_positive_chk"
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_in_streak_grant_reward_item_sort_order_non_negative_chk'
  ) THEN
    ALTER TABLE "check_in_streak_grant_reward_item"
      ADD CONSTRAINT "check_in_streak_grant_reward_item_sort_order_non_negative_chk"
      CHECK ("sort_order" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "check_in_streak_grant_reward_item_grant_id_idx"
  ON "check_in_streak_grant_reward_item" ("grant_id");

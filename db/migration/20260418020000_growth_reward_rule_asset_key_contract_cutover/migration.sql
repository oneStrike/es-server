CREATE TEMP TABLE "_legacy_extended_asset_key_map" (
  "asset_type" smallint PRIMARY KEY,
  "asset_key" varchar(64) NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  asset_type_value smallint;
  candidate_key varchar(64);
  candidate_index integer;
BEGIN
  FOREACH asset_type_value IN ARRAY ARRAY[3, 4, 5] LOOP
    candidate_key := format('__legacy_asset_type_%s__', asset_type_value);
    candidate_index := 0;

    WHILE
      EXISTS (
        SELECT 1
        FROM "growth_reward_rule"
        WHERE "asset_type" = asset_type_value
          AND "asset_key" = candidate_key
      )
      OR EXISTS (
        SELECT 1
        FROM "growth_ledger_record"
        WHERE "asset_type" = asset_type_value
          AND "asset_key" = candidate_key
      )
      OR EXISTS (
        SELECT 1
        FROM "growth_audit_log"
        WHERE "asset_type" = asset_type_value
          AND "asset_key" = candidate_key
      )
      OR EXISTS (
        SELECT 1
        FROM "growth_rule_usage_counter"
        WHERE "asset_type" = asset_type_value
          AND "asset_key" = candidate_key
      )
      OR EXISTS (
        SELECT 1
        FROM "user_asset_balance"
        WHERE "asset_type" = asset_type_value
          AND "asset_key" = candidate_key
      )
    LOOP
      candidate_index := candidate_index + 1;
      candidate_key := format(
        '__legacy_asset_type_%s_%s__',
        asset_type_value,
        candidate_index
      );
    END LOOP;

    INSERT INTO "_legacy_extended_asset_key_map" ("asset_type", "asset_key")
    VALUES (asset_type_value, candidate_key);
  END LOOP;
END
$$;

CREATE TEMP TABLE "_legacy_core_rule_canonical" AS
SELECT DISTINCT ON ("type", "asset_type")
  "id" AS "canonical_id",
  "type",
  "asset_type"
FROM "growth_reward_rule"
WHERE "asset_type" IN (1, 2)
ORDER BY
  "type",
  "asset_type",
  "updated_at" DESC,
  "id" DESC;

CREATE TEMP TABLE "_legacy_core_rule_duplicate" AS
SELECT
  "rule"."id" AS "duplicate_id",
  "canonical"."canonical_id"
FROM "growth_reward_rule" AS "rule"
INNER JOIN "_legacy_core_rule_canonical" AS "canonical"
  ON "canonical"."type" = "rule"."type"
  AND "canonical"."asset_type" = "rule"."asset_type"
WHERE "rule"."asset_type" IN (1, 2)
  AND "rule"."id" <> "canonical"."canonical_id";

UPDATE "growth_ledger_record" AS "record"
SET "rule_id" = "duplicate"."canonical_id"
FROM "_legacy_core_rule_duplicate" AS "duplicate"
WHERE "record"."rule_id" = "duplicate"."duplicate_id";

DELETE FROM "growth_reward_rule" AS "rule"
USING "_legacy_core_rule_duplicate" AS "duplicate"
WHERE "rule"."id" = "duplicate"."duplicate_id";

UPDATE "growth_reward_rule"
SET "asset_key" = ''
WHERE "asset_type" IN (1, 2)
  AND btrim("asset_key") <> '';

UPDATE "growth_ledger_record"
SET "asset_key" = ''
WHERE "asset_type" IN (1, 2)
  AND btrim("asset_key") <> '';

UPDATE "growth_audit_log"
SET "asset_key" = ''
WHERE "asset_type" IN (1, 2)
  AND btrim("asset_key") <> '';

CREATE TEMP TABLE "_legacy_core_balance" AS
SELECT
  "user_id",
  "asset_type",
  ''::varchar(64) AS "asset_key",
  SUM("balance") AS "balance",
  MIN("created_at") AS "created_at",
  MAX("updated_at") AS "updated_at"
FROM "user_asset_balance"
WHERE "asset_type" IN (1, 2)
GROUP BY "user_id", "asset_type";

DELETE FROM "user_asset_balance"
WHERE "asset_type" IN (1, 2);

INSERT INTO "user_asset_balance" (
  "user_id",
  "asset_type",
  "asset_key",
  "balance",
  "created_at",
  "updated_at"
)
SELECT
  "user_id",
  "asset_type",
  "asset_key",
  "balance",
  "created_at",
  "updated_at"
FROM "_legacy_core_balance";

CREATE TEMP TABLE "_legacy_core_usage_counter" AS
SELECT
  "user_id",
  "asset_type",
  ''::varchar(64) AS "asset_key",
  "rule_key",
  "scope_type",
  "scope_key",
  SUM("used_count") AS "used_count",
  MIN("created_at") AS "created_at",
  MAX("updated_at") AS "updated_at"
FROM "growth_rule_usage_counter"
WHERE "asset_type" IN (1, 2)
GROUP BY
  "user_id",
  "asset_type",
  "rule_key",
  "scope_type",
  "scope_key";

DELETE FROM "growth_rule_usage_counter"
WHERE "asset_type" IN (1, 2);

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
  "asset_key",
  "rule_key",
  "scope_type",
  "scope_key",
  "used_count",
  "created_at",
  "updated_at"
FROM "_legacy_core_usage_counter";

UPDATE "growth_reward_rule" AS "rule"
SET "asset_key" = "mapping"."asset_key"
FROM "_legacy_extended_asset_key_map" AS "mapping"
WHERE "rule"."asset_type" = "mapping"."asset_type"
  AND btrim("rule"."asset_key") = '';

UPDATE "growth_ledger_record" AS "record"
SET "asset_key" = "mapping"."asset_key"
FROM "_legacy_extended_asset_key_map" AS "mapping"
WHERE "record"."asset_type" = "mapping"."asset_type"
  AND btrim("record"."asset_key") = '';

UPDATE "growth_audit_log" AS "log"
SET "asset_key" = "mapping"."asset_key"
FROM "_legacy_extended_asset_key_map" AS "mapping"
WHERE "log"."asset_type" = "mapping"."asset_type"
  AND btrim("log"."asset_key") = '';

UPDATE "growth_rule_usage_counter" AS "counter"
SET "asset_key" = "mapping"."asset_key"
FROM "_legacy_extended_asset_key_map" AS "mapping"
WHERE "counter"."asset_type" = "mapping"."asset_type"
  AND btrim("counter"."asset_key") = '';

UPDATE "user_asset_balance" AS "balance"
SET "asset_key" = "mapping"."asset_key"
FROM "_legacy_extended_asset_key_map" AS "mapping"
WHERE "balance"."asset_type" = "mapping"."asset_type"
  AND btrim("balance"."asset_key") = '';

ALTER TABLE "growth_reward_rule"
  DROP CONSTRAINT IF EXISTS "growth_reward_rule_asset_key_not_blank_chk";

ALTER TABLE "growth_reward_rule"
  ADD CONSTRAINT "growth_reward_rule_asset_key_not_blank_chk"
  CHECK ((
    ("asset_type" in (1, 2) and btrim("asset_key") = '')
    or ("asset_type" in (3, 4, 5) and btrim("asset_key") <> '')
  ));

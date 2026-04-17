CREATE TABLE "growth_reward_settlement" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "biz_key" varchar(160) NOT NULL,
  "settlement_type" smallint NOT NULL,
  "source" varchar(40) NOT NULL,
  "source_record_id" integer,
  "event_code" integer,
  "event_key" varchar(80),
  "target_type" smallint,
  "target_id" integer,
  "event_occurred_at" timestamp (6) with time zone NOT NULL,
  "settlement_status" smallint DEFAULT 0 NOT NULL,
  "settlement_result_type" smallint,
  "ledger_record_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "last_retry_at" timestamp (6) with time zone,
  "settled_at" timestamp (6) with time zone,
  "last_error" varchar(500),
  "request_payload" jsonb NOT NULL,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL
);

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_user_biz_key_key"
  UNIQUE ("user_id", "biz_key");

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_user_id_positive_chk"
  CHECK ("user_id" > 0);

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_type_valid_chk"
  CHECK ("settlement_type" in (1, 2));

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_source_record_id_positive_chk"
  CHECK ("source_record_id" is null or "source_record_id" > 0);

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_event_code_positive_chk"
  CHECK ("event_code" is null or "event_code" > 0);

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_biz_key_not_blank_chk"
  CHECK (btrim("biz_key") <> '');

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_event_key_not_blank_chk"
  CHECK ("event_key" is null or btrim("event_key") <> '');

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_source_not_blank_chk"
  CHECK (btrim("source") <> '');

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_status_valid_chk"
  CHECK ("settlement_status" in (0, 1, 2));

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_result_type_valid_chk"
  CHECK ("settlement_result_type" is null or "settlement_result_type" in (1, 2, 3));

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_retry_count_non_negative_chk"
  CHECK ("retry_count" >= 0);

CREATE INDEX "growth_reward_settlement_status_created_at_idx"
  ON "growth_reward_settlement" ("settlement_status", "created_at");

CREATE INDEX "growth_reward_settlement_type_status_created_at_idx"
  ON "growth_reward_settlement" ("settlement_type", "settlement_status", "created_at");

CREATE INDEX "growth_reward_settlement_user_id_status_created_at_idx"
  ON "growth_reward_settlement" ("user_id", "settlement_status", "created_at");

CREATE INDEX "growth_reward_settlement_source_record_id_idx"
  ON "growth_reward_settlement" ("source_record_id");

CREATE INDEX "growth_reward_settlement_event_code_created_at_idx"
  ON "growth_reward_settlement" ("event_code", "created_at");

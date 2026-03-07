/*
  Warnings:

  - You are about to drop the `user_growth_event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_growth_event_archive` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_growth_event" DROP CONSTRAINT "user_growth_event_user_id_fkey";

-- DropTable
DROP TABLE "user_growth_event";

-- DropTable
DROP TABLE "user_growth_event_archive";

-- CreateTable
CREATE TABLE "growth_audit_log" (
    "id" SERIAL NOT NULL,
    "request_id" VARCHAR(80),
    "user_id" INTEGER NOT NULL,
    "biz_key" VARCHAR(120) NOT NULL,
    "asset_type" VARCHAR(30) NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "rule_type" SMALLINT,
    "decision" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(80),
    "delta_requested" INTEGER,
    "delta_applied" INTEGER,
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_ledger_record" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "asset_type" VARCHAR(30) NOT NULL,
    "delta" INTEGER NOT NULL,
    "before_value" INTEGER NOT NULL,
    "after_value" INTEGER NOT NULL,
    "biz_key" VARCHAR(120) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "rule_type" SMALLINT,
    "rule_id" INTEGER,
    "target_type" SMALLINT,
    "target_id" INTEGER,
    "remark" VARCHAR(500),
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_ledger_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_rule_usage_slot" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "asset_type" VARCHAR(30) NOT NULL,
    "rule_key" VARCHAR(80) NOT NULL,
    "slot_type" VARCHAR(20) NOT NULL,
    "slot_value" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_rule_usage_slot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "growth_audit_log_user_id_biz_key_idx" ON "growth_audit_log"("user_id", "biz_key");

-- CreateIndex
CREATE INDEX "growth_audit_log_asset_type_action_decision_created_at_idx" ON "growth_audit_log"("asset_type", "action", "decision", "created_at");

-- CreateIndex
CREATE INDEX "growth_audit_log_request_id_idx" ON "growth_audit_log"("request_id");

-- CreateIndex
CREATE INDEX "growth_ledger_record_user_id_asset_type_created_at_idx" ON "growth_ledger_record"("user_id", "asset_type", "created_at");

-- CreateIndex
CREATE INDEX "growth_ledger_record_source_created_at_idx" ON "growth_ledger_record"("source", "created_at");

-- CreateIndex
CREATE INDEX "growth_ledger_record_target_type_target_id_idx" ON "growth_ledger_record"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "growth_ledger_record_user_id_biz_key_key" ON "growth_ledger_record"("user_id", "biz_key");

-- CreateIndex
CREATE INDEX "growth_rule_usage_slot_user_id_asset_type_rule_key_created__idx" ON "growth_rule_usage_slot"("user_id", "asset_type", "rule_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "growth_rule_usage_slot_user_id_asset_type_rule_key_slot_typ_key" ON "growth_rule_usage_slot"("user_id", "asset_type", "rule_key", "slot_type", "slot_value");

-- AddForeignKey
ALTER TABLE "growth_audit_log" ADD CONSTRAINT "growth_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_ledger_record" ADD CONSTRAINT "growth_ledger_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_rule_usage_slot" ADD CONSTRAINT "growth_rule_usage_slot_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

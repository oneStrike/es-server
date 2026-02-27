-- AlterTable
ALTER TABLE "user_point_record" ADD COLUMN     "exchange_id" INTEGER,
ADD COLUMN     "target_id" INTEGER,
ADD COLUMN     "target_type" SMALLINT;

-- AlterTable
ALTER TABLE "work" ADD COLUMN     "can_exchange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chapter_exchange_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chapter_price" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "required_view_level_id" INTEGER,
ADD COLUMN     "view_rule" SMALLINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work_chapter" ADD COLUMN     "can_exchange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exchange_points" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "read_rule" SET DEFAULT -1;

-- CreateTable
CREATE TABLE "user_balance_record" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "before_balance" INTEGER NOT NULL,
    "after_balance" INTEGER NOT NULL,
    "type" SMALLINT NOT NULL,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_balance_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_balance_record_user_id_idx" ON "user_balance_record"("user_id");

-- CreateIndex
CREATE INDEX "user_balance_record_created_at_idx" ON "user_balance_record"("created_at");

-- CreateIndex
CREATE INDEX "user_balance_record_type_idx" ON "user_balance_record"("type");

-- CreateIndex
CREATE INDEX "user_point_record_target_type_target_id_idx" ON "user_point_record"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_point_record_exchange_id_idx" ON "user_point_record"("exchange_id");

-- CreateIndex
CREATE INDEX "work_view_rule_idx" ON "work"("view_rule");

-- CreateIndex
CREATE INDEX "work_required_view_level_id_idx" ON "work"("required_view_level_id");

-- AddForeignKey
ALTER TABLE "user_balance_record" ADD CONSTRAINT "user_balance_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work" ADD CONSTRAINT "work_required_view_level_id_fkey" FOREIGN KEY ("required_view_level_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

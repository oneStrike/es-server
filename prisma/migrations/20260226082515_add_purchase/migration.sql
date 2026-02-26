-- DropIndex
DROP INDEX "user_download_record_target_type_target_id_user_id_key";

-- CreateTable
CREATE TABLE "user_purchase_record" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "payment_method" SMALLINT NOT NULL,
    "out_trade_no" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_purchase_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_purchase_record_target_type_target_id_idx" ON "user_purchase_record"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_purchase_record_user_id_idx" ON "user_purchase_record"("user_id");

-- CreateIndex
CREATE INDEX "user_purchase_record_status_idx" ON "user_purchase_record"("status");

-- CreateIndex
CREATE INDEX "user_purchase_record_created_at_idx" ON "user_purchase_record"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_purchase_record_target_type_target_id_user_id_status_key" ON "user_purchase_record"("target_type", "target_id", "user_id", "status");

-- AddForeignKey
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "user_purchase_record_user_id_status_target_type_created_at_target_id_idx"
ON "user_purchase_record"("user_id", "status", "target_type", "created_at", "target_id");

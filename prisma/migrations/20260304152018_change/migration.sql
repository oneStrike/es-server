-- AlterTable
ALTER TABLE "sys_dictionary_item" ALTER COLUMN "sort_order" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "user_comment_target_type_target_id_reply_to_id_floor_idx" ON "user_comment"("target_type", "target_id", "reply_to_id", "floor");

-- CreateIndex
CREATE INDEX "user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx" ON "user_comment"("actual_reply_to_id", "audit_status", "is_hidden", "deleted_at", "created_at");

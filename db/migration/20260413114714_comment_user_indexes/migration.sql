CREATE INDEX "user_comment_user_id_created_at_desc_idx"
ON "user_comment" ("user_id", "created_at" DESC);

CREATE INDEX "user_comment_user_id_deleted_at_created_at_desc_idx"
ON "user_comment" ("user_id", "deleted_at", "created_at" DESC);

ALTER TABLE "user_view" RENAME TO "user_browse_log";

ALTER TABLE "user_browse_log" RENAME CONSTRAINT "user_view_pkey" TO "user_browse_log_pkey";
ALTER TABLE "user_browse_log" RENAME CONSTRAINT "user_view_user_id_fkey" TO "user_browse_log_user_id_fkey";

ALTER INDEX "user_view_target_type_target_id_idx" RENAME TO "user_browse_log_target_type_target_id_idx";
ALTER INDEX "user_view_user_id_idx" RENAME TO "user_browse_log_user_id_idx";
ALTER INDEX "user_view_viewed_at_idx" RENAME TO "user_browse_log_viewed_at_idx";
ALTER INDEX "user_view_target_type_target_id_user_id_idx" RENAME TO "user_browse_log_target_type_target_id_user_id_idx";
ALTER INDEX "user_view_user_id_viewed_at_idx" RENAME TO "user_browse_log_user_id_viewed_at_idx";

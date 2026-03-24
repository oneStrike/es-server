ALTER TABLE "work"
  RENAME COLUMN "ageRating" TO "age_rating";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "serialStatus" TO "serial_status";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "originalSource" TO "original_source";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "isPublished" TO "is_published";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "isRecommended" TO "is_recommended";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "isHot" TO "is_hot";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "isNew" TO "is_new";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "publishAt" TO "publish_at";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "lastUpdated" TO "last_updated";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "recommendWeight" TO "recommend_weight";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "viewCount" TO "view_count";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "favoriteCount" TO "favorite_count";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "likeCount" TO "like_count";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "downloadCount" TO "download_count";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "createdAt" TO "created_at";
--> statement-breakpoint
ALTER TABLE "work"
  RENAME COLUMN "updatedAt" TO "updated_at";
--> statement-breakpoint
ALTER INDEX "work_isPublished_publishAt_idx"
  RENAME TO "work_is_published_publish_at_idx";
--> statement-breakpoint
ALTER INDEX "work_serialStatus_idx"
  RENAME TO "work_serial_status_idx";
--> statement-breakpoint
ALTER INDEX "work_lastUpdated_idx"
  RENAME TO "work_last_updated_idx";
--> statement-breakpoint
ALTER INDEX "work_isRecommended_idx"
  RENAME TO "work_is_recommended_idx";
--> statement-breakpoint
ALTER INDEX "work_isHot_isNew_idx"
  RENAME TO "work_is_hot_is_new_idx";
--> statement-breakpoint

ALTER TABLE "work_comic"
  RENAME COLUMN "workId" TO "work_id";
--> statement-breakpoint
ALTER TABLE "work_comic"
  RENAME COLUMN "createdAt" TO "created_at";
--> statement-breakpoint
ALTER TABLE "work_comic"
  RENAME COLUMN "updatedAt" TO "updated_at";
--> statement-breakpoint
ALTER TABLE "work_comic"
  RENAME CONSTRAINT "work_comic_workId_key" TO "work_comic_work_id_key";
--> statement-breakpoint

ALTER TABLE "work_novel"
  RENAME COLUMN "workId" TO "work_id";
--> statement-breakpoint
ALTER TABLE "work_novel"
  RENAME COLUMN "wordCount" TO "word_count";
--> statement-breakpoint
ALTER TABLE "work_novel"
  RENAME COLUMN "createdAt" TO "created_at";
--> statement-breakpoint
ALTER TABLE "work_novel"
  RENAME COLUMN "updatedAt" TO "updated_at";
--> statement-breakpoint
ALTER TABLE "work_novel"
  RENAME CONSTRAINT "work_novel_workId_key" TO "work_novel_work_id_key";
--> statement-breakpoint

ALTER TABLE "forum_tag"
  RENAME COLUMN "sortOrder" TO "sort_order";
--> statement-breakpoint
ALTER INDEX "forum_tag_sortOrder_idx"
  RENAME TO "forum_tag_sort_order_idx";
--> statement-breakpoint

ALTER TABLE "user_badge"
  RENAME COLUMN "sortOrder" TO "sort_order";
--> statement-breakpoint
ALTER INDEX "user_badge_sortOrder_idx"
  RENAME TO "user_badge_sort_order_idx";
--> statement-breakpoint

ALTER TABLE "user_level_rule"
  RENAME COLUMN "sortOrder" TO "sort_order";
--> statement-breakpoint
ALTER INDEX "user_level_rule_is_enabled_sortOrder_idx"
  RENAME TO "user_level_rule_is_enabled_sort_order_idx";

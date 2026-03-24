UPDATE "work"
SET
  "viewCount" = GREATEST("viewCount", 0),
  "favoriteCount" = GREATEST("favoriteCount", 0),
  "likeCount" = GREATEST("likeCount", 0),
  "comment_count" = GREATEST("comment_count", 0),
  "downloadCount" = GREATEST("downloadCount", 0),
  "ratingCount" = GREATEST("ratingCount", 0);
--> statement-breakpoint
UPDATE "work_chapter"
SET
  "view_count" = GREATEST("view_count", 0),
  "like_count" = GREATEST("like_count", 0),
  "comment_count" = GREATEST("comment_count", 0),
  "purchase_count" = GREATEST("purchase_count", 0),
  "download_count" = GREATEST("download_count", 0);
--> statement-breakpoint
UPDATE "forum_topic"
SET
  "view_count" = GREATEST("view_count", 0),
  "reply_count" = GREATEST("reply_count", 0),
  "like_count" = GREATEST("like_count", 0),
  "comment_count" = GREATEST("comment_count", 0),
  "favorite_count" = GREATEST("favorite_count", 0);
--> statement-breakpoint
ALTER TABLE "work"
  ADD CONSTRAINT "work_view_count_non_negative_chk" CHECK ("viewCount" >= 0),
  ADD CONSTRAINT "work_favorite_count_non_negative_chk" CHECK ("favoriteCount" >= 0),
  ADD CONSTRAINT "work_like_count_non_negative_chk" CHECK ("likeCount" >= 0),
  ADD CONSTRAINT "work_comment_count_non_negative_chk" CHECK ("comment_count" >= 0),
  ADD CONSTRAINT "work_download_count_non_negative_chk" CHECK ("downloadCount" >= 0),
  ADD CONSTRAINT "work_rating_count_non_negative_chk" CHECK ("ratingCount" >= 0);
--> statement-breakpoint
ALTER TABLE "work_chapter"
  ADD CONSTRAINT "work_chapter_view_count_non_negative_chk" CHECK ("view_count" >= 0),
  ADD CONSTRAINT "work_chapter_like_count_non_negative_chk" CHECK ("like_count" >= 0),
  ADD CONSTRAINT "work_chapter_comment_count_non_negative_chk" CHECK ("comment_count" >= 0),
  ADD CONSTRAINT "work_chapter_purchase_count_non_negative_chk" CHECK ("purchase_count" >= 0),
  ADD CONSTRAINT "work_chapter_download_count_non_negative_chk" CHECK ("download_count" >= 0);
--> statement-breakpoint
ALTER TABLE "forum_topic"
  ADD CONSTRAINT "forum_topic_view_count_non_negative_chk" CHECK ("view_count" >= 0),
  ADD CONSTRAINT "forum_topic_reply_count_non_negative_chk" CHECK ("reply_count" >= 0),
  ADD CONSTRAINT "forum_topic_like_count_non_negative_chk" CHECK ("like_count" >= 0),
  ADD CONSTRAINT "forum_topic_comment_count_non_negative_chk" CHECK ("comment_count" >= 0),
  ADD CONSTRAINT "forum_topic_favorite_count_non_negative_chk" CHECK ("favorite_count" >= 0);

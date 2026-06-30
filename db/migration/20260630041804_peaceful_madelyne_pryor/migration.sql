UPDATE "app_user_count"
SET
  "comment_count" = greatest("comment_count", 0),
  "like_count" = greatest("like_count", 0),
  "favorite_count" = greatest("favorite_count", 0),
  "following_user_count" = greatest("following_user_count", 0),
  "following_author_count" = greatest("following_author_count", 0),
  "following_section_count" = greatest("following_section_count", 0),
  "following_hashtag_count" = greatest("following_hashtag_count", 0),
  "followers_count" = greatest("followers_count", 0),
  "forum_topic_count" = greatest("forum_topic_count", 0),
  "comment_received_like_count" = greatest("comment_received_like_count", 0),
  "forum_topic_received_like_count" = greatest("forum_topic_received_like_count", 0),
  "forum_topic_received_favorite_count" = greatest("forum_topic_received_favorite_count", 0)
WHERE
  "comment_count" < 0
  OR "like_count" < 0
  OR "favorite_count" < 0
  OR "following_user_count" < 0
  OR "following_author_count" < 0
  OR "following_section_count" < 0
  OR "following_hashtag_count" < 0
  OR "followers_count" < 0
  OR "forum_topic_count" < 0
  OR "comment_received_like_count" < 0
  OR "forum_topic_received_like_count" < 0
  OR "forum_topic_received_favorite_count" < 0;--> statement-breakpoint
UPDATE "user_comment"
SET "like_count" = greatest("like_count", 0)
WHERE "like_count" < 0;--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_comment_count_non_negative_chk" CHECK ("comment_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_like_count_non_negative_chk" CHECK ("like_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_favorite_count_non_negative_chk" CHECK ("favorite_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_following_user_count_non_negative_chk" CHECK ("following_user_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_following_author_count_non_negative_chk" CHECK ("following_author_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_following_section_count_non_negative_chk" CHECK ("following_section_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_following_hashtag_count_non_negative_chk" CHECK ("following_hashtag_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_followers_count_non_negative_chk" CHECK ("followers_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_forum_topic_count_non_negative_chk" CHECK ("forum_topic_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_comment_received_like_count_non_negative_chk" CHECK ("comment_received_like_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_forum_topic_received_like_count_non_negative_chk" CHECK ("forum_topic_received_like_count" >= 0);--> statement-breakpoint
ALTER TABLE "app_user_count" ADD CONSTRAINT "app_user_count_forum_topic_received_favorite_count_non_negative_chk" CHECK ("forum_topic_received_favorite_count" >= 0);--> statement-breakpoint
ALTER TABLE "user_comment" ADD CONSTRAINT "user_comment_like_count_non_negative_chk" CHECK ("like_count" >= 0);

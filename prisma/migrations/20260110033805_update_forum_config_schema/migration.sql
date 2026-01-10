/*
  Warnings:

  - You are about to drop the column `captcha_type` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `daily_check_in_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `daily_post_limit` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `daily_reply_limit` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `delete_reply_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `delete_topic_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `enable_captcha` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `enable_search` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `enable_sensitive_word_filter` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `enable_statistics` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `enable_tags` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `ip_rate_limit_per_minute` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `login_fail_lock_count` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `login_fail_lock_minutes` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `max_tags_per_topic` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `new_user_post_limit_hours` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `password_min_length` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `password_require_number` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `password_require_special_char` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `password_require_uppercase` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `post_reply_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `post_topic_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `reply_liked_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `reply_review_policy` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `search_page_size` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `sensitive_word_replace_char` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `statistics_retention_days` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `topic_favorited_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `topic_liked_points` on the `forum_config` table. All the data in the column will be lost.
  - You are about to drop the column `topic_review_policy` on the `forum_config` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "forum_config" DROP COLUMN "captcha_type",
DROP COLUMN "daily_check_in_points",
DROP COLUMN "daily_post_limit",
DROP COLUMN "daily_reply_limit",
DROP COLUMN "delete_reply_points",
DROP COLUMN "delete_topic_points",
DROP COLUMN "enable_captcha",
DROP COLUMN "enable_search",
DROP COLUMN "enable_sensitive_word_filter",
DROP COLUMN "enable_statistics",
DROP COLUMN "enable_tags",
DROP COLUMN "ip_rate_limit_per_minute",
DROP COLUMN "login_fail_lock_count",
DROP COLUMN "login_fail_lock_minutes",
DROP COLUMN "max_tags_per_topic",
DROP COLUMN "new_user_post_limit_hours",
DROP COLUMN "password_min_length",
DROP COLUMN "password_require_number",
DROP COLUMN "password_require_special_char",
DROP COLUMN "password_require_uppercase",
DROP COLUMN "post_reply_points",
DROP COLUMN "post_topic_points",
DROP COLUMN "reply_liked_points",
DROP COLUMN "reply_review_policy",
DROP COLUMN "search_page_size",
DROP COLUMN "sensitive_word_replace_char",
DROP COLUMN "statistics_retention_days",
DROP COLUMN "topic_favorited_points",
DROP COLUMN "topic_liked_points",
DROP COLUMN "topic_review_policy",
ADD COLUMN     "default_points_for_new_user" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "review_policy" INTEGER NOT NULL DEFAULT 1;

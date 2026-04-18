INSERT INTO "notification_template" (
  "category_key",
  "title_template",
  "content_template",
  "is_enabled",
  "remark",
  "updated_at"
)
VALUES
  ('comment_reply', '{{actor.nickname}} 回复了你的评论', '{{data.object.snippet}}', true, 'canonical notification template: 评论回复', now()),
  ('comment_mention', '{{actor.nickname}} 在评论中提到了你', '{{data.object.snippet}}', true, 'canonical notification template: 评论提及', now()),
  ('comment_like', '{{actor.nickname}} 点赞了你的评论', '{{data.object.snippet}}', true, 'canonical notification template: 评论点赞', now()),
  ('topic_like', '{{actor.nickname}} 点赞了你的主题', '{{data.object.title}}', true, 'canonical notification template: 主题点赞', now()),
  ('topic_favorited', '{{actor.nickname}} 收藏了你的主题', '{{data.object.title}}', true, 'canonical notification template: 主题收藏', now()),
  ('topic_commented', '{{actor.nickname}} 评论了你的主题', '{{data.object.snippet}}', true, 'canonical notification template: 主题评论', now()),
  ('topic_mentioned', '{{actor.nickname}} 在主题中提到了你', '{{data.object.title}}', true, 'canonical notification template: 主题提及', now()),
  ('user_followed', '{{actor.nickname}} 关注了你', '{{actor.nickname}} 关注了你', true, 'canonical notification template: 用户关注', now()),
  ('system_announcement', '{{title}}', '{{content}}', true, 'canonical notification template: 系统公告', now()),
  ('task_reminder', '{{title}}', '{{content}}', true, 'canonical notification template: 任务提醒', now())
ON CONFLICT ("category_key") DO UPDATE
SET
  "title_template" = EXCLUDED."title_template",
  "content_template" = EXCLUDED."content_template",
  "remark" = EXCLUDED."remark",
  "updated_at" = now();

WITH "comment_work_source" AS (
  SELECT
    "n"."id",
    COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer) AS "comment_id",
    COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'targetId')::integer) AS "target_id",
    COALESCE(("n"."payload" -> 'object' ->> 'snippet'), ("n"."payload" ->> 'replyExcerpt'), ("n"."payload" ->> 'commentExcerpt')) AS "comment_snippet",
    "c"."content" AS "comment_content",
    "w"."name" AS "work_name",
    "w"."cover" AS "work_cover",
    "w"."type" AS "work_type"
  FROM "user_notification" AS "n"
  LEFT JOIN "user_comment" AS "c"
    ON "c"."id" = COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer)
  LEFT JOIN "work" AS "w"
    ON "w"."id" = COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'targetId')::integer)
   AND "w"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('comment_reply', 'comment_mention', 'comment_like')
    AND (
      ("n"."payload" -> 'container' ->> 'kind') = 'work'
      OR ("n"."payload" -> 'subject' ->> 'kind') = 'work'
      OR ("n"."payload" ->> 'targetType') IN ('1', '2')
    )
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'object',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'comment',
        'id', "s"."comment_id",
        'snippet', COALESCE("s"."comment_content", "s"."comment_snippet")
      )
    ),
    'container',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'work',
        'id', "s"."target_id",
        'title', "s"."work_name",
        'cover', "s"."work_cover",
        'workType', COALESCE("s"."work_type", ("n"."payload" -> 'subject' -> 'extra' ->> 'type')::integer)
      )
    )
  )
)
FROM "comment_work_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "comment_chapter_source" AS (
  SELECT
    "n"."id",
    COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer) AS "comment_id",
    COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'targetId')::integer) AS "target_id",
    COALESCE(("n"."payload" -> 'object' ->> 'snippet'), ("n"."payload" ->> 'replyExcerpt'), ("n"."payload" ->> 'commentExcerpt')) AS "comment_snippet",
    "uc"."content" AS "comment_content",
    "c"."title" AS "chapter_title",
    "c"."subtitle" AS "chapter_subtitle",
    "c"."cover" AS "chapter_cover",
    "c"."work_id" AS "work_id",
    "c"."work_type" AS "work_type",
    "w"."name" AS "work_name",
    "w"."cover" AS "work_cover",
    "w"."type" AS "resolved_work_type"
  FROM "user_notification" AS "n"
  LEFT JOIN "user_comment" AS "uc"
    ON "uc"."id" = COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer)
  LEFT JOIN "work_chapter" AS "c"
    ON "c"."id" = COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'targetId')::integer)
   AND "c"."deleted_at" IS NULL
  LEFT JOIN "work" AS "w"
    ON "w"."id" = "c"."work_id"
   AND "w"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('comment_reply', 'comment_mention', 'comment_like')
    AND (
      ("n"."payload" -> 'container' ->> 'kind') = 'chapter'
      OR ("n"."payload" -> 'subject' ->> 'kind') = 'chapter'
      OR ("n"."payload" ->> 'targetType') IN ('3', '4')
    )
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'object',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'comment',
        'id', "s"."comment_id",
        'snippet', COALESCE("s"."comment_content", "s"."comment_snippet")
      )
    ),
    'container',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'chapter',
        'id', "s"."target_id",
        'title', "s"."chapter_title",
        'subtitle', "s"."chapter_subtitle",
        'cover', COALESCE("s"."chapter_cover", "s"."work_cover"),
        'workId', COALESCE("s"."work_id", ("n"."payload" -> 'subject' -> 'extra' ->> 'workId')::integer),
        'workType', COALESCE("s"."work_type", ("n"."payload" -> 'subject' -> 'extra' ->> 'workType')::integer)
      )
    )
  )
  || CASE
    WHEN COALESCE("s"."work_id", ("n"."payload" -> 'parentSubject' ->> 'id')::integer) IS NOT NULL THEN jsonb_build_object(
      'parentContainer',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'work',
          'id', COALESCE("s"."work_id", ("n"."payload" -> 'parentSubject' ->> 'id')::integer),
          'title', COALESCE("s"."work_name", "n"."payload" -> 'parentSubject' ->> 'title'),
          'cover', COALESCE("s"."work_cover", "n"."payload" -> 'parentSubject' ->> 'cover'),
          'workType', COALESCE("s"."resolved_work_type", ("n"."payload" -> 'parentSubject' -> 'extra' ->> 'type')::integer)
        )
      )
    )
    ELSE '{}'::jsonb
  END
)
FROM "comment_chapter_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "comment_topic_source" AS (
  SELECT
    "n"."id",
    COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer) AS "comment_id",
    COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'targetId')::integer) AS "target_id",
    COALESCE(("n"."payload" -> 'object' ->> 'snippet'), ("n"."payload" ->> 'replyExcerpt'), ("n"."payload" ->> 'commentExcerpt')) AS "comment_snippet",
    "uc"."content" AS "comment_content",
    "t"."title" AS "topic_title",
    "t"."section_id" AS "section_id",
    "t"."images"[1] AS "topic_cover"
  FROM "user_notification" AS "n"
  LEFT JOIN "user_comment" AS "uc"
    ON "uc"."id" = COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer)
  LEFT JOIN "forum_topic" AS "t"
    ON "t"."id" = COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'targetId')::integer)
   AND "t"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('comment_reply', 'comment_mention', 'comment_like')
    AND (
      ("n"."payload" -> 'container' ->> 'kind') = 'topic'
      OR ("n"."payload" -> 'subject' ->> 'kind') = 'topic'
      OR ("n"."payload" ->> 'targetType') = '5'
    )
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'object',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'comment',
        'id', "s"."comment_id",
        'snippet', COALESCE("s"."comment_content", "s"."comment_snippet")
      )
    ),
    'container',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'topic',
        'id', "s"."target_id",
        'title', "s"."topic_title",
        'cover', "s"."topic_cover",
        'sectionId', COALESCE("s"."section_id", ("n"."payload" -> 'subject' -> 'extra' ->> 'sectionId')::integer)
      )
    )
  )
)
FROM "comment_topic_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "topic_object_source" AS (
  SELECT
    "n"."id",
    COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'topicId')::integer, ("n"."payload" ->> 'targetId')::integer) AS "topic_id",
    "t"."title" AS "topic_title",
    "t"."section_id" AS "section_id",
    "t"."images"[1] AS "topic_cover"
  FROM "user_notification" AS "n"
  LEFT JOIN "forum_topic" AS "t"
    ON "t"."id" = COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'topicId')::integer, ("n"."payload" ->> 'targetId')::integer)
   AND "t"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('topic_like', 'topic_favorited', 'topic_mentioned')
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'object',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'topic',
        'id', "s"."topic_id",
        'title', COALESCE("s"."topic_title", "n"."payload" -> 'object' ->> 'title', "n"."payload" -> 'subject' ->> 'title'),
        'cover', COALESCE("s"."topic_cover", "n"."payload" -> 'object' ->> 'cover', "n"."payload" -> 'subject' ->> 'cover'),
        'sectionId', COALESCE("s"."section_id", ("n"."payload" -> 'object' ->> 'sectionId')::integer, ("n"."payload" -> 'subject' -> 'extra' ->> 'sectionId')::integer)
      )
    )
  )
)
FROM "topic_object_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "topic_commented_source" AS (
  SELECT
    "n"."id",
    COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer) AS "comment_id",
    COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'topicId')::integer, ("n"."payload" ->> 'targetId')::integer) AS "topic_id",
    COALESCE(("n"."payload" -> 'object' ->> 'snippet'), ("n"."payload" ->> 'commentExcerpt')) AS "comment_snippet",
    "uc"."content" AS "comment_content",
    "t"."title" AS "topic_title",
    "t"."section_id" AS "section_id",
    "t"."images"[1] AS "topic_cover"
  FROM "user_notification" AS "n"
  LEFT JOIN "user_comment" AS "uc"
    ON "uc"."id" = COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'commentId')::integer)
  LEFT JOIN "forum_topic" AS "t"
    ON "t"."id" = COALESCE(("n"."payload" -> 'container' ->> 'id')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer, ("n"."payload" ->> 'topicId')::integer, ("n"."payload" ->> 'targetId')::integer)
   AND "t"."deleted_at" IS NULL
  WHERE "n"."category_key" = 'topic_commented'
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'object',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'comment',
        'id', "s"."comment_id",
        'snippet', COALESCE("s"."comment_content", "s"."comment_snippet")
      )
    ),
    'container',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'topic',
        'id', "s"."topic_id",
        'title', COALESCE("s"."topic_title", "n"."payload" -> 'container' ->> 'title', "n"."payload" -> 'subject' ->> 'title'),
        'cover', COALESCE("s"."topic_cover", "n"."payload" -> 'container' ->> 'cover', "n"."payload" -> 'subject' ->> 'cover'),
        'sectionId', COALESCE("s"."section_id", ("n"."payload" -> 'container' ->> 'sectionId')::integer, ("n"."payload" -> 'subject' -> 'extra' ->> 'sectionId')::integer)
      )
    )
  )
)
FROM "topic_commented_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "announcement_source" AS (
  SELECT
    "n"."id",
    COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'announcementId')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer) AS "announcement_id",
    "a"."title" AS "announcement_title",
    "a"."summary" AS "announcement_summary",
    "a"."announcement_type" AS "announcement_type",
    "a"."priority_level" AS "priority_level"
  FROM "user_notification" AS "n"
  LEFT JOIN "app_announcement" AS "a"
    ON "a"."id" = COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'announcementId')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer)
  WHERE "n"."category_key" = 'system_announcement'
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'object',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'announcement',
        'id', "s"."announcement_id",
        'title', COALESCE("s"."announcement_title", "n"."payload" -> 'object' ->> 'title', "n"."payload" -> 'subject' ->> 'title'),
        'summary', COALESCE("s"."announcement_summary", "n"."payload" -> 'object' ->> 'summary', "n"."payload" -> 'subject' -> 'extra' ->> 'summary'),
        'announcementType', COALESCE("s"."announcement_type", ("n"."payload" -> 'object' ->> 'announcementType')::integer, ("n"."payload" ->> 'announcementType')::integer, ("n"."payload" -> 'subject' -> 'extra' ->> 'announcementType')::integer),
        'priorityLevel', COALESCE("s"."priority_level", ("n"."payload" -> 'object' ->> 'priorityLevel')::integer, ("n"."payload" ->> 'priorityLevel')::integer, ("n"."payload" -> 'subject' -> 'extra' ->> 'priorityLevel')::integer)
      )
    )
  )
)
FROM "announcement_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "task_source" AS (
  SELECT
    "n"."id",
    COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'taskId')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer) AS "task_id",
    "t"."title" AS "task_title",
    "t"."cover" AS "task_cover",
    "t"."code" AS "task_code",
    "t"."type" AS "task_type"
  FROM "user_notification" AS "n"
  LEFT JOIN "task" AS "t"
    ON "t"."id" = COALESCE(("n"."payload" -> 'object' ->> 'id')::integer, ("n"."payload" ->> 'taskId')::integer, ("n"."payload" -> 'subject' ->> 'id')::integer)
   AND "t"."deleted_at" IS NULL
  WHERE "n"."category_key" = 'task_reminder'
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'object',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind', 'task',
        'id', "s"."task_id",
        'code', COALESCE("s"."task_code", "n"."payload" -> 'object' ->> 'code', "n"."payload" ->> 'taskCode', "n"."payload" -> 'subject' -> 'extra' ->> 'code'),
        'title', COALESCE("s"."task_title", "n"."payload" -> 'object' ->> 'title', "n"."payload" -> 'subject' ->> 'title'),
        'cover', COALESCE("s"."task_cover", "n"."payload" -> 'object' ->> 'cover', "n"."payload" -> 'subject' ->> 'cover'),
        'sceneType', COALESCE("s"."task_type", ("n"."payload" -> 'object' ->> 'sceneType')::integer, ("n"."payload" ->> 'sceneType')::integer, ("n"."payload" -> 'subject' -> 'extra' ->> 'type')::integer)
      )
    ),
    'reminder',
    jsonb_strip_nulls(
      jsonb_build_object(
        'kind',
        CASE COALESCE("n"."payload" -> 'reminder' ->> 'kind', "n"."payload" ->> 'reminderKind')
          WHEN 'task_auto_assigned' THEN 'auto_assigned'
          WHEN 'auto_assigned' THEN 'auto_assigned'
          WHEN 'task_expiring_soon' THEN 'expiring_soon'
          WHEN 'expiring_soon' THEN 'expiring_soon'
          WHEN 'task_reward_granted' THEN 'reward_granted'
          WHEN 'reward_granted' THEN 'reward_granted'
          ELSE NULL
        END,
        'assignmentId', COALESCE(("n"."payload" -> 'reminder' ->> 'assignmentId')::integer, ("n"."payload" ->> 'assignmentId')::integer),
        'cycleKey', COALESCE("n"."payload" -> 'reminder' ->> 'cycleKey', "n"."payload" ->> 'cycleKey'),
        'expiredAt', COALESCE("n"."payload" -> 'reminder' ->> 'expiredAt', "n"."payload" ->> 'expiredAt')
      )
    )
  )
  || CASE
    WHEN jsonb_typeof("n"."payload" -> 'reward') = 'object' THEN jsonb_build_object('reward', "n"."payload" -> 'reward')
    WHEN jsonb_typeof("n"."payload" -> 'rewardSummary') = 'object' THEN jsonb_build_object(
      'reward',
      jsonb_strip_nulls(
        jsonb_build_object(
          'items', COALESCE("n"."payload" -> 'rewardSummary' -> 'items', "n"."payload" -> 'rewardSummary' -> 'rewardItems', '[]'::jsonb),
          'ledgerRecordIds', COALESCE("n"."payload" -> 'rewardSummary' -> 'ledgerRecordIds', "n"."payload" -> 'ledgerRecordIds', '[]'::jsonb)
        )
      )
    )
    WHEN COALESCE(("n"."payload" ->> 'points')::integer, 0) > 0
      OR COALESCE(("n"."payload" ->> 'experience')::integer, 0) > 0
      OR jsonb_typeof("n"."payload" -> 'ledgerRecordIds') = 'array'
    THEN jsonb_build_object(
      'reward',
      jsonb_strip_nulls(
        jsonb_build_object(
          'items',
          (
            CASE
              WHEN COALESCE(("n"."payload" ->> 'points')::integer, 0) > 0 THEN jsonb_build_array(
                jsonb_build_object(
                  'assetType', 1,
                  'amount', ("n"."payload" ->> 'points')::integer
                )
              )
              ELSE '[]'::jsonb
            END
            ||
            CASE
              WHEN COALESCE(("n"."payload" ->> 'experience')::integer, 0) > 0 THEN jsonb_build_array(
                jsonb_build_object(
                  'assetType', 2,
                  'amount', ("n"."payload" ->> 'experience')::integer
                )
              )
              ELSE '[]'::jsonb
            END
          ),
          'ledgerRecordIds', COALESCE("n"."payload" -> 'ledgerRecordIds', '[]'::jsonb)
        )
      )
    )
    ELSE '{}'::jsonb
  END
)
FROM "task_source" AS "s"
WHERE "n"."id" = "s"."id";

UPDATE "user_notification" AS "n"
SET "payload" = jsonb_set(
  "n"."payload",
  '{reward,items}',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'assetType',
          CASE "item" ->> 'assetType'
            WHEN 'points' THEN 1
            WHEN 'experience' THEN 2
            WHEN '1' THEN 1
            WHEN '2' THEN 2
            ELSE NULL
          END,
          'amount', ("item" ->> 'amount')::integer
        )
      )
      FROM jsonb_array_elements(COALESCE("n"."payload" -> 'reward' -> 'items', '[]'::jsonb)) AS "item"
      WHERE CASE "item" ->> 'assetType'
        WHEN 'points' THEN 1
        WHEN 'experience' THEN 2
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        ELSE NULL
      END IS NOT NULL
    ),
    '[]'::jsonb
  ),
  true
)
WHERE "n"."category_key" = 'task_reminder'
  AND jsonb_typeof("n"."payload" -> 'reward' -> 'items') = 'array';

UPDATE "user_notification"
SET "payload" = NULL
WHERE "category_key" = 'user_followed';

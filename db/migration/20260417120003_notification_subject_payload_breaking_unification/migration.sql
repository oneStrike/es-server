INSERT INTO "notification_template" (
  "category_key",
  "title_template",
  "content_template",
  "is_enabled",
  "remark",
  "updated_at"
)
VALUES
  ('comment_reply', '{{payload.actorNickname}} 回复了你的评论', '{{payload.replyExcerpt}}', true, 'canonical notification template: 评论回复', now()),
  ('comment_mention', '{{payload.actorNickname}} 在评论中提到了你', '{{payload.commentExcerpt}}', true, 'canonical notification template: 评论提及', now()),
  ('comment_like', '{{payload.actorNickname}} 点赞了你的评论', '{{payload.actorNickname}} 点赞了你的评论', true, 'canonical notification template: 评论点赞', now()),
  ('topic_like', '{{payload.actorNickname}} 点赞了你的主题', '{{payload.subject.title}}', true, 'canonical notification template: 主题点赞', now()),
  ('topic_favorited', '{{payload.actorNickname}} 收藏了你的主题', '{{payload.subject.title}}', true, 'canonical notification template: 主题收藏', now()),
  ('topic_commented', '{{payload.actorNickname}} 评论了你的主题', '{{payload.commentExcerpt}}', true, 'canonical notification template: 主题评论', now()),
  ('topic_mentioned', '{{payload.actorNickname}} 在主题中提到了你', '{{payload.subject.title}}', true, 'canonical notification template: 主题提及', now()),
  ('user_followed', '{{payload.actorNickname}} 关注了你', '{{payload.actorNickname}} 关注了你', true, 'canonical notification template: 用户关注', now()),
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
    "n"."payload",
    ("n"."payload" ->> 'targetId')::integer AS "target_id",
    "w"."name" AS "work_name",
    "w"."cover" AS "work_cover",
    "w"."type" AS "work_type"
  FROM "user_notification" AS "n"
  LEFT JOIN "work" AS "w"
    ON "w"."id" = ("n"."payload" ->> 'targetId')::integer
   AND "w"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('comment_reply', 'comment_mention', 'comment_like')
    AND ("n"."payload" ->> 'targetType')::integer IN (1, 2)
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  CASE WHEN "s"."payload" ? 'actorNickname' THEN jsonb_build_object('actorNickname', "s"."payload" -> 'actorNickname') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentId' THEN jsonb_build_object('commentId', "s"."payload" -> 'commentId') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'replyExcerpt' THEN jsonb_build_object('replyExcerpt', "s"."payload" -> 'replyExcerpt') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentExcerpt' THEN jsonb_build_object('commentExcerpt', "s"."payload" -> 'commentExcerpt') ELSE '{}'::jsonb END
  || CASE
    WHEN "s"."target_id" IS NOT NULL THEN jsonb_build_object(
      'subject',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'work',
          'id', "s"."target_id",
          'title', "s"."work_name",
          'cover', "s"."work_cover"
        )
        || CASE
          WHEN "s"."work_type" IS NOT NULL THEN jsonb_build_object(
            'extra',
            jsonb_build_object('type', "s"."work_type")
          )
          ELSE '{}'::jsonb
        END
      )
    )
    ELSE '{}'::jsonb
  END
)
FROM "comment_work_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "comment_chapter_source" AS (
  SELECT
    "n"."id",
    "n"."payload",
    ("n"."payload" ->> 'targetId')::integer AS "target_id",
    "c"."title" AS "chapter_title",
    "c"."subtitle" AS "chapter_subtitle",
    "c"."cover" AS "chapter_cover",
    "c"."work_id" AS "work_id",
    "c"."work_type" AS "work_type",
    "w"."name" AS "work_name",
    "w"."cover" AS "work_cover",
    "w"."type" AS "resolved_work_type"
  FROM "user_notification" AS "n"
  LEFT JOIN "work_chapter" AS "c"
    ON "c"."id" = ("n"."payload" ->> 'targetId')::integer
   AND "c"."deleted_at" IS NULL
  LEFT JOIN "work" AS "w"
    ON "w"."id" = "c"."work_id"
   AND "w"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('comment_reply', 'comment_mention', 'comment_like')
    AND ("n"."payload" ->> 'targetType')::integer IN (3, 4)
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  CASE WHEN "s"."payload" ? 'actorNickname' THEN jsonb_build_object('actorNickname', "s"."payload" -> 'actorNickname') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentId' THEN jsonb_build_object('commentId', "s"."payload" -> 'commentId') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'replyExcerpt' THEN jsonb_build_object('replyExcerpt', "s"."payload" -> 'replyExcerpt') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentExcerpt' THEN jsonb_build_object('commentExcerpt', "s"."payload" -> 'commentExcerpt') ELSE '{}'::jsonb END
  || CASE
    WHEN "s"."target_id" IS NOT NULL THEN jsonb_build_object(
      'subject',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'chapter',
          'id', "s"."target_id",
          'title', "s"."chapter_title",
          'subtitle', "s"."chapter_subtitle",
          'cover', COALESCE("s"."chapter_cover", "s"."work_cover")
        )
        || CASE
          WHEN "s"."work_id" IS NOT NULL OR "s"."work_type" IS NOT NULL THEN jsonb_build_object(
            'extra',
            jsonb_strip_nulls(jsonb_build_object(
              'workId', "s"."work_id",
              'workType', "s"."work_type"
            ))
          )
          ELSE '{}'::jsonb
        END
      )
    )
    ELSE '{}'::jsonb
  END
  || CASE
    WHEN "s"."work_id" IS NOT NULL THEN jsonb_build_object(
      'parentSubject',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'work',
          'id', "s"."work_id",
          'title', "s"."work_name",
          'cover', "s"."work_cover"
        )
        || CASE
          WHEN "s"."resolved_work_type" IS NOT NULL THEN jsonb_build_object(
            'extra',
            jsonb_build_object('type', "s"."resolved_work_type")
          )
          ELSE '{}'::jsonb
        END
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
    "n"."payload",
    ("n"."payload" ->> 'targetId')::integer AS "target_id",
    "t"."title" AS "topic_title",
    "t"."section_id" AS "section_id",
    "t"."images"[1] AS "topic_cover"
  FROM "user_notification" AS "n"
  LEFT JOIN "forum_topic" AS "t"
    ON "t"."id" = ("n"."payload" ->> 'targetId')::integer
   AND "t"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('comment_reply', 'comment_mention', 'comment_like')
    AND ("n"."payload" ->> 'targetType')::integer = 5
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  CASE WHEN "s"."payload" ? 'actorNickname' THEN jsonb_build_object('actorNickname', "s"."payload" -> 'actorNickname') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentId' THEN jsonb_build_object('commentId', "s"."payload" -> 'commentId') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'replyExcerpt' THEN jsonb_build_object('replyExcerpt', "s"."payload" -> 'replyExcerpt') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentExcerpt' THEN jsonb_build_object('commentExcerpt', "s"."payload" -> 'commentExcerpt') ELSE '{}'::jsonb END
  || CASE
    WHEN "s"."target_id" IS NOT NULL THEN jsonb_build_object(
      'subject',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'topic',
          'id', "s"."target_id",
          'title', "s"."topic_title",
          'cover', "s"."topic_cover"
        )
        || CASE
          WHEN "s"."section_id" IS NOT NULL THEN jsonb_build_object(
            'extra',
            jsonb_build_object('sectionId', "s"."section_id")
          )
          ELSE '{}'::jsonb
        END
      )
    )
    ELSE '{}'::jsonb
  END
)
FROM "comment_topic_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "topic_source" AS (
  SELECT
    "n"."id",
    "n"."category_key",
    "n"."payload",
    COALESCE(
      ("n"."payload" ->> 'topicId')::integer,
      ("n"."payload" ->> 'targetId')::integer,
      ("n"."payload" -> 'subject' ->> 'id')::integer
    ) AS "topic_id",
    "t"."title" AS "topic_title",
    "t"."section_id" AS "section_id",
    "t"."images"[1] AS "topic_cover"
  FROM "user_notification" AS "n"
  LEFT JOIN "forum_topic" AS "t"
    ON "t"."id" = COALESCE(("n"."payload" ->> 'topicId')::integer, ("n"."payload" ->> 'targetId')::integer)
   AND "t"."deleted_at" IS NULL
  WHERE "n"."category_key" IN ('topic_like', 'topic_favorited', 'topic_commented', 'topic_mentioned')
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  CASE WHEN "s"."payload" ? 'actorNickname' THEN jsonb_build_object('actorNickname', "s"."payload" -> 'actorNickname') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentId' THEN jsonb_build_object('commentId', "s"."payload" -> 'commentId') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'commentExcerpt' THEN jsonb_build_object('commentExcerpt', "s"."payload" -> 'commentExcerpt') ELSE '{}'::jsonb END
  || CASE
    WHEN "s"."topic_id" IS NOT NULL THEN jsonb_build_object(
      'subject',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'topic',
          'id', "s"."topic_id",
          'title', "s"."topic_title",
          'cover', "s"."topic_cover"
        )
        || CASE
          WHEN "s"."section_id" IS NOT NULL THEN jsonb_build_object(
            'extra',
            jsonb_build_object('sectionId', "s"."section_id")
          )
          ELSE '{}'::jsonb
        END
      )
    )
    ELSE '{}'::jsonb
  END
)
FROM "topic_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "announcement_source" AS (
  SELECT
    "n"."id",
    "n"."payload",
    ("n"."payload" ->> 'announcementId')::integer AS "announcement_id",
    "a"."title" AS "announcement_title",
    "a"."summary" AS "announcement_summary",
    "a"."announcement_type" AS "announcement_type",
    "a"."priority_level" AS "priority_level"
  FROM "user_notification" AS "n"
  LEFT JOIN "app_announcement" AS "a"
    ON "a"."id" = ("n"."payload" ->> 'announcementId')::integer
  WHERE "n"."category_key" = 'system_announcement'
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  CASE WHEN "s"."announcement_id" IS NOT NULL THEN jsonb_build_object('announcementId', "s"."announcement_id") ELSE '{}'::jsonb END
  || CASE
    WHEN COALESCE("s"."announcement_type", ("s"."payload" ->> 'announcementType')::integer) IS NOT NULL THEN jsonb_build_object(
      'announcementType',
      COALESCE("s"."announcement_type", ("s"."payload" ->> 'announcementType')::integer)
    )
    ELSE '{}'::jsonb
  END
  || CASE
    WHEN COALESCE("s"."priority_level", ("s"."payload" ->> 'priorityLevel')::integer) IS NOT NULL THEN jsonb_build_object(
      'priorityLevel',
      COALESCE("s"."priority_level", ("s"."payload" ->> 'priorityLevel')::integer)
    )
    ELSE '{}'::jsonb
  END
  || CASE
    WHEN "s"."announcement_id" IS NOT NULL THEN jsonb_build_object(
      'subject',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'announcement',
          'id', "s"."announcement_id",
          'title', "s"."announcement_title"
        )
        || CASE
          WHEN COALESCE("s"."announcement_type", ("s"."payload" ->> 'announcementType')::integer) IS NOT NULL
             OR COALESCE("s"."priority_level", ("s"."payload" ->> 'priorityLevel')::integer) IS NOT NULL
             OR "s"."announcement_summary" IS NOT NULL
          THEN jsonb_build_object(
            'extra',
            jsonb_strip_nulls(jsonb_build_object(
              'announcementType', COALESCE("s"."announcement_type", ("s"."payload" ->> 'announcementType')::integer),
              'priorityLevel', COALESCE("s"."priority_level", ("s"."payload" ->> 'priorityLevel')::integer),
              'summary', "s"."announcement_summary"
            ))
          )
          ELSE '{}'::jsonb
        END
      )
    )
    ELSE '{}'::jsonb
  END
)
FROM "announcement_source" AS "s"
WHERE "n"."id" = "s"."id";

WITH "task_source" AS (
  SELECT
    "n"."id",
    "n"."payload",
    ("n"."payload" ->> 'taskId')::integer AS "task_id",
    "t"."title" AS "task_title",
    "t"."cover" AS "task_cover",
    "t"."code" AS "task_code",
    "t"."type" AS "task_type"
  FROM "user_notification" AS "n"
  LEFT JOIN "task" AS "t"
    ON "t"."id" = ("n"."payload" ->> 'taskId')::integer
   AND "t"."deleted_at" IS NULL
  WHERE "n"."category_key" = 'task_reminder'
)
UPDATE "user_notification" AS "n"
SET "payload" = jsonb_strip_nulls(
  CASE WHEN "s"."payload" ? 'reminderKind' THEN jsonb_build_object('reminderKind', "s"."payload" -> 'reminderKind') ELSE '{}'::jsonb END
  || CASE WHEN "s"."task_id" IS NOT NULL THEN jsonb_build_object('taskId', "s"."task_id") ELSE '{}'::jsonb END
  || CASE
    WHEN COALESCE("s"."task_code", "s"."payload" ->> 'taskCode') IS NOT NULL THEN jsonb_build_object(
      'taskCode',
      COALESCE("s"."task_code", "s"."payload" ->> 'taskCode')
    )
    ELSE '{}'::jsonb
  END
  || CASE WHEN "s"."payload" ? 'sceneType' THEN jsonb_build_object('sceneType', "s"."payload" -> 'sceneType') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'cycleKey' THEN jsonb_build_object('cycleKey', "s"."payload" -> 'cycleKey') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'assignmentId' THEN jsonb_build_object('assignmentId', "s"."payload" -> 'assignmentId') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'expiredAt' THEN jsonb_build_object('expiredAt', "s"."payload" -> 'expiredAt') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'actionUrl' THEN jsonb_build_object('actionUrl', "s"."payload" -> 'actionUrl') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'rewardSummary' THEN jsonb_build_object('rewardSummary', "s"."payload" -> 'rewardSummary') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'points' THEN jsonb_build_object('points', "s"."payload" -> 'points') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'experience' THEN jsonb_build_object('experience', "s"."payload" -> 'experience') ELSE '{}'::jsonb END
  || CASE WHEN "s"."payload" ? 'ledgerRecordIds' THEN jsonb_build_object('ledgerRecordIds', "s"."payload" -> 'ledgerRecordIds') ELSE '{}'::jsonb END
  || CASE
    WHEN "s"."task_id" IS NOT NULL THEN jsonb_build_object(
      'subject',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'task',
          'id', "s"."task_id",
          'title', "s"."task_title",
          'cover', "s"."task_cover"
        )
        || CASE
          WHEN COALESCE("s"."task_code", "s"."payload" ->> 'taskCode') IS NOT NULL
             OR COALESCE("s"."task_type", ("s"."payload" ->> 'sceneType')::integer) IS NOT NULL
          THEN jsonb_build_object(
            'extra',
            jsonb_strip_nulls(jsonb_build_object(
              'code', COALESCE("s"."task_code", "s"."payload" ->> 'taskCode'),
              'type', COALESCE("s"."task_type", ("s"."payload" ->> 'sceneType')::integer)
            ))
          )
          ELSE '{}'::jsonb
        END
      )
    )
    ELSE '{}'::jsonb
  END
)
FROM "task_source" AS "s"
WHERE "n"."id" = "s"."id";

UPDATE "user_notification"
SET "payload" = CASE
  WHEN "payload" ? 'actorNickname' THEN jsonb_build_object('actorNickname', "payload" -> 'actorNickname')
  ELSE NULL
END
WHERE "category_key" = 'user_followed';

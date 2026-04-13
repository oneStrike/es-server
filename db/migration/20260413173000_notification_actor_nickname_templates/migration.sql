UPDATE "notification_template"
SET
  "title_template" = '{{payload.actorNickname}} 点赞了你的评论',
  "content_template" = '{{payload.actorNickname}} 点赞了你的评论',
  "updated_at" = NOW()
WHERE "category_key" = 'comment_like';

UPDATE "notification_template"
SET
  "title_template" = '{{payload.actorNickname}} 关注了你',
  "content_template" = '{{payload.actorNickname}} 关注了你',
  "updated_at" = NOW()
WHERE "category_key" = 'user_followed';

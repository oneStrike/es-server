-- 正式启用 7/8/10 的运行时 delete/move/delete-comment 写链前，
-- 先清掉旧 seed-only 历史记录，避免把历史样例数据误判为正式治理事实。
DELETE FROM "forum_moderator_action_log"
WHERE "action_type" IN (7, 8, 10);

# 互动数据分表统一设计（LFV + 评论点赞并表）

## 1. 总体目标

保持互动数据分表治理，不做“所有行为单表合并”，但将评论点赞从独立表并入点赞主表。

- 评论：`user_comment`
- 点赞：`user_like`
- 收藏：`user_favorite`
- 浏览：`user_view`
- 举报：`user_report`

## 2. 点赞统一策略

- 统一点赞写入表：`user_like`
- 评论/回复点赞使用：`targetType=COMMENT(6)` + `targetId=user_comment.id`
- 统一唯一约束：`@@unique([targetType, targetId, userId])`
- 删除 Prisma 模型：`UserCommentLike`

## 3. 枚举约束

`InteractionTargetTypeEnum`：

- 1 `COMIC`
- 2 `NOVEL`
- 3 `COMIC_CHAPTER`
- 4 `NOVEL_CHAPTER`
- 5 `FORUM_TOPIC`
- 6 `COMMENT`

## 4. 服务改造要点

- `CommentInteractionService`：评论点赞/取消点赞改走 `userLike`
- `ForumReplyLikeService`：回复点赞/取消点赞改走 `userLike`
- `UserLevelRuleService`：`dailyLikeLimit` 改为在 `userLike` 内按目标类型统一统计

## 5. 数据迁移说明

迁移由人工执行（本轮不自动执行）：

- 将 `user_comment_like` 数据迁入 `user_like(targetType=6)`
- 对账后下线旧表读写路径

## 6. 风险与回滚

- 风险：旧数据未迁移完成前，新老口径可能短时不一致
- 规避：先迁移历史数据，再切流量
- 回滚：保留旧表快照，必要时按目标类型反向回填
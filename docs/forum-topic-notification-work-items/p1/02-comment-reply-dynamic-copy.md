# P1-02 评论回复动态文案

## 目标

把现有固定“收到新的评论回复”升级为“谁回复了你的评论 + 回复摘要”的动态通知。

## 范围

- 升级 `COMMENT_REPLY` 的 fallback 文案
- 同步升级 `COMMENT_REPLY` 默认模板
- 补齐评论回复所需快照字段
- 减少回复链路的一次重复查询
- 保持 `COMMENT_REPLY` 的跨内容域通用语义

## 当前代码锚点

- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/comment.type.ts`
- `libs/message/src/notification/notification.constant.ts`
- `db/seed/modules/message/domain.ts`

## 非目标

- 不新增论坛主题“被评论”通知
- 不修改论坛主题点赞 / 收藏通知
- 不在本任务里做模板缓存
- 不要求在本任务里一次性补齐所有非论坛评论目标的 `targetDisplayTitle`
- 不在本任务包里把 `COMMENT_REPLY` 再拆成论坛主题回复 / 作品回复 / 章节回复等域级通知类型

## 主要改动

- 标题改为“`xxx 回复了你的评论`”
- 正文改为回复内容摘要
- `VisibleCommentEffectPayload / CommentModerationState` 增加回复摘要所需 `content`
- `replyComment(...)` 已查到的被回复用户直接透传给补偿逻辑
- 审核补偿场景保留现有兜底查询
- 回复摘要为空时优先回退为 `targetDisplayTitle`，缺失时回退固定兜底文案
- 同步将 `COMMENT_REPLY` 默认模板升级为动态快照版，避免启用模板环境继续命中旧静态 copy

## 完成标准

- 回复通知不再只有固定文案
- 回复通知能表达“是谁回复了你”
- 回复通知主链路不引入额外漂移字段或不必要的重复查询
- 即使在模板已启用且已 seed 的环境中，`COMMENT_REPLY` 也会展示动态文案
- `COMMENT_REPLY` 继续保持跨内容域通用表达，不绑定论坛主题专属口径

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- [P2-01 模板默认文案与 seed 升级](../p2/01-template-default-copy-and-seed.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

# P1-02 评论回复动态文案

## 目标

把现有固定“收到新的评论回复”升级为“谁回复了你的评论 + 回复摘要”的动态通知。

## 范围

- 升级 `COMMENT_REPLY` 的 fallback 文案
- 补齐评论回复所需快照字段
- 减少回复链路的一次重复查询

## 当前代码锚点

- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/comment.type.ts`
- `libs/message/src/notification/notification.constant.ts`

## 非目标

- 不新增论坛主题“被评论”通知
- 不修改论坛主题点赞 / 收藏通知
- 不在本任务里做模板缓存

## 主要改动

- 标题改为“`xxx 回复了你的评论`”
- 正文改为回复内容摘要
- `replyComment(...)` 已查到的被回复用户直接透传给补偿逻辑
- 审核补偿场景保留现有兜底查询
- 回复摘要为空时回退为主题标题或固定兜底文案

## 完成标准

- 回复通知不再只有固定文案
- 回复通知能表达“是谁回复了你”
- 回复通知主链路不引入额外漂移字段或不必要的重复查询

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- [P2-01 模板默认文案与 seed 升级](../p2/01-template-default-copy-and-seed.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

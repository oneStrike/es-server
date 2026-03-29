# P1-03 主题被评论通知

## 目标

补齐论坛主题一级评论首次可见时的“主题被评论”通知能力。

## 范围

- 升级评论 post hook 签名
- 仅对一级评论发送 `TOPIC_COMMENT`
- 正文优先显示评论摘要

## 当前代码锚点

- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/comment.type.ts`
- `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
- `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`

## 非目标

- 不重做评论发布主流程
- 不把回复评论也归并为 `TOPIC_COMMENT`
- 不做历史评论离线补通知

## 主要改动

- 升级 `postCommentHook(...)`，让 resolver 能拿到可见评论完整载荷
- 复用 `P1-02` 已补的评论副作用共享字段（如 `content / replyTargetUserId`），不再重复改一套补偿底座
- 一级评论首次可见时发送 `TOPIC_COMMENT`
- 回复评论继续走 `COMMENT_REPLY`
- `TOPIC_COMMENT` 正文优先显示评论摘要，缺失时回退主题标题
- 审核通过补偿与取消隐藏补偿路径共享同一逻辑

## 完成标准

- 论坛主题作者在一级评论首次可见时能收到通知
- 回复评论不会误触发“主题被评论”通知
- 通知正文对用户可读，不再只有静态兜底文案

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- [P2-01 模板默认文案与 seed 升级](../p2/01-template-default-copy-and-seed.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

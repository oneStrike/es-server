# P0-02 通知 composer 与快照契约收口

## 目标

把通知事件构造和展示快照字段收口到统一层，避免后续每个业务模块各自拼一套动态文案 payload。

## 范围

- 新增通知 composer
- 定义论坛主题通知展示快照字段
- 扩展 like / favorite / comment 解析器元数据契约

## 当前代码锚点

- `libs/message/src/notification/notification.type.ts`
- `libs/interaction/src/like/interfaces/like-target-resolver.interface.ts`
- `libs/interaction/src/favorite/interfaces/favorite-target-resolver.interface.ts`
- `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`

## 非目标

- 不在本任务里迁移全部业务通知调用方
- 不在本任务里修改主题点赞、收藏、评论的最终展示文案
- 不在本任务里引入模板缓存

## 主要改动

- 新增 `MessageNotificationComposerService`
- 定义 `TOPIC_LIKE / TOPIC_FAVORITE / TOPIC_COMMENT / COMMENT_REPLY` 的 typed payload
- 扩展 `LikeTargetMeta` 支持 `ownerUserId / targetTitle`
- 扩展 favorite resolver 返回值支持 `ownerUserId / targetTitle`
- 扩展 `CommentTargetMeta` 支持 `targetTitle`
- 统一 `actorNickname / topicTitle / commentExcerpt / replyExcerpt` 的快照字段口径

## 完成标准

- 后续业务模块可以通过 composer 构造通知事件
- 展示快照字段有统一契约，不再由各模块随意命名
- 动态文案所需数据能在业务侧准备好，而不是在模板层临时回查

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- 若接口签名调整明显，同时同步后续单任务文档

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

# P0-01 通知类型拆分与 outbox 契约收口

## 目标

先把论坛主题通知的类型语义和 outbox 输入契约固定下来，避免后续动态文案改到一半还在反复改通知类型。

## 范围

- 为论坛主题新增独立通知类型
- 收口通知 outbox 的类型来源
- 同步 DTO / 偏好 / 模板定义侧的基础类型映射

## 当前代码锚点

- `libs/message/src/notification/notification.constant.ts`
- `libs/message/src/outbox/outbox.type.ts`
- `libs/message/src/outbox/outbox.service.ts`
- `apps/app-api/src/modules/message/dto/message.dto.ts`
- `apps/admin-api/src/modules/message/dto/message-template.dto.ts`
- `apps/admin-api/src/modules/message/dto/message-monitor.dto.ts`

## 非目标

- 不在本任务里改动态文案本身
- 不在本任务里补论坛主题“被评论”通知主链路
- 不在本任务里做模板缓存或模板校验增强

## 主要改动

- 新增 `TOPIC_LIKE`
- 新增 `TOPIC_FAVORITE`
- 新增 `TOPIC_COMMENT`
- 让通知 outbox 以 `payload.type` 为唯一通知类型事实源
- 兼容期对 `eventType !== payload.type` 做显式校验
- 同步通知类型相关 DTO 与枚举展示

## 完成标准

- 论坛主题点赞、收藏、评论具备独立通知类型
- 业务侧不再需要长期双写 `eventType / payload.type`
- 偏好、模板、delivery 后续可以围绕新增类型独立收口

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- [P2-01 模板默认文案与 seed 升级](../p2/01-template-default-copy-and-seed.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

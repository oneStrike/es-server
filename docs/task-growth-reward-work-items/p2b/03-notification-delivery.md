# P2-B-03 通知投递结果表

## 目标

让 outbox 具备最小投递结果追踪，而不是只看到待发送记录。

## 范围

- 新增 `notification_delivery`
- worker 投递后写结果
- 管理端展示失败原因与重试次数
- 管理端提供 `delivery/page` 排障入口

## 当前代码锚点

- `db/schema/message/message-outbox.ts`
- `libs/message/src/outbox/outbox.worker.ts`
- `libs/message/src/notification/notification-delivery.service.ts`
- `libs/message/src/notification/notification.service.ts`
- `apps/admin-api/src/modules/message/message.controller.ts`
- `apps/admin-api/src/modules/message/message-monitor.service.ts`

## 非目标

- 不用 `notification_delivery` 替代 `message_outbox.status`
- 不把 chat 域强行并入第一阶段通知投递结果表
- 不把“跳过”错误归类成“失败”

## 当前状态

- `notification_delivery` 当前仍只服务通知域
- `CHAT` 域已在 `P2-C-03` 接上 outbox 消费闭环，但没有复用 `notification_delivery`
- chat 排障继续依赖 `message_outbox.status` 与 WS 监控，而不是强行映射成通知投递结果

## 主要改动

- `message_outbox.status` 继续表示技术消费状态
- 复用 `createFromOutbox` 当前已返回的 `DELIVERED / SKIPPED_SELF / SKIPPED_DUPLICATE / SKIPPED_PREFERENCE` 最小业务结果
- `notification_delivery` 记录业务投递结果，至少覆盖 `DELIVERED / FAILED / RETRYING / SKIPPED_DUPLICATE / SKIPPED_SELF / SKIPPED_PREFERENCE`
- 记录失败原因、重试次数、最终结果
- 管理端提供排障入口

## 完成标准

- outbox 之后的投递结果可查询
- 运营能区分“未投递 / 投递失败 / 幂等跳过 / 自通知跳过 / 偏好关闭跳过”
- worker 已消费和业务已投递不会再混为一个状态

## 完成后同步文档

- [通知域契约](../../notification-domain-contract.md)
- [开发排期版](../development-plan.md)
- 若后续扩展 chat 共享语义，同时同步 [P2-C-03 CHAT outbox 域闭环](../p2c/03-chat-outbox-closure.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

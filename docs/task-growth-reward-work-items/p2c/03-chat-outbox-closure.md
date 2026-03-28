# P2-C-03 `CHAT` outbox 域闭环

## 目标

补齐 `CHAT` 域的消费闭环，但不把聊天和通知强行拉成同一个模型。

## 范围

- 为 `CHAT` 域补消费逻辑
- 明确是否写 delivery
- 明确 ack 边界

## 当前代码锚点

- `db/schema/message/message-outbox.ts`
- `libs/message/src/outbox/outbox.worker.ts`
- `libs/message/src/chat/chat.service.ts`
- `apps/admin-api/src/modules/message/message-monitor.service.ts`

## 非目标

- 不把聊天 ack 语义并入通知 ack
- 不让 chat 复用 `user_notification` 作为主读模型
- 不在本任务里自动扩展整套通知 delivery 语义到 chat 域

## 主要改动

- 让 `message_outbox` 的 `CHAT` 域不再停留在声明层
- 区分聊天 ack 与通知 ack
- 只复用必要基础设施，不统一两套业务语义

## 完成标准

- `CHAT` 域从“定义存在”变成“链路闭环”
- 不因为复用 outbox 就把聊天与通知模型混成一层

## 当前状态

- `chat.send` 现已在消息落库事务内写入 `CHAT/MESSAGE_CREATED` outbox 事件
- 提交后会立即尝试一次 fanout；若即时分发失败，保留 outbox 由 worker 补偿消费
- worker 复用 chat 域自己的分发逻辑做 `chat.message.new / chat.conversation.update / inbox.summary.update`
- `CHAT` 域没有接入 `notification_delivery`，chat ack 仍保持为 websocket 请求级确认

## 完成后同步文档

- [通知域契约](../../notification-domain-contract.md)
- [开发排期版](../development-plan.md)
- [P2-B-03 通知投递结果表](../p2b/03-notification-delivery.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

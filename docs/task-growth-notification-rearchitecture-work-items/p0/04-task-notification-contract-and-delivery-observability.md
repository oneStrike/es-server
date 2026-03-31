# P0-04 任务提醒与通知投递合同收口

## 1. 目标

把任务相关的站内通知、outbox、投递状态、实时推送与用户已读面板收口成一套稳定合同，避免 `TaskService` 长期直接拼装 payload 和 `bizKey`。

本任务要确保：

- 任务提醒类型清晰；
- payload 结构可演进；
- 去重键稳定；
- 通知投递结果可观察、可排障、可审计。

## 2. 范围

本任务覆盖以下模块：

- 任务服务中的提醒与奖励到账通知逻辑：
  - `libs/growth/src/task/task.service.ts`
- 消息 outbox 与 worker：
  - `libs/message/src/outbox/outbox.service.ts`
  - `libs/message/src/outbox/outbox.worker.ts`
- 通知服务、composer、投递服务、实时服务：
  - `libs/message/src/notification/notification.service.ts`
  - `libs/message/src/notification/notification-composer.service.ts`
  - `libs/message/src/notification/notification-delivery.service.ts`
  - `libs/message/src/notification/notification-realtime.service.ts`
- 收件箱与通知记录：
  - `libs/message/src/inbox/inbox.service.ts`
  - `db/schema/message/user-notification.ts`
  - `db/schema/message/notification-delivery.ts`
  - `db/schema/message/message-outbox.ts`
- 管理端消息监控：
  - `apps/admin-api/src/modules/message/message-monitor.service.ts`

## 3. 当前代码锚点

- 任务提醒目前在 `TaskService` 内部直接构造 `TASK_REMINDER` payload，并直接依赖 outbox 去重：
  - `libs/growth/src/task/task.service.ts`
- 消息层已具备通用 composer、delivery、inbox、realtime 能力，但任务没有形成专门合同：
  - `libs/message/src/notification/notification-composer.service.ts`
  - `libs/message/src/notification/notification.service.ts`
- 现有提醒类型至少包含：
  - 新任务可用提醒
  - 即将过期提醒
  - 奖励到账提醒
- 任务提醒和奖励到账目前更多是“能发出去”，缺少统一投递观测与重放口径：
  - `libs/message/src/outbox/outbox.worker.ts`
  - `apps/admin-api/src/modules/message/message-monitor.service.ts`

## 4. 非目标

- 本任务不扩展短信、邮件、Push 厂商渠道；
- 不做完整消息中心重构；
- 不改写所有既有通知类型；
- 不处理站外营销触达或用户订阅偏好体系；
- 不在本任务中完成 producer 事件统一，只处理 task 相关通知合同。

## 5. 主要改动

### 5.1 定义任务通知类型与 payload 合同

第一阶段默认保持一个通知主类型：

- `MessageNotificationTypeEnum.TASK_REMINDER`

并通过 `payload.reminderKind` 固定三类任务子语义：

- `AVAILABLE`
- `EXPIRING_SOON`
- `REWARD_GRANTED`

统一 payload 基础字段：

- `taskId`
- `assignmentId`
- `taskCode`
- `title`
- `sceneType`
- `cycleKey`
- `rewardSummary`
- `actionUrl`
- `payloadVersion`

### 5.2 从 `TaskService` 提取任务通知组装层

新增专门的 task notification composer 或 facade，负责：

- 模板选择；
- payload 构造；
- `bizKey` 生成；
- 文案统一；
- 是否需要实时推送的策略。

`TaskService` 只负责在业务节点调用任务通知入口，不再自己拼消息体。

### 5.3 固定任务通知去重规则

统一 `bizKey` 规范，例如：

- 新任务可用：`task-available:{userId}:{taskId}:{cycleKey}`
- 即将过期：`task-expiring:{assignmentId}`
- 奖励到账：`task-reward:{assignmentId}`

要求：

- 同一提醒重试不会重复创建用户通知；
- payload 升级不影响历史幂等语义；
- 管理端可按 `bizKey` 追踪整条投递链路。

### 5.4 补齐投递观测面

在消息监控与日志中补齐以下维度：

- 来源模块：`task`
- 通知主类型：`TASK_REMINDER`
- 任务子类型：`reminderKind`
- `bizKey`
- userId
- assignmentId
- taskId
- outbox 状态
- delivery 状态
- 失败原因

若仅靠 payload 解析难以满足管理端过滤，应优先在 `notification_delivery` 中补稳定字段或在查询视图中显式暴露这些字段，而不是让管理端自己解析 JSON。

### 5.5 统一用户侧通知口径

确保任务通知在站内信、未读数、实时推送中的表现一致：

- 同一条任务通知只算一次未读；
- 奖励到账后，任务列表状态与通知内容可互相印证；
- 用户阅读站内通知后，UI 不会因为重复 outbox 重试再次产生新卡片。

## 6. 完成标准

- `TASK_REMINDER + payload.reminderKind` 合同已经固定；
- `TaskService` 不再直接拼装任务通知 payload；
- 任务通知在 outbox、notification、delivery、realtime 全链路可追踪；
- 管理端或日志系统能按 `bizKey` 定位一条任务通知的投递结果；
- 至少完成以下验证：
  - 新任务提醒去重；
  - 即将过期提醒去重；
  - 奖励到账提醒与实际发奖账本一致；
  - outbox 重试不会重复发站内卡片；
  - 管理端能按 `reminderKind / taskId / assignmentId` 查询任务提醒结果。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- 消息中心通知类型说明
- 管理端消息监控说明

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P0-04`；
- 直接前置：`P0-03`；
- 软前置：`P0-02`；
- 完成后主要解锁：`P1-03`、`P2-03`。

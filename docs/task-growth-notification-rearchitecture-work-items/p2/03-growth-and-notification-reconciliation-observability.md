# P2-03 对账、监控与运营观察面补齐

## 1. 目标

为任务、基础奖励、任务 bonus、站内通知建立可复核的对账和监控视图，让问题不再只能靠翻日志定位。

本任务目标是补齐“看得见”的能力：

- assignment 是否按预期完成；
- 奖励是否已入账；
- 通知是否已投递；
- 哪些记录需要人工补偿或重试。

## 2. 范围

本任务覆盖以下模块：

- 任务 assignment、进度日志、奖励状态：
  - `db/schema/app/task-assignment.ts`
  - `db/schema/app/task-progress-log.ts`
  - `libs/growth/src/task/task.service.ts`
- 成长账本与奖励记录：
  - `db/schema/app/growth-ledger-record.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
  - `libs/growth/src/growth-reward/growth-reward.service.ts`
- 消息 outbox、通知、投递：
  - `db/schema/message/message-outbox.ts`
  - `db/schema/message/user-notification.ts`
  - `db/schema/message/notification-delivery.ts`
  - `libs/message/src/outbox/outbox.worker.ts`
  - `apps/admin-api/src/modules/message/message-monitor.service.ts`
- 如需补充监控指标，也应覆盖对应模块。

## 3. 当前代码锚点

- 任务奖励状态、账本记录、通知投递状态分散在不同表和服务中；
- 当前虽然有 outbox 监控与任务 reward 状态字段，但没有统一“跨链路视图”；
- 当出现“任务已完成但奖励失败”“奖励到账但通知未达”“通知已发但 assignment 状态未更新”等场景时，排障链路长。

## 4. 非目标

- 本任务不做完整 BI 数据仓库；
- 不引入重型可观测平台作为前置；
- 不替代应用日志系统；
- 不在本任务中处理所有业务域的对账，只聚焦 task/growth/notification 链路；
- 不做自动财务对账。

## 5. 主要改动

### 5.1 建立跨链路对账视图

至少要有以下对账维度：

- `assignment -> reward`
  - assignment 是否 `COMPLETED`
  - `rewardStatus`
  - 对应 ledger ids 是否存在
- `reward -> notification`
  - 奖励到账后是否创建 `TASK_REMINDER + reminderKind=REWARD_GRANTED`
  - outbox、delivery 状态是否成功
- `event -> task progress`
  - 某个业务事件是否命中任务推进
  - 是否被幂等丢弃

### 5.2 补齐管理端观察面

Admin 或内部工具至少支持按以下维度查询：

- userId
- taskId / assignmentId
- eventCode
- bizKey
- rewardStatus
- notification bizKey
- outbox/delivery 状态

### 5.3 增加补偿与修复入口

至少设计以下运营/技术修复入口：

- 单 assignment 重试奖励结算；
- 批量扫描待补偿奖励；
- 单 notification bizKey 重试投递；
- 对账脚本导出异常记录。

### 5.4 统一日志与指标

统一记录以下关键日志或指标：

- 基础奖励成功/失败计数
- 任务 bonus 成功/失败计数
- 任务通知成功/失败计数
- 补偿任务扫描数量、成功率、失败原因分布

### 5.5 建立上线前观察清单

将关键对账项沉淀到最终验收清单与发布检查项中，避免上线后再从零排查。

## 6. 完成标准

- 任务、奖励、通知三条链路具备可关联查询的最小观察面；
- 管理端或脚本可导出异常记录；
- 至少有单条和批量两类补偿入口；
- 关键日志与指标已定义并可复核；
- 至少完成以下验证：
  - assignment 奖励缺失的对账发现；
  - 奖励到账但通知失败的定位；
  - 重试入口行为验证；
  - 发布前观察清单演练。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- 管理端监控/对账说明
- 上线检查手册

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P2-03`；
- 直接前置：`P0-04`；
- 软前置：`P1-03`、`P2-01`；
- 可与 `P2-02` 并行，但排期调整只在事实源文档维护。

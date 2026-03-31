# P1-02 事件驱动任务推进最小实现

## 1. 目标

让任务系统真正开始消费业务事件，而不是长期依赖 App 端手工调用 `/progress`。

本任务的目标不是一次做成完整任务引擎，而是落一个“最小可用事件驱动管线”：

- 业务 producer 发出稳定事件；
- 任务侧能按 `eventCode + objectiveType` 找到目标任务；
- assignment 能幂等推进、自动完成、写入进度日志；
- 手动任务与事件任务可共存。

## 2. 范围

本任务覆盖以下内容：

- 事件定义与任务映射：
  - `libs/growth/src/event-definition/event-definition.map.ts`
  - `libs/growth/src/event-definition/event-envelope.type.ts`
- 任务服务与 assignment 流程：
  - `libs/growth/src/task/task.service.ts`
  - `db/schema/app/task-assignment.ts`
  - `db/schema/app/task-progress-log.ts`
- 任务目标字段：
  - `db/schema/app/task.ts`
  - `libs/growth/src/task/task.type.ts`
- 相关测试与回归。

## 3. 当前代码锚点

- `event-definition.map.ts` 已把大量业务事件标为 `TASK` consumer；
- `task.service.ts` 目前仍主要依赖：
  - `claimTask()`
  - `reportProgress()`
  - `completeTask()`
- `task_progress_log` 已可作为行为审计与幂等辅助，但还未承接事件主链路；
- `task.complete` 是任务完成后的自定义 envelope，而不是业务事件推进任务的通用入口。
- 事件定义层当前没有统一派发器；仅靠 `event-definition.map.ts` 的 `TASK consumer` 声明，任务模块还拿不到 producer 的真实事件输入。

## 4. 非目标

- 本任务不做复杂多目标组合任务；
- 不实现表达式引擎、脚本条件或任务编排 DAG；
- 不在本任务中拆分 task template/publish；
- 不强制替换所有现有手动任务；
- 不在本任务中处理运营后台复杂人群投放。

## 5. 主要改动

### 5.1 建立事件到任务的映射合同

基于 `P0-02` 的目标模型，建立最小映射规则：

- `objectiveType=EVENT_COUNT`
- `eventCode` 对齐稳定 producer 事件码
- `targetCount` 表示累计阈值
- `objectiveConfig` 用于补充过滤条件

前期只支持“一条任务对应一个主事件码”的简单模型。

并补充两条执行合同：

- `EVENT_COUNT` 任务按 `eventEnvelope.occurredAt` 落周期；
- `EVENT_COUNT + MANUAL claimMode` 第一阶段不回补领取前事件。

### 5.2 新增任务事件消费入口

在 `task` 域新增事件消费 facade 或 service，负责：

- 接收入站 `EventEnvelope + bizKey`；
- 过滤不应计入任务的治理场景；
- 查找匹配任务；
- 定位或创建 assignment；
- 记录进度日志；
- 达标时自动完成并触发奖励结算。

### 5.3 复用 assignment 快照执行

事件推进必须围绕 assignment 快照，而不是当前 task 实时配置：

- 周期判断以 assignment 的 `cycleKey/repeatRule` 为准；
- 完成模式以 assignment 快照为准；
- 奖励结算以 assignment 快照为准。

这样可以避免 live task 配置变更改写存量 assignment 语义。

### 5.4 建立幂等与回放能力

利用 `task_progress_log` 扩容或新增去重字段，实现：

- 同一 `eventId/bizKey` 不重复累加进度；
- 事件重复投递安全；
- 可以按 `eventCode + bizKey` 回放定位某次任务推进行为；
- 审计日志能区分“手动推进”和“事件推进”。

建议最小新增字段至少包括：

- `eventCode`
- `eventBizKey`
- `progressSource`

并为 `assignmentId + eventBizKey` 或等价组合建立唯一约束。

### 5.5 保留手动任务兼容路径

对于 `objectiveType=MANUAL` 的任务，继续允许：

- 手动领取
- 手动上报
- 手动完成

但接口语义要明确：

- `reportProgress()` 更适合只服务手动任务或内部补偿；
- 事件任务默认不再依赖客户端主动上报。

对于 `objectiveType=EVENT_COUNT` 的任务，第一阶段再明确：

- `AUTO` 领取可在命中事件时自动建 assignment；
- `MANUAL` 领取必须先有 assignment，才允许后续事件累计。

### 5.6 明确失败与补偿策略

事件驱动推进至少要处理以下异常链路：

- producer 事件重复；
- assignment 已存在但任务已删除或下线；
- 任务已完成但奖励结算失败；
- 治理状态反转导致任务是否应回滚需要评估。

第一阶段建议策略：

- 先保证“不可重复加进度、不可重复发奖”；
- 治理反转后的回滚不做自动化，只保留审计能力和人工修复入口。

## 6. 完成标准

- 任务系统可消费至少一组真实业务事件并自动推进 assignment；
- `EVENT_COUNT` 任务不再依赖 App 手动 `/progress` 才能工作；
- 同一事件重复投递不会重复推进或重复发奖；
- assignment 进度日志可回放、可审计；
- 手动任务路径保持可用且语义清晰；
- 至少覆盖以下测试：
  - 事件驱动自动创建/命中 assignment；
  - 达标自动完成；
  - 重复事件幂等；
  - 奖励失败后的补偿重试；
  - live task 配置变更不影响存量 assignment 执行；
  - 事件延迟消费按 `occurredAt` 进入正确周期；
  - `EVENT_COUNT + MANUAL claimMode` 不会回补领取前事件。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- 事件驱动任务接入说明
- 任务进度日志与排障说明

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P1-02`；
- 直接前置：`P0-02`、`P1-01`；
- 软前置：`P0-04`；
- 完成后主要解锁：`P1-03`、`P2-02`。

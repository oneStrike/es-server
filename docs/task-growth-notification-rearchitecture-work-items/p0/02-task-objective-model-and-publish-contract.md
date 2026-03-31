# P0-02 任务目标模型与发布合同收口

## 1. 目标

把当前“任务配置、发布状态、进度推进方式、用户可见语义”混在一起的 `task` 单表合同收口成可解释、可验证、可逐步演进的最小模型。

本任务要回答三件事：

1. 任务到底在追踪什么目标；
2. 任务什么时候对用户可见、可领取、可推进；
3. assignment 在创建后应冻结哪些执行关键字段。

## 2. 范围

本任务覆盖以下内容：

- 任务目标模型与字段设计：
  - `db/schema/app/task.ts`
  - `libs/growth/src/task/task.type.ts`
  - `libs/growth/src/task/dto/task.dto.ts`
- 任务 assignment 快照模型：
  - `db/schema/app/task-assignment.ts`
- 任务服务中的可用性判断、建 assignment、上报进度、手动完成逻辑：
  - `libs/growth/src/task/task.service.ts`
- App 端“可领取任务 / 我的任务”语义：
  - `apps/app-api/src/modules/task/task.controller.ts`
- Admin 端创建、更新、上/下线入口：
  - `apps/admin-api/src/modules/task/task.controller.ts`

## 3. 当前代码锚点

- 当前 `task` 表缺少明确的“目标来源 / 事件来源”字段，任务进度只能依赖手动接口推进：
  - `db/schema/app/task.ts`
  - `apps/app-api/src/modules/task/task.controller.ts`
- `taskAssignment.taskSnapshot` 只冻结了 `rewardConfig`、`targetCount` 等少数字段，未冻结 `repeatRule`、`claimMode`、`completeMode` 等执行关键字段：
  - `db/schema/app/task-assignment.ts`
  - `libs/growth/src/task/task.service.ts`
- `getAvailableTasks()` 当前更像“可见任务目录”，而不是严格的“仍可领取任务”：
  - `libs/growth/src/task/task.service.ts`
- `findAvailableTask()` 同时承担发布校验、可推进校验与奖励补偿入口校验，语义过重：
  - `libs/growth/src/task/task.service.ts`
- 当前任务周期一律按服务端 `now` 计算，尚未定义“事件驱动任务究竟按 `occurredAt` 还是按消费时刻落周期”的正式合同：
  - `libs/growth/src/task/task.service.ts`

## 4. 非目标

- 本任务不直接落地 producer 事件消费器；
- 不立即拆分 `task_template / task_publish`；
- 不做复杂人群投放、A/B 实验、灰度策略；
- 不在本任务中完成通知合同收口；
- 不在本任务中重做用户端 UI，仅输出数据合同与最小接口调整。

## 5. 主要改动

### 5.1 新增最小任务目标模型

建议在 `task` 侧新增并固定以下字段：

- `objectiveType`
  - `MANUAL`：纯手动确认或外部人工触发；
  - `EVENT_COUNT`：基于业务事件累计次数；
- `eventCode`
  - 当 `objectiveType=EVENT_COUNT` 时必填；
  - 引用 `GrowthRuleTypeEnum` 或事件定义表中的稳定事件码；
- `objectiveConfig`
  - 预留 JSON 扩展，例如限定帖子分区、内容类型、来源端等；
- `targetCount`
  - 保留现有字段，但改为目标模型的一部分，而不是独立散落字段。

前期只支持 `MANUAL` 与 `EVENT_COUNT` 两种目标，不提前扩展成通用 DSL。

### 5.2 收口发布合同

在单表模型下明确四类字段：

- 模板展示字段：`code/title/description/icon/buttonText`
- 发布字段：`status/isEnabled/publishStartAt/publishEndAt`
- 执行字段：`claimMode/completeMode/repeatRule/objectiveType/eventCode/objectiveConfig/targetCount`
- 奖励字段：`rewardConfig`

并统一解释：

- “可见”取决于发布字段；
- “可领取”除发布字段外，还取决于 `claimMode`、用户当前周期是否已有活跃 assignment；
- “可推进”主要依赖 assignment 与快照，不依赖任务当前是否仍可发布；
- “可补偿结算”只依赖 assignment 状态与 reward 状态，不受发布时间窗口阻断。

并额外固定两条执行语义：

- `EVENT_COUNT` 任务的周期归属以事件发生时间 `occurredAt` 为准；
- `EVENT_COUNT + MANUAL claimMode` 第一阶段默认不回补领取前事件。

### 5.3 扩大 assignment 快照范围

assignment 创建时应冻结至少以下字段：

- `taskId`
- `code/title/description/icon`
- `type`
- `repeatRule`
- `claimMode`
- `completeMode`
- `objectiveType`
- `eventCode`
- `objectiveConfig`
- `targetCount`
- `rewardConfig`
- `publishStartAt/publishEndAt` 的结算相关视图

原则是：凡是会影响“这条 assignment 如何完成、何时过期、发多少奖励”的字段，都必须快照。

### 5.4 收口服务中的校验语义

本轮目标是把发布、领取、执行、补偿四类语义分清，而不是强制把 helper 名称全部重命名。当前实现允许继续保留：

- `findAvailableTask()`：承担“任务存在 + 已启用 + 已发布 + 发布时间窗有效”的最小可用校验；
- `findClaimableTask()`：在可用任务基础上服务手动领取入口；
- assignment 快照执行路径：围绕已有 assignment 与 snapshot 推进，不再依赖 live task 当前配置；
- 奖励补偿路径：围绕 `COMPLETED + rewardStatus in (PENDING, FAILED)` 的 assignment 扫描与单条重试展开。

若后续需要进一步把 helper 重命名为更细的 publish / execution / retry facade，应以后续可读性重构为准，不作为 `P0-02` 是否完成的判定条件。

### 5.5 明确 App 端读模型口径

- `getAvailableTasks()`：
  - 只返回手动领取任务；
  - 明确过滤“当前周期已领取/已完成”的任务；
  - 输出可领取原因和不可领取原因的最小枚举；
- `getMyTasks()`：
  - 只围绕 assignment 读模型；
  - 查询前先对当前用户执行到期 assignment 的即时收口；
  - 再补建新周期 auto assignment。

对于事件任务，还要明确：

- `AUTO` 领取的事件任务可在命中事件时自动建 assignment；
- `MANUAL` 领取的事件任务只有在 assignment 创建后才累计进度；
- 若未来需要“先发生事件、后补领取”能力，必须新增显式开关，而不是默认回补。

### 5.6 配置校验前置失败

所有会影响执行语义的字段在 Admin 侧 fail fast：

- `repeatRule` 非法直接报错；
- `objectiveType/eventCode/targetCount` 组合非法直接报错；
- 发布时间窗必须对“现有值 + 新值”合并后校验；
- 有活跃 assignment 的任务禁止修改影响执行语义的字段。

## 6. 完成标准

- `task` 已形成清晰的模板/发布/执行/奖励四类字段分层；
- 支持最小目标模型：`MANUAL`、`EVENT_COUNT`；
- assignment 快照已覆盖所有执行关键字段；
- App 端“可领任务 / 我的任务”口径不再混淆；
- 管理端能在提交时拦住非法 `repeatRule`、非法目标组合、非法时间窗；
- 相关测试覆盖：
  - 目标字段校验；
  - 快照冻结；
  - 周期切换后的 `getMyTasks()` 行为；
  - 下线/过期后奖励补偿仍可达；
  - 事件任务按 `occurredAt` 落周期；
  - `EVENT_COUNT + MANUAL` 不会回补领取前事件。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- App/Admin 任务接口文档
- 若增加迁移脚本，需同步 schema 变更说明与回填策略

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P0-02`；
- 直接前置：`P0-01`；
- 完成后主要解锁：`P1-02`、`P1-03`。

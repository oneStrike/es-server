# P0-01 Task 全量梳理与签到边界确认

## 目标

全量梳理当前 `task` 模块的功能模块、代码分层、表结构职责与可复用能力，明确签到一期与 `task`、`DAILY_CHECK_IN` 预留编码之间的边界，冻结后续方案的前置判断。

## 范围

1. 梳理 `task` 的 controller、service、schema、seed、测试和管理端入口。
2. 梳理 `growth`、`event-definition`、`ledger` 与签到潜在衔接点。
3. 明确“哪些能力属于签到域，哪些能力不应再由 task 承担”。
4. 明确 `GrowthRuleTypeEnum.DAILY_CHECK_IN = 6` 的治理口径。

## 当前代码锚点

- `apps/app-api/src/modules/task/task.controller.ts`
- `apps/admin-api/src/modules/task/task.controller.ts`
- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/task/task-definition.service.ts`
- `libs/growth/src/task/task-execution.service.ts`
- `libs/growth/src/task/task-runtime.service.ts`
- `libs/growth/src/task/task.service.support.ts`
- `db/schema/app/task.ts`
- `db/schema/app/task-assignment.ts`
- `db/schema/app/task-progress-log.ts`
- `libs/growth/src/growth-rule.constant.ts`
- `libs/growth/src/event-definition/event-definition.map.ts`
- `db/seed/modules/app/domain.ts`

## 非目标

1. 不在本任务中落地签到表结构和接口。
2. 不在本任务中重新设计 task 引擎。
3. 不在本任务中引入签到与 task 的联动实现。

## 主要改动

1. 形成 task 全量模块盘点结论：
   - `task` 已是成熟的目标式任务引擎；
   - 主体职责是任务定义、用户任务实例、进度推进与奖励发放；
   - 不适合作为“按天签到事实”的宿主。
2. 形成签到边界结论：
   - 签到一期完全独立于 `task`；
   - 不通过 `task_assignment` 承载签到事实；
   - 不要求 task 在一期承担签到奖励或签到记录职责。
3. 形成预留编码治理结论：
   - 保留 `GrowthRuleTypeEnum.DAILY_CHECK_IN = 6`；
   - 把 `DAILY_CHECK_IN` 从当前“可配置事件”降为“预留事件”；
   - 去掉 seed 里的签到奖励规则预置。
4. 固化后续工作包前提：
   - 签到奖励由签到域自己配置；
   - 基础奖励、连续奖励直接进入成长账本；
   - 若未来要接 task 或事件广播，另开扩展任务。

## 完成标准

1. 已形成 task 模块分层、职责和表结构的书面梳理结论。
2. 已明确“签到一期不依赖 task”的边界判断，并在工作包文档中统一表达。
3. 已明确 `DAILY_CHECK_IN = 6` 的保留与降级策略，并同步到代码治理口径。
4. 后续任务单不再把 task 联动或现存签到事件配置当作签到一期前提。

## 完成后同步文档

1. [README.md](/D:/code/es/es-server/docs/task-check-in-work-items/README.md)
2. [execution-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/execution-plan.md)
3. [development-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/development-plan.md)
4. [final-acceptance-checklist.md](/D:/code/es/es-server/docs/task-check-in-work-items/checklists/final-acceptance-checklist.md)

## 排期引用

- 优先级：`S0`
- 波次：`Wave 1`
- 状态：`completed`
- 直接后置：`P0-02`、`P0-03`
- 以 [execution-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/execution-plan.md) 为唯一事实源

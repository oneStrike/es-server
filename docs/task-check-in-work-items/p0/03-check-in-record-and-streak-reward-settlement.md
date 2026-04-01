# P0-03 签到记录、基础奖励与连续奖励结算

## 目标

定义签到事实、奖励事实、幂等键和补偿策略，保证“签到成功、奖励可补偿、连续奖励不重复”的主链路具备稳定的事务边界与可追踪性。

## 范围

1. 设计 `check_in_record` 数据模型与唯一性约束。
2. 设计 `check_in_streak_reward_rule` 与 `check_in_streak_reward_grant`。
3. 定义普通签到、补签、基础奖励、连续奖励的执行顺序。
4. 定义奖励失败补偿、幂等键和审计记录。
5. 明确签到一期如何直接接入成长账本。

## 当前代码锚点

- `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- `libs/growth/src/growth-ledger/growth-ledger.constant.ts`
- `db/schema/app/growth-ledger-record.ts`
- `db/schema/app/growth-audit-log.ts`
- `db/schema/app/growth-rule-usage-slot.ts`

## 非目标

1. 不在本任务中设计 task 联动。
2. 不在本任务中重新启用现存 `DAILY_CHECK_IN` 事件配置。
3. 不在本任务中定义最终的 App/Admin 返回结构。

## 主要改动

1. 冻结 `check_in_record` 契约，建议至少包含：
   - `userId`、`planId`、`cycleId`、`signDate`；
   - `recordType`，区分正常签到与补签；
   - `rewardStatus`；
   - `bizKey`；
   - `operatorType`、`remark`。
2. 冻结签到事实唯一性：
   - 同一用户、同一计划、同一签到日期只能存在一条有效记录；
   - 补签不会生成第二条同日期签到事实。
3. 冻结连续奖励规则与发放事实：
   - `check_in_streak_reward_rule` 配置阈值与奖励内容；
   - `check_in_streak_reward_grant` 记录某次阈值达成后的实际发放事实；
   - 是否可重复领取由规则自身控制，不依赖 task。
4. 冻结主执行顺序：
   - 写入签到事实；
   - 更新用户周期实例摘要；
   - 结算基础签到奖励；
   - 重算连续天数；
   - 结算连续奖励；
   - 写入账本审计与发放结果。
5. 冻结账本接入方式：
   - 基础奖励通过签到域直接调用 `GrowthLedgerService.applyDelta()`；
   - 连续奖励同样直连账本；
   - 一期不依赖 `growth_rule` 配置或 `DAILY_CHECK_IN` 事件定义。
6. 冻结补偿策略：
   - 签到事实成功但奖励失败，不回滚签到事实；
   - 通过 `rewardStatus`、账本来源值和审计日志进行补偿；
   - 补偿必须复用同一业务幂等键，避免重复落账。

## 完成标准

1. 普通签到与补签的签到事实模型已冻结，且具备唯一索引设计。
2. 基础奖励与连续奖励的发放事实、幂等键与补偿策略已冻结。
3. 已明确一期奖励结算完全独立于 task 和现存 `DAILY_CHECK_IN` 配置。
4. 后续接口与对账任务可以直接复用本任务定义的签到事实和奖励事实。

## 完成后同步文档

1. [development-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/development-plan.md)
2. [p1/01-app-and-admin-check-in-read-write-api.md](/D:/code/es/es-server/docs/task-check-in-work-items/p1/01-app-and-admin-check-in-read-write-api.md)
3. [p2/01-check-in-reconciliation-runtime-and-acceptance.md](/D:/code/es/es-server/docs/task-check-in-work-items/p2/01-check-in-reconciliation-runtime-and-acceptance.md)
4. [final-acceptance-checklist.md](/D:/code/es/es-server/docs/task-check-in-work-items/checklists/final-acceptance-checklist.md)

## 排期引用

- 优先级：`S0`
- 波次：`Wave 1`
- 状态：`pending`
- 硬前置：`P0-02`
- 软前置：`P0-01`
- 直接后置：`P1-01`
- 以 [execution-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/execution-plan.md) 为唯一事实源

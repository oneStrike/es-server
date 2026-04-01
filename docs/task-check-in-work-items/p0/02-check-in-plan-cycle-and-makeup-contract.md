# P0-02 签到计划、周期与补签契约

## 目标

定义签到一期的核心配置模型，覆盖签到周期、周期切片、每周期补签次数、基础奖励配置和计划发布规则，确保后续执行层、接口层和对账层共享同一套数据契约。

## 范围

1. 设计 `check_in_plan` 数据模型与发布约束。
2. 设计 `check_in_cycle` 的生成与更新规则。
3. 定义签到周期类型、周期边界、自然日口径与时区约束。
4. 定义每周期补签次数与补签日期合法性规则。
5. 冻结基础签到奖励配置的归属位置。

## 当前代码锚点

- `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- `libs/growth/src/growth-ledger/growth-ledger.constant.ts`
- `db/schema/app/growth-ledger-record.ts`
- `db/schema/app/growth-audit-log.ts`
- `libs/growth/src/growth-rule.constant.ts`
- `libs/growth/src/event-definition/event-definition.map.ts`

## 非目标

1. 不在本任务中定义 App/Admin 具体接口。
2. 不在本任务中实现连续奖励发放逻辑。
3. 不在本任务中重新启用 `DAILY_CHECK_IN` 规则配置。

## 主要改动

1. 冻结 `check_in_plan` 契约，建议至少包含：
   - `planCode`、`planName`、`status`；
   - `timezone`；
   - `cycleType`、`cycleAnchorDate`；
   - `allowMakeupCountPerCycle`；
   - `baseRewardConfig`；
   - `publishStartAt`、`publishEndAt`。
2. 冻结计划生效规则：
   - 一期只允许一个当前有效计划；
   - 计划必须显式发布后才能生效；
   - 配置变更不得影响已完成周期的历史事实。
3. 冻结 `check_in_cycle` 契约，建议至少包含：
   - `userId`、`planId`、`cycleKey`；
   - `cycleStartDate`、`cycleEndDate`；
   - `signedCount`、`makeupUsedCount`；
   - `currentStreak`、`lastSignedDate`。
4. 冻结补签规则：
   - 只能补当前周期内、早于当前自然日、且尚未签到的日期；
   - 不能补未来日期；
   - 不能跨周期补签；
   - 达到 `allowMakeupCountPerCycle` 后必须拒绝。
5. 冻结基础奖励配置来源：
   - 基础签到奖励不依赖现存 `DAILY_CHECK_IN` 事件配置；
   - 奖励直接由 `check_in_plan.baseRewardConfig` 管理。

## 完成标准

1. 签到计划、周期实例和补签额度的字段模型已冻结。
2. 周期计算与自然日口径有明确时区规则，不存在歧义。
3. 每周期补签次数和补签日期合法性有可执行、可测试的规则定义。
4. 文档已明确基础奖励配置归属在签到计划，而不是规则后台或 task。

## 完成后同步文档

1. [README.md](/D:/code/es/es-server/docs/task-check-in-work-items/README.md)
2. [development-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/development-plan.md)
3. [p0/03-check-in-record-and-streak-reward-settlement.md](/D:/code/es/es-server/docs/task-check-in-work-items/p0/03-check-in-record-and-streak-reward-settlement.md)
4. [p1/01-app-and-admin-check-in-read-write-api.md](/D:/code/es/es-server/docs/task-check-in-work-items/p1/01-app-and-admin-check-in-read-write-api.md)

## 排期引用

- 优先级：`S0`
- 波次：`Wave 1`
- 状态：`pending`
- 硬前置：`P0-01`
- 直接后置：`P0-03`、`P1-01`
- 以 [execution-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/execution-plan.md) 为唯一事实源

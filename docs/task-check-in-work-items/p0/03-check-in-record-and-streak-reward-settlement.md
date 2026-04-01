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
   - `rewardStatus`、`rewardResultType`；
   - `bizKey`；
   - `baseRewardLedgerIds`；
   - `operatorType`、`remark`；
   - `lastRewardError`、`context`。
2. 冻结签到事实唯一性：
   - 同一用户、同一计划、同一签到日期只能存在一条有效记录；
   - 补签不会生成第二条同日期签到事实；
   - `check_in_record` 通过 `(userId, planId, signDate)` 唯一约束保证按天事实唯一；
   - `check_in_record` 通过 `(userId, bizKey)` 唯一约束保证补偿链路和重复请求幂等；
   - 同一用户下 `bizKey` 必须稳定且可重复重放，用于补偿链路幂等。
3. 冻结签到事实状态枚举：
   - `recordType` 使用数字枚举，`1 = NORMAL`、`2 = MAKEUP`；
   - `rewardStatus` 仅表示基础签到奖励状态，不覆盖连续奖励，使用数字枚举 `0 = PENDING`、`1 = SUCCESS`、`2 = FAILED`；
   - `rewardResultType` 用于区分基础签到奖励的实际落账结果，使用数字枚举 `1 = APPLIED`、`2 = IDEMPOTENT`、`3 = FAILED`；
   - 当 `check_in_plan.baseRewardConfig` 为空时，表示该计划不发放基础签到奖励；此时 `rewardStatus`、`rewardResultType` 允许为 `null`，`baseRewardLedgerIds` 保持空数组，且不进入补偿队列。
4. 冻结连续奖励规则与发放事实：
   - `check_in_streak_reward_rule` 配置阈值与奖励内容；
   - `check_in_streak_reward_rule` 通过 `(planId, streakDays)` 唯一约束保证阈值唯一；
   - `check_in_streak_reward_rule.rewardConfig` 不允许为空，必须在定义/发布阶段完成非空与正整数校验；
   - `check_in_streak_reward_grant` 记录某次阈值达成后的实际发放事实，至少包含 `grantStatus`、`grantResultType`、`ledgerIds`、`lastGrantError`、`planSnapshotVersion`、`context`；
   - `check_in_streak_reward_grant` 通过 `(userId, bizKey)` 唯一约束保证连续奖励发放与补偿幂等；
   - `grantStatus` 仅表示连续奖励发放状态，使用数字枚举 `0 = PENDING`、`1 = SUCCESS`、`2 = FAILED`；
   - `grantResultType` 用于区分连续奖励的实际落账结果，使用数字枚举 `1 = APPLIED`、`2 = IDEMPOTENT`、`3 = FAILED`；
   - 未命中连续阈值时不创建 `check_in_streak_reward_grant`，避免把“尚未达标”误记成待发奖励；
   - 是否可重复领取由规则自身控制，不依赖 task；
   - `repeatable = false` 时，同一周期内同一规则最多发放一次；
   - `repeatable = true` 时，以 `triggerSignDate` 区分同一周期内的多次合法触发。
5. 冻结主执行顺序：
   - 获取或创建 `check_in_cycle`；
   - 写入签到事实；
   - 更新用户周期实例摘要；
   - 结算基础签到奖励；
   - 重算连续天数；
   - 获取或创建连续奖励发放事实；
   - 结算连续奖励；
   - 写入账本审计与发放结果。
6. 冻结业务幂等键与账本 key 规则：
   - 签到事实 `bizKey` 采用 `checkin:record:plan:{planId}:cycle:{cycleKey}:user:{userId}:date:{signDate}`；
   - 基础奖励先生成稳定基础 key `checkin:base:record:{recordId}:user:{userId}`，再按资产类型派生 `:POINTS` / `:EXPERIENCE`；
   - 连续奖励先生成稳定基础 key `checkin:streak:grant:{grantId}:rule:{ruleId}:user:{userId}`，再按资产类型派生 `:POINTS` / `:EXPERIENCE`；
   - 奖励补偿必须复用原始奖励基础 key，不得重新发明新 key。
7. 冻结账本接入方式：
   - 基础奖励通过签到域直接调用 `GrowthLedgerService.applyDelta()`；
   - 连续奖励同样直连账本；
   - 一期不依赖 `growth_rule` 配置或 `DAILY_CHECK_IN` 事件定义；
   - `GrowthLedgerSourceEnum` 需补齐 `check_in_base_bonus`、`check_in_streak_bonus` 两个专属来源值；
   - 账本和审计上下文至少应可追踪 `planId`、`cycleId`、`recordId`、`grantId`。
8. 冻结连续奖励与补签语义：
   - 补签参与当前周期内连续天数重算；
   - 补签若首次补齐断点并达到某连续阈值，允许补发该阈值对应的连续奖励；
   - 同一次补签或奖励补算若命中当前周期内多个“历史未发阈值”，则应一次性补发全部命中的未发奖励，而不是只发最高档；
   - 同一阈值在同一周期内默认只补发一次，除非规则显式声明 `repeatable = true`；
   - 连续奖励的触发判断与补偿重放都以 `triggerSignDate` 为准，不跨周期回溯；
   - 补签范围严格限制在当前周期内；对历史已结束周期不补建周期实例，也不补发跨周期连续奖励。
9. 冻结补偿策略：
   - 签到事实成功但奖励失败，不回滚签到事实；
   - 通过 `rewardStatus`、`grantStatus`、账本来源值和审计日志进行补偿；
   - 基础奖励补偿复用原 `check_in_record` 和原始奖励 `bizKey`；
   - 连续奖励补偿复用原 `check_in_streak_reward_grant` 和原始奖励 `bizKey`；
   - 补偿必须复用同一业务幂等键，避免重复落账。

## 完成标准

1. 普通签到与补签的签到事实模型已冻结，且具备唯一索引设计。
2. 基础奖励与连续奖励的发放事实、幂等键命名、账本来源值与补偿策略已冻结。
3. 已明确补签对连续天数与连续奖励的影响规则，后续实现无需自行猜测。
4. 已明确一期奖励结算完全独立于 task 和现存 `DAILY_CHECK_IN` 配置。
5. 后续接口与对账任务可以直接复用本任务定义的签到事实和奖励事实。

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

# 签到模块改造最终验收清单

## 功能验收

- [x] 签到计划已改为真实自然周 / 月周期模型。
  - 证据：`buildCycleFrame` 已按自然周 / 月计算周期边界；`check-in.service.support.spec.ts` 覆盖了周周期固定按周一到周日切片。
- [x] 基础奖励已从统一 `baseRewardConfig` 切换为 `dailyRewardRules`。
  - 证据：`check_in_plan.base_reward_config` 已从 schema 与 migration 中移除，新增 `check_in_daily_reward_rule` 表；`check-in-definition.service.spec.ts` 校验创建计划时不再落旧字段。
- [x] 新增按日奖励规则 owner，并已冻结到周期快照。
  - 证据：新增 `db/schema/app/check-in-daily-reward-rule.ts`、`db/relations/app.ts` relation；`check-in.service.support.spec.ts` 校验 `buildPlanSnapshot` 冻结 `dailyRewardRules`。
- [x] 管理端计划创建 / 更新已收口“边界对齐、排期切换、不重叠、不立即切换”规则。
  - 证据：`check-in-definition.service.ts` 新增边界对齐、窗口冲突与非立即切换校验；`check-in-definition.service.spec.ts` 覆盖月 / 周边界、窗口重叠与当前周期立即切换拒绝。
- [x] App 端签到 / 补签已按自然周期与当前计划窗口执行。
  - 证据：`check-in-execution.service.ts` 已按 `buildCycleFrame + resolveSnapshotRewardForDate` 处理签到 / 补签；`check-in-execution.service.spec.ts` 覆盖动作返回中的新奖励解析字段。
- [x] 补签只能补当前周期内今天之前的日期，且继续受每周期补签次数限制。
  - 证据：`assertMakeupAllowed` 继续限制当前周期、今天之前与 `allowMakeupCountPerCycle`；主链路仍在写后重算 `makeupUsedCount` 并做上限校验。
- [x] 基础奖励已按 `dayIndex` 正确解析并结算到账本。
  - 证据：`resolveSnapshotRewardForDate` 按 `signDate -> dayIndex -> rewardConfig` 解析奖励；`check-in-execution.service.spec.ts` 覆盖冻结奖励快照写表与补偿时优先使用 `resolvedRewardConfig`。
- [x] 连续奖励仍可独立发放，但只在当前周期内计算并在跨周期后重置。
  - 证据：连续奖励仍由 `check_in_streak_reward_grant` 独立结算；候选解析和聚合重算继续基于当前周期记录与当前周期快照，周期切片已切到自然周 / 月。

## 契约与回归验收

- [x] 管理端计划详情返回 `dailyRewardRules` 与连续奖励规则，未继续依赖旧统一基础奖励字段。
  - 证据：`check-in-definition.service.ts#getPlanDetail` 已并行读取 `dailyRewardRules` 与 `streakRewardRules`，`CheckInPlanDetailResponseDto` 已新增 `dailyRewardRules`。
- [x] 管理端 `reconciliation/page` 已能返回与按日奖励解析一致的对账信息，不会因基础奖励改造丢失排障依据。
  - 证据：`check-in-runtime.service.ts#getReconciliationPage` 已返回 `rewardDayIndex` 与 `resolvedRewardConfig`；`check-in-runtime.service.spec.ts` 覆盖该契约。
- [x] 管理端 `reconciliation/repair` 仍可补偿基础奖励 / 连续奖励，且补偿依据与签到记录 / 周期快照冻结的奖励语义一致。
  - 证据：`check-in-execution.service.ts#repairReward` 仍保留两类补偿入口；`check-in-execution.service.spec.ts` 覆盖公共入口分派与基础奖励补偿优先使用签到记录冻结快照。
- [x] App 端 `summary`、`calendar`、`sign`、`makeup` 返回字段与自然周期、按日奖励语义一致。
  - 证据：`summary` / `calendar` 已切到自然周期字段与按日奖励展示字段，`sign` / `makeup` 动作返回已包含 `rewardDayIndex` 与 `resolvedRewardConfig`；`check-in-runtime.service.spec.ts` 与 `check-in-execution.service.spec.ts` 已覆盖。
- [x] 同一自然日不会命中两个生效计划。
  - 证据：`assertPublishedPlanWindowAvailable` 已阻止已发布计划窗口重叠；`check-in-definition.service.spec.ts` 已覆盖已发布计划窗口冲突。
- [x] 排期切换不会在当前周期内立即生效。
  - 证据：`assertNoImmediateSwitch` 已按当前自然周期边界拒绝即时切换；`check-in-definition.service.spec.ts` 已覆盖当前周期内立即切换拒绝。
- [x] 切换到新计划后，旧计划连续奖励不会继承到新计划。
  - 证据：周期、签到记录与连续奖励发放事实仍以 `planId + cycleId + planSnapshotVersion` 绑定，切到新计划后会创建新的周期与快照，不复用旧计划的周期聚合和发放事实。
- [x] 既有错误语义、幂等行为和奖励失败补偿入口未发生回归。
  - 证据：奖励失败仍写回 `FAILED` 状态并保留补偿入口；幂等键与 `onConflictDoNothing` 逻辑未移除，补偿入口 `repairReward` 仍可用。

## 数据与迁移验收

- [x] `pnpm db:generate` 已完成，迁移文件由规范流程生成。
  - 证据：已生成 `db/migration/20260409013618_brown_quicksilver/migration.sql`。
- [x] `db/comments/generated.sql` 已同步更新，`pnpm db:comments:check` 通过。
  - 证据：`pnpm db:comments:generate` 已更新 comments 产物；`pnpm db:comments:check` 输出 `Table comments: 75 / Column comments: 911 / Warnings: 0`。
- [x] 计划、周期、签到记录和奖励规则表的字段、注释和推导类型一致。
  - 证据：`check-in-plan.ts`、`check-in-cycle.ts`、`check-in-record.ts`、`check-in-daily-reward-rule.ts`、`check-in.type.ts` 与 DTO 已同步切到 `dailyRewardRules` / `rewardDayIndex` / `resolvedRewardConfig`。
- [x] 本轮不兼容历史数据的边界已明确，未引入历史数据回填或双写负担。
  - 证据：迁移直接删除旧 `base_reward_config`，未增加兼容双写字段；工作包 README 已明确“不兼容历史数据，也不做历史数据回填”。

## 验证命令与输出

- [x] `pnpm type-check`
  - 输出：`tsc --noEmit -p tsconfig.build.json` 通过。
- [x] `pnpm db:comments:check`
  - 输出：`Table comments: 75`、`Column comments: 911`、`Warnings: 0`。
- [x] 变更文件 `eslint`
  - 输出：目标文件 `pnpm exec eslint ...` 通过，无错误输出。
- [x] 关键测试命令
  - 输出：`pnpm test -- --runInBand --runTestsByPath libs/growth/src/check-in/test/check-in.service.support.spec.ts libs/growth/src/check-in/test/check-in-definition.service.spec.ts libs/growth/src/check-in/test/check-in-execution.service.spec.ts libs/growth/src/check-in/test/check-in-runtime.service.spec.ts` 输出 `Test Suites: 4 passed, 4 total`、`Tests: 16 passed, 16 total`。

## 阻塞上线项

- [x] 无阻塞上线项
- 阻塞项记录：
  - 暂无

## 最终签收问题与结论

- 签收问题：
  - 暂无
- 最终结论：
  - 本轮签到改造的主链路代码、迁移和针对性验证已完成，可进入提交、联调或后续评审阶段。

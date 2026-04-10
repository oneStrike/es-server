# 签到模块去版本化与奖励配置锁定重构计划

## Summary
签到模块改为“单计划单份当前奖励定义”模型，不再维护计划版本、周期快照和规则表版本并存。奖励配置统一收敛到 `check_in_plan` 的单个 JSON 字段中，签到运行时始终读取当前计划定义；一旦某计划已产生任意 `check_in_record`，后台立即禁止创建或更新该计划的奖励配置。

历史解释只保留事实级冻结，不保留周期级冻结。基础签到记录继续冻结命中奖励来源与奖励配置；连续奖励发放事实改为自包含规则快照，确保删掉规则表后仍可补偿、对账和展示。

## Key Changes
- 数据模型去版本化。
  删除 `check_in_plan.version`；删除 `check_in_cycle.planSnapshotVersion` 和 `check_in_cycle.planSnapshot`；删除 `check_in_streak_reward_grant.planSnapshotVersion`。
- 奖励配置去表化。
  删除 `check_in_date_reward_rule`、`check_in_pattern_reward_rule`、`check_in_streak_reward_rule` 三张表；在 `check_in_plan` 新增单个 `rewardDefinition` JSON 字段，结构固定为：
  `baseRewardConfig`
  `dateRewardRules`
  `patternRewardRules`
  `streakRewardRules`
- 定义层改为覆盖式写入。
  `createPlanRewardConfig` / `updatePlanRewardConfig` 不再递增版本、不再复制旧规则；直接读写 `check_in_plan.rewardDefinition`。创建要求当前无奖励定义，更新要求当前已有奖励定义。
- 奖励配置锁定规则。
  在 `libs/growth/src/check-in/check-in-definition.service.ts` 中为奖励配置写入链路增加统一断言：只要当前 `planId` 已存在任意 `check_in_record`，就抛 `ConflictException('计划已产生签到数据，不允许修改奖励配置')`。该限制只作用于奖励配置 create/update，不扩展到计划基础字段或状态更新。
- 运行时去快照化。
  `libs/growth/src/check-in/check-in-execution.service.ts` 和 `libs/growth/src/check-in/check-in-runtime.service.ts` 不再构建或读取周期快照；当前周期摘要、日历展示、签到执行、补签执行、下一档连续奖励判断全部直接读取当前计划的 `rewardDefinition`。
- 事实级冻结保留并收紧为自包含。
  `check_in_record` 保留 `resolvedRewardSourceType` 和 `resolvedRewardConfig`，删除 `resolvedRewardRuleId`，改为 `resolvedRewardRuleKey`，约定值为：
  `null` 对应默认基础奖励
  `DATE:YYYY-MM-DD`
  `WEEKDAY:<1-7>`
  `MONTH_DAY:<1-31>`
  `MONTH_LAST_DAY`
- 连续奖励发放事实自包含。
  `check_in_streak_reward_grant` 保留为真实发放事实表，但删除对规则表和版本的依赖：删除 `ruleId`、`planSnapshotVersion`，新增 `ruleCode`、`streakDays`、`rewardConfig`、`repeatable`。补偿、幂等键和对账全部基于这些自包含字段运行。

## Public Interfaces / Types
- 管理端奖励配置 DTO 入口保持不变：
  `CreateCheckInPlanRewardConfigDto`
  `UpdateCheckInPlanRewardConfigDto`
  外部请求/详情仍使用 `baseRewardConfig + 三组规则数组` 形状，服务层只调整持久化方式。
- 计划 DTO 去掉版本语义。
  `BaseCheckInPlanDto.version` 删除，所有计划详情/分页/摘要不再返回版本号。
- 周期 DTO 去掉快照暴露。
  `BaseCheckInCycleDto.planSnapshotVersion` 和 `BaseCheckInCycleDto.planSnapshot` 删除；`CheckInVirtualCycleView` 同步删除这两个字段。
- 记录与发放 DTO 去 ID 化。
  `BaseCheckInRecordDto.resolvedRewardRuleId` 改为 `resolvedRewardRuleKey`。
  `CheckInGrantItemDto.ruleId` 改为 `ruleCode`、`streakDays`、`rewardConfig`。
  `BaseCheckInStreakRewardGrantDto` 同步删除 `ruleId`、`planSnapshotVersion`。
- 类型与支持方法同步收缩。
  删除 `CheckInPlanSnapshot*` 系列类型、`buildPlanSnapshot`、`getCycleSnapshot`、`shouldBumpPlanVersion`、`getPlanDateRewardRules`、`getPlanPatternRewardRules`、`getPlanRules` 及其相关 row/insert 类型；新增 `CheckInRewardDefinition`、`CheckInResolvedRewardRuleKey`、`CreateCheckInGrantSnapshotInput` 一类的直接类型。

## Test Plan
- 定义层测试：
  创建奖励配置时直接写 `rewardDefinition`，不再写规则表，不再递增版本。
- 定义层测试：
  更新奖励配置时直接覆盖当前奖励定义，不再复制旧规则或插入新版本规则。
- 锁定测试：
  当同计划存在任意 `check_in_record` 时，`createPlanRewardConfig` 和 `updatePlanRewardConfig` 都抛冲突异常。
- 执行层测试：
  首次创建周期后但尚未签到时，当前周期读取和日历读取仍直接跟随当前计划奖励定义；不再依赖周期快照。
- 执行层测试：
  基础签到记录会写入 `resolvedRewardRuleKey` 与 `resolvedRewardConfig`；连续奖励发放事实会写入 `ruleCode`、`streakDays`、`rewardConfig`。
- 补偿/对账测试：
  删除规则表后，`repairReward` 仍能基于记录事实和 grant 自包含快照完成补偿；管理端对账页返回新的 key/快照字段。
- 验证命令：
  `pnpm type-check`
  `pnpm test -- --runInBand --runTestsByPath libs/growth/src/check-in/test/check-in-definition.service.spec.ts libs/growth/src/check-in/test/check-in-execution.service.spec.ts libs/growth/src/check-in/test/check-in-runtime.service.spec.ts libs/growth/src/check-in/test/check-in.service.support.spec.ts`

## Assumptions
- “计划已产生签到数据”最终口径固定为存在 `check_in_record`；仅有 `check_in_cycle` 不触发奖励配置锁定。
- 不考虑历史兼容，允许删除旧字段、旧表、旧 DTO 字段和旧类型，不提供双写或过渡逻辑。
- `check_in_streak_reward_grant` 视为必要事实表，保留；`check_in_cycle` 视为必要聚合表，保留；三张奖励规则表视为非必要配置表，删除。
- 管理端和前端可以接受记录/发放接口从“规则 ID”切换为“规则 key / 规则快照”。

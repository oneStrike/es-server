# 签到奖励规则重构设计

## 1. 背景

当前签到模块的基础奖励规则按 `dayIndex` 建模。周计划使用 `1..7` 表示星期，月计划使用 `1..31` 表示每月几号。该模型只能表达「每周三固定奖励」「每月 3 号固定奖励」，不能表达「`2026-05-03` 与 `2026-06-03` 奖励不同」这类按完整日期配置的需求。

现阶段前端尚未对接签到奖励配置，不要求兼容历史前端契约；本次设计允许直接替换现有按日奖励模型，但仍需保留规则语义，不能退化为纯前端展开后的日期列表。

## 2. 目标

- 支持按完整日期配置签到基础奖励。
- 支持按周期模式配置签到基础奖励，并保留规则语义。
- 周计划支持「每周几」模式。
- 月计划支持「每月几号」与「每月最后一天」模式。
- 运行时统一按 `具体日期规则 > 周期模式规则 > 默认奖励` 解析奖励。
- 保留现有周期快照冻结、补签、奖励补偿和对账能力。

## 3. 非目标

- 不改连续签到奖励规则模型。
- 不兼容旧的 `dailyRewardRules` DTO、管理端页面或旧前端字段。
- 不支持更复杂的自然日表达，例如「每月倒数第 2 天」「每月第 2 个周三」。
- 不引入面向前端的批量展开语法，也不把规则语义下沉为纯日期列表。

## 4. 术语

- 默认奖励：计划级 `baseRewardConfig`，在未命中其他规则时兜底。
- 具体日期规则（date reward rule）：直接绑定某个自然日，例如 `2026-05-03`。
- 周期模式规则（pattern reward rule）：基于自然周期重复生效的规则。
- 规则来源：签到记录最终命中的奖励来源类型，用于读模型和补偿链路解释。

## 5. 总体方案

签到基础奖励拆为三层来源：

1. 具体日期规则 `dateRewardRules`
2. 周期模式规则 `patternRewardRules`
3. 默认奖励 `baseRewardConfig`

运行时解析顺序固定为：

`dateRewardRule > patternRewardRule > baseRewardConfig`

若三层都未命中，则该次签到视为无基础奖励。

### 5.1 周期模式定义

- 周计划：
  - `WEEKDAY`：每周几，取值 `1..7`，其中 `1=周一`，`7=周日`
- 月计划：
  - `MONTH_DAY`：每月几号，取值 `1..31`
  - `MONTH_LAST_DAY`：每月最后一天

### 5.2 月计划特殊规则

- `MONTH_DAY=29/30/31` 在不存在该日期的月份直接跳过，不自动折算到月末。
- `MONTH_LAST_DAY` 作为独立语义存在，不与会在自然月末重叠的 `MONTH_DAY=29/30/31` 混用。

## 6. 数据模型

### 6.1 新增表：`check_in_date_reward_rule`

字段建议：

- `id`
- `planId`
- `planVersion`
- `rewardDate`
- `rewardConfig`
- `createdAt`
- `updatedAt`

约束：

- 唯一键：`(planId, planVersion, rewardDate)`
- `rewardDate` 使用 `date` 语义
- `rewardConfig` 继续沿用现有奖励配置结构，仅支持 `points` / `experience`

### 6.2 新增表：`check_in_pattern_reward_rule`

字段建议：

- `id`
- `planId`
- `planVersion`
- `patternType`
- `weekday`
- `monthDay`
- `rewardConfig`
- `createdAt`
- `updatedAt`

`patternType` 取值：

- `WEEKDAY`
- `MONTH_DAY`
- `MONTH_LAST_DAY`

字段约束：

- `WEEKDAY`：必须有 `weekday`，且 `monthDay` 为空
- `MONTH_DAY`：必须有 `monthDay`，且 `weekday` 为空
- `MONTH_LAST_DAY`：`weekday` 与 `monthDay` 都为空

唯一性约束建议：

- `WEEKDAY`：同一计划版本下 `weekday` 唯一
- `MONTH_DAY`：同一计划版本下 `monthDay` 唯一
- `MONTH_LAST_DAY`：同一计划版本下最多一条

### 6.3 删除或替换现有按日规则表

现有 `check_in_daily_reward_rule` 不再保留。其职责由 `check_in_date_reward_rule` 与 `check_in_pattern_reward_rule` 替代。

### 6.4 签到记录扩展

`check_in_record` 不再使用 `rewardDayIndex` 表达奖励命中结果，改为记录以下冻结信息：

- `resolvedRewardSourceType`
  - `DATE_RULE`
  - `PATTERN_RULE`
  - `BASE_REWARD`
- `resolvedRewardRuleId`
  - 命中具体规则时记录对应规则主键
  - 命中默认奖励时为空
- `resolvedRewardConfig`

`signDate` 已是完整日期，不再需要额外的 `dayIndex` 快照字段。

### 6.5 周期快照扩展

`check_in_cycle.planSnapshot` 中的基础奖励快照结构调整为：

- `baseRewardConfig`
- `dateRewardRules`
- `patternRewardRules`
- `streakRewardRules`

这样可继续保证：

- 当前周期内签到解释稳定
- 后续补偿使用签到时的快照解释
- 对账页可解释奖励来源

## 7. DTO 与接口契约

### 7.1 管理端配置 DTO

原 `dailyRewardRules` 字段替换为：

- `dateRewardRules`
- `patternRewardRules`

建议新增 DTO：

- `check-in-date-reward-rule.dto.ts`
- `check-in-pattern-reward-rule.dto.ts`

建议字段：

#### `CreateCheckInDateRewardRuleDto`

- `rewardDate`
- `rewardConfig`

#### `CreateCheckInPatternRewardRuleDto`

- `patternType`
- `weekday?`
- `monthDay?`
- `rewardConfig`

### 7.2 详情与读模型响应

管理端计划详情返回：

- `baseRewardConfig`
- `dateRewardRules`
- `patternRewardRules`
- `streakRewardRules`

App / Admin 运行态读模型去掉 `rewardDayIndex`，改返回：

- `resolvedRewardSourceType`
- `resolvedRewardRuleId`
- `resolvedRewardConfig`

## 8. 规则校验

### 8.1 基础校验

- `rewardConfig` 必须为合法正整数奖励对象。
- 具体日期规则 `rewardDate` 必须落在计划窗口内。
- 周期模式规则必须与计划类型匹配：
  - 周计划只允许 `WEEKDAY`
  - 月计划只允许 `MONTH_DAY`、`MONTH_LAST_DAY`

### 8.2 冲突校验

禁止同一计划版本内出现会在同一天同时命中的两条周期模式规则。

具体约束：

- 周计划：同一 `weekday` 只能有一条规则。
- 月计划：同一 `monthDay` 只能有一条规则。
- 月计划中，`MONTH_LAST_DAY` 存在时，不允许再配置 `MONTH_DAY=29/30/31`。

说明：

- `MONTH_DAY=29/30/31` 都可能在某些月份与 `MONTH_LAST_DAY` 命中同一天。
- 为避免给周期模式再引入内部优先级，本次直接在配置阶段禁止这类组合。

### 8.3 版本递增

以下任一变更继续触发 `plan.version` 递增：

- `baseRewardConfig`
- `dateRewardRules`
- `patternRewardRules`
- `streakRewardRules`
- 周期类型
- 计划起止时间
- 每周期补签次数

## 9. 运行时解析

统一新增奖励解析器，输入为：

- 当前周期快照
- `signDate`

输出为：

- `resolvedRewardSourceType`
- `resolvedRewardRuleId`
- `resolvedRewardConfig`

解析步骤：

1. 先按 `signDate` 精确匹配 `dateRewardRules`
2. 未命中时，按计划类型匹配 `patternRewardRules`
3. 未命中时，回退 `baseRewardConfig`
4. 三层都未命中则返回空奖励

### 9.1 周计划匹配

- 将 `signDate` 转为自然周几
- 匹配 `patternType = WEEKDAY` 且 `weekday` 相等的规则

### 9.2 月计划匹配

- `MONTH_DAY`：匹配自然日号数
- `MONTH_LAST_DAY`：匹配当前日期是否该月最后一天

## 10. 执行链路影响

以下能力保留现有流程，仅替换基础奖励解析与冻结字段：

- `signToday`
- `makeup`
- `repairReward`
- `getSummary`
- `getCalendar`
- `getMyRecords`
- `getReconciliationPage`

影响点：

- 创建签到记录时冻结新的奖励来源字段
- 补签继续使用周期快照解析历史日期奖励
- 奖励补偿继续使用记录上冻结的 `resolvedRewardConfig`
- 对账页和动作返回不再依赖 `rewardDayIndex`

连续奖励规则解析、发放事实创建、账本结算与幂等策略不在本次设计范围内变更。

## 11. 迁移策略

由于前端尚未对接且无需兼容，本次直接采用破坏式替换：

- 删除旧 `dailyRewardRules` 契约
- 替换旧按日奖励表
- 删除运行态中的 `rewardDayIndex`
- 不做历史数据双写或回填

若数据库中已存在测试数据，可通过一次性迁移脚本清空旧按日奖励规则并创建新表结构，但该脚本只服务开发环境，不纳入业务长期契约。

## 12. 测试策略

### 12.1 Support 层

- 周计划 `WEEKDAY` 匹配成功
- 月计划 `MONTH_DAY` 匹配成功
- 月计划 `MONTH_LAST_DAY` 匹配成功
- `MONTH_DAY=29/30/31` 在不存在该日期的月份跳过
- `dateRewardRule` 覆盖 `patternRewardRule`
- `patternRewardRule` 覆盖 `baseRewardConfig`
- 三层都未命中时返回空奖励

### 12.2 Definition 层

- 创建奖励配置时写入 `dateRewardRules` 与 `patternRewardRules`
- 周计划拒绝月模式规则
- 月计划拒绝周模式规则
- 月计划拒绝与 `MONTH_LAST_DAY` 冲突的 `MONTH_DAY=29/30/31`
- 任一奖励配置变更触发版本递增

### 12.3 Execution 层

- `2026-05-03` 与 `2026-06-03` 可命中不同日期奖励
- 无日期规则时正确命中模式规则
- 无日期规则与模式规则时回退默认奖励
- 签到记录正确冻结奖励来源、规则 ID 与奖励配置
- 补签与奖励补偿继续基于冻结结果执行

### 12.4 Runtime 层

- `summary` / `calendar` 返回正确的计划奖励展示
- `record` / `reconciliation` 返回正确的奖励来源字段
- 读模型不再依赖 `rewardDayIndex`

## 13. 实现顺序建议

1. 调整 schema、迁移与 `db/schema` 导出
2. 调整签到域类型与 DTO
3. 替换 `CheckInServiceSupport` 中的奖励校验、快照与解析逻辑
4. 调整 definition / execution / runtime 三个 service
5. 更新测试并删除旧 `dayIndex` 相关断言
6. 跑文档与类型检查，补最小范围行为测试

## 14. 风险与决策

- 风险：若模式规则冲突校验做得不彻底，运行时会出现多规则同时命中的歧义。
  - 决策：在配置阶段阻断冲突，不在运行时做二次优先级兜底。
- 风险：删除 `rewardDayIndex` 后，前端若仍依赖旧字段会失效。
  - 决策：本次视为破坏式调整，不保留兼容字段。
- 风险：月末语义若与 `29/30/31` 混用，会带来跨月边界歧义。
  - 决策：`MONTH_LAST_DAY` 作为独立模式，且禁止与 `29/30/31` 共存。

## 15. 结论

本方案通过引入「具体日期规则 + 周期模式规则 + 默认奖励」三层模型，解决现有签到奖励只能按 `dayIndex` 配置的问题，同时保留「每周几」「每月几号」「每月最后一天」的规则语义。方案不追求兼容历史契约，适合在前端未接入阶段直接替换现有基础奖励模型。

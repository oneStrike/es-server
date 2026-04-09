# 签到奖励规则重构设计（开发环境实施版）

## 1. 背景与适用范围

### 1.1 问题背景

当前签到模块的基础奖励规则按 `dayIndex` 建模。周计划使用 `1..7` 表示星期，月计划使用 `1..31` 表示每月几号。该模型只能表达「每周三固定奖励」「每月 3 号固定奖励」，不能表达「`2026-05-03` 与 `2026-06-03` 奖励不同」这类按完整日期配置的需求。

本次改造目标是在保留周期规则语义的前提下，引入可按完整日期配置的基础奖励模型。

### 1.2 仓库现状

当前仓库已经存在完整的签到公开契约与冻结链路，本次改造不是“只改配置页”，而是完整的破坏式重构：

- Admin / App 已公开签到相关接口，且 DTO 已暴露 `dailyRewardRules`、`rewardDayIndex` 等字段。
- `check_in_cycle.planSnapshot` 已冻结 `dailyRewardRules`。
- `check_in_record` 已持久化 `rewardDayIndex` 与 `resolvedRewardConfig`。
- 管理端相关测试契约也已基于旧字段命名。

因此，本方案必须同时覆盖 schema、快照、DTO、运行态读模型与执行链路，不能只替换单个规则表。

### 1.3 适用前提

本方案只适用于开发环境验证，不覆盖线上环境或任何需要保留历史签到数据的迁移场景。

落地前必须先清空整个签到域数据，再执行 schema 与契约替换。需要清空的数据包括：

- `check_in_plan`
- `check_in_cycle`
- `check_in_record`
- `check_in_streak_reward_grant`
- `check_in_streak_reward_rule`
- `check_in_daily_reward_rule`
- 若已存在新表，也一并清空 `check_in_date_reward_rule`、`check_in_pattern_reward_rule`

若当前环境中存在需要保留的 `check_in_cycle.planSnapshot`、`check_in_record` 或补偿事实，本方案不能直接执行，必须另行设计兼容迁移或历史回填方案；该类场景不在本文档范围内。

## 2. 目标

- 支持按完整日期配置签到基础奖励。
- 支持按周期模式配置签到基础奖励，并保留规则语义。
- 周计划支持「每周几」模式。
- 月计划支持「每月几号」与「每月最后一天」模式。
- 运行时统一按 `具体日期规则 > 周期模式规则 > 默认奖励` 解析奖励。
- 保留现有周期快照冻结、补签、奖励补偿和对账能力。

## 3. 非目标

- 不改连续签到奖励规则模型。
- 不提供线上兼容迁移方案，不保留历史数据。
- 不兼容旧的 `dailyRewardRules` DTO、旧的 `rewardDayIndex` 记录语义或旧前端字段。
- 不支持更复杂的自然日表达，例如「每月倒数第 2 天」「每月第 2 个周三」。
- 不引入面向前端的批量展开语法，也不把规则语义下沉为纯日期列表。
- 不新增旧新并存的双读、双写或过渡响应形态。

## 4. 术语

- 默认奖励：计划级 `baseRewardConfig`，在未命中其他规则时兜底。
- 具体日期规则（date reward rule）：直接绑定某个自然日，例如 `2026-05-03`。
- 周期模式规则（pattern reward rule）：基于自然周期重复生效的规则。
- 规则来源：签到记录最终命中的奖励来源类型，用于读模型与补偿链路解释。
- 展示天序号：运行态日历为了展示周期内第几天而推导出的字段，不承载奖励来源语义，也不持久化到签到记录。

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

### 5.3 展示字段约定

- 记录级基础奖励命中字段 `rewardDayIndex` 从签到记录中移除。
- 若运行态日历仍需要展示“该自然日在当前周期中的第几天”，继续按 `signDate` 和 `cycleType` 现算 `dayIndex` 展示字段。
- 上述展示字段只服务 UI，不再表达奖励来源，也不参与补偿或对账解释。

## 6. 数据模型

### 6.1 新增表：`check_in_date_reward_rule`

字段：

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

字段：

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

唯一性约束：

- `WEEKDAY`：同一计划版本下 `weekday` 唯一
- `MONTH_DAY`：同一计划版本下 `monthDay` 唯一
- `MONTH_LAST_DAY`：同一计划版本下最多一条

### 6.3 替换现有按日规则表

现有 `check_in_daily_reward_rule` 不再保留，其职责由 `check_in_date_reward_rule` 与 `check_in_pattern_reward_rule` 替代。

### 6.4 签到记录冻结字段

`check_in_record` 不再使用 `rewardDayIndex` 表达奖励命中结果，改为记录以下冻结信息：

- `resolvedRewardSourceType`
  - `DATE_RULE`
  - `PATTERN_RULE`
  - `BASE_REWARD`
- `resolvedRewardRuleId`
  - 命中 `DATE_RULE` 时记录 `check_in_date_reward_rule.id`
  - 命中 `PATTERN_RULE` 时记录 `check_in_pattern_reward_rule.id`
  - 命中 `BASE_REWARD` 或无基础奖励时为空
- `resolvedRewardConfig`

字段语义：

- `resolvedRewardRuleId` 是结合 `resolvedRewardSourceType` 解释的软引用，不要求数据库层外键约束。
- 无基础奖励时，`resolvedRewardSourceType`、`resolvedRewardRuleId`、`resolvedRewardConfig` 均为空。
- `signDate` 已是完整日期，不再需要额外的奖励命中快照字段。

### 6.5 周期快照结构

`check_in_cycle.planSnapshot` 中的基础奖励快照结构调整为：

- `baseRewardConfig`
- `dateRewardRules`
- `patternRewardRules`
- `streakRewardRules`

这样可继续保证：

- 当前周期内签到解释稳定
- 后续补偿使用签到时的快照解释
- 对账页可解释奖励来源
- 新周期只使用新版本快照，旧周期继续沿用旧快照直到周期结束

## 7. DTO 与接口契约

### 7.1 管理端奖励配置 DTO

原 `dailyRewardRules` 字段替换为：

- `dateRewardRules`
- `patternRewardRules`

新增 DTO：

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

### 7.2 管理端计划详情响应

管理端计划详情返回：

- `baseRewardConfig`
- `dateRewardRules`
- `patternRewardRules`
- `streakRewardRules`

### 7.3 App / Admin 运行态读模型

签到记录、动作返回、对账返回统一改为返回：

- `resolvedRewardSourceType`
- `resolvedRewardRuleId`
- `resolvedRewardConfig`

运行态日历若需要继续返回 `dayIndex`，该字段只能表示展示天序号，不再代表奖励命中来源。

### 7.4 受影响接口范围

本次改造会影响以下现有接口与响应契约：

- Admin `plan/detail`
- Admin `plan/reward-config/create`
- Admin `plan/reward-config/update`
- App `summary`
- App `calendar`
- App `my/page`
- App `sign`
- App `makeup`
- Admin `reconciliation/page`
- Admin `reconciliation/repair`

开发环境方案不保留 `dailyRewardRules`、`rewardDayIndex` 等兼容字段，不提供旧新并存的响应形态。

## 8. 校验与版本策略

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

### 8.3 版本递增规则

以下任一变更继续触发 `plan.version` 递增：

- `baseRewardConfig`
- `dateRewardRules`
- `patternRewardRules`
- `streakRewardRules`
- 周期类型
- 计划起止时间
- 每周期补签次数

### 8.4 版本复制策略

当 `plan.version` 递增时，新的计划版本按以下规则生成：

- `dateRewardRules` 完整复制旧版本全部规则，不做“只复制未来日期”的筛选。
- `patternRewardRules` 完整复制旧版本全部规则。
- `streakRewardRules` 继续沿用当前实现，完整复制旧版本全部规则。
- 过期的具体日期规则虽然会被复制到新版本，但因自然日已过，运行时不会再命中。

管理端更新奖励配置时，规则集合遵循以下提交口径：

- 显式传入的集合，以本次提交内容整体替换。
- 未显式传入的集合，沿用当前版本并复制到新版本。

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

## 10. 执行链路与读模型影响

以下能力保留现有流程，仅替换基础奖励解析与冻结字段：

- `signToday`
- `makeup`
- `repairReward`
- `getSummary`
- `getCalendar`
- `getMyRecords`
- `getReconciliationPage`

影响点：

- 创建签到记录时冻结新的奖励来源字段。
- 补签继续使用周期快照解析历史日期奖励。
- 奖励补偿继续使用记录上冻结的 `resolvedRewardConfig`。
- 对账页、动作返回与签到记录读模型不再依赖记录级 `rewardDayIndex`。
- 日历展示若仍返回 `dayIndex`，一律按 `signDate` 现场推导，不从记录表读取。

连续奖励规则解析、发放事实创建、账本结算与幂等策略不在本次设计范围内变更。

## 11. 开发环境破坏式替换流程

本次改造以一次性 cutover 方式落地，禁止出现“旧快照 + 新解析器”或“旧记录字段 + 新 DTO”混跑状态。

实施顺序固定为：

1. 清空签到域全量数据。
2. 调整 schema、migration 与 `db/schema` 导出。
3. 替换旧 `check_in_daily_reward_rule`，新增 `check_in_date_reward_rule` 与 `check_in_pattern_reward_rule`。
4. 调整 `check_in_record`、`check_in_cycle` 相关字段与快照结构。
5. 调整签到域类型与 DTO。
6. 替换 `CheckInServiceSupport` 中的规则校验、快照构建与奖励解析逻辑。
7. 调整 definition / execution / runtime 三个 service。
8. 更新测试，删除旧 `rewardDayIndex` 断言，补充日期规则与复制策略断言。
9. 运行文档检查与类型检查。

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
- 版本递增时完整复制全部 `dateRewardRules`
- 版本递增时完整复制全部 `patternRewardRules`

### 12.3 Execution 层

- `2026-05-03` 与 `2026-06-03` 可命中不同日期奖励
- 无日期规则时正确命中模式规则
- 无日期规则与模式规则时回退默认奖励
- 签到记录正确冻结奖励来源、规则 ID 与奖励配置
- 补签与奖励补偿继续基于冻结结果执行

### 12.4 Runtime 层

- `summary` / `calendar` 返回正确的计划奖励展示
- `record` / `reconciliation` 返回正确的奖励来源字段
- 运行态读模型不再依赖记录级 `rewardDayIndex`
- 日历若保留 `dayIndex`，其值按自然日现场推导且只用于展示

## 13. 风险与决策

- 风险：当前仓库已存在旧 DTO、旧快照与旧记录字段，若不先清库就切新结构，会出现解释链路错位。
  - 决策：本方案仅允许在开发环境先清空签到域数据，再执行一次性替换。
- 风险：若模式规则冲突校验做得不彻底，运行时会出现多规则同时命中的歧义。
  - 决策：在配置阶段阻断冲突，不在运行时做二次优先级兜底。
- 风险：删除记录级 `rewardDayIndex` 后，旧前端若仍依赖该字段会失效。
  - 决策：本次视为破坏式调整，不保留兼容字段；日历展示如仍需 `dayIndex`，仅按运行态推导返回。
- 风险：月末语义若与 `29/30/31` 混用，会带来跨月边界歧义。
  - 决策：`MONTH_LAST_DAY` 作为独立模式，且禁止与 `29/30/31` 共存。
- 风险：完整复制全部日期规则会把已过期日期规则带入新版本。
  - 决策：仍采用完整复制策略，保持实现确定性；过期日期规则自然不会被命中。
- 风险：`resolvedRewardRuleId` 若做强外键，会与多来源规则表冲突。
  - 决策：`resolvedRewardRuleId` 采用单列软引用设计，由 `resolvedRewardSourceType` 负责解释其来源。

## 14. 结论

本方案通过引入「具体日期规则 + 周期模式规则 + 默认奖励」三层模型，解决现有签到奖励只能按 `dayIndex` 配置的问题，同时保留「每周几」「每月几号」「每月最后一天」的规则语义。

该方案明确限定为开发环境实施版：先清空签到域数据，再一次性替换 schema、快照、DTO 与运行态契约；不承担线上兼容迁移责任。

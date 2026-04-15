# 签到模块审查结果清单（2026-04-15）

## 1. 审查范围

本次审查覆盖以下签到模块代码：

- `apps/app-api/src/modules/check-in/*`
- `apps/admin-api/src/modules/check-in/*`
- `libs/growth/src/check-in/*`
- `db/schema/app/check-in-*.ts`
- `libs/growth/src/check-in/test/*.spec.ts`

## 2. 审查维度

- 架构与分层：Controller / Service / DTO / Schema 的职责边界
- 接口契约：入参校验、返回模型、路由命名、审计与权限
- 业务正确性：签到、补签、连续奖励、对账、排行榜
- 数据一致性：事务、幂等、并发冲突、状态回写
- 读模型正确性：摘要、日历、我的记录、排行榜、对账页
- 测试覆盖：已有单测是否覆盖关键分支与高风险场景

## 3. 总体结论

签到模块整体分层清晰，`definition`、`execution`、`runtime` 三层职责划分基本合理，Controller 也保持了薄层风格。  
但当前实现里仍有 3 个需要优先处理的实质性问题，会直接影响连续签到口径、奖励修复状态正确性和月末奖励规则确定性；另外还有 2 个契约层问题会带来脏数据或无效请求静默成功。

## 4. 重点问题

### 4.1 [必须修复] 断签后 `currentStreak` 不会按“今天”归零，导致摘要、排行榜、下一档奖励全部失真

**定位：**

- `libs/growth/src/check-in/check-in-execution.service.ts:499-539`
- `libs/growth/src/check-in/check-in-runtime.service.ts:88-109`
- `libs/growth/src/check-in/check-in-runtime.service.ts:323-366`

**问题描述：**

`recomputeCycleAggregation()` 只根据“最后一次签到日”的连续性计算 `currentStreak`，然后把该值持久化到 `check_in_cycle.current_streak`。  
运行态读取摘要和排行榜时又直接信任这个持久化值，没有再用“今天”和 `lastSignedDate` 做一次衰减判断。

这意味着：

- 用户连续签到 7 天后断签 2 天，只要这 2 天没有新的写入，`currentStreak` 仍然会保留为 7。
- `getSummary()` 会继续返回过高的 `cycle.currentStreak`。
- `getSummary()` 里的 `nextStreakReward` 会基于错误的 streak 继续向后推。
- `getLeaderboardPage()` 会把已经断签的用户继续排在高位。

**风险等级：高**

这是核心用户态数据口径错误，不是展示小问题，会直接影响签到激励、公平性和运营判断。

**建议修复：**

- 方案 A：在读模型层计算 `effectiveCurrentStreak`。若 `lastSignedDate !== today` 且不是昨天，则视为 `0`。
- 方案 B：保留写时聚合，但增加按自然日衰减的后台任务，确保 `check_in_cycle.current_streak` 每日刷新。

当前场景更推荐 **方案 A**，因为它改动面小，且不依赖额外定时任务。

**测试缺口：**

现有测试没有覆盖“连续签到后断签 1 天 / 多天”的摘要与排行榜口径。

### 4.2 [必须修复] 奖励补偿/重试会在异常时把“已成功”的奖励状态反写成 `FAILED`

**定位：**

- `libs/growth/src/check-in/check-in-execution.service.ts:859-937`
- `libs/growth/src/check-in/check-in-execution.service.ts:945-1020`

**问题描述：**

`settleRecordReward()` 和 `settleGrantReward()` 在读取到记录后，不区分当前状态是否已经是 `SUCCESS`，都会再次调用 `applyRewardConfig()`。  
如果这次重试过程中出现瞬时异常，`catch` 分支会无条件把状态更新为 `FAILED`。

这会带来一个危险场景：

1. 某条基础奖励或连续奖励已经结算成功。
2. 管理端再次点击“补偿”或系统再次重试。
3. 本次重试过程中因为账本服务、数据库事务或网络抖动报错。
4. 原本成功的数据被回写成 `FAILED`，造成状态倒退。

**风险等级：高**

账本侧资产可能已经真实到账，但签到域状态被错误降级，后续会出现“资产已发放，但对账页显示失败”的假异常，严重干扰运营补偿和排障。

**建议修复：**

- 在进入结算前先短路：
  - `rewardStatus/grantStatus === SUCCESS` 且 `rewardSettledAt/grantSettledAt` 非空时，直接返回 `true`。
- `catch` 分支回写 `FAILED` 前增加保护：
  - 仅允许从 `PENDING` 或 `FAILED` 回写为 `FAILED`；
  - 不允许把已成功状态降级。

**测试缺口：**

现有测试只覆盖“补偿目标不存在”的异常路径，没有覆盖“已成功记录再次 repair 时异常”的状态保护。

### 4.3 [必须修复] 月计划没有拦截重复的 `MONTH_LAST_DAY` 规则，月末奖励会出现静默歧义

**定位：**

- `libs/growth/src/check-in/check-in.service.support.ts:340-352`
- `libs/growth/src/check-in/check-in.service.support.ts:892-907`

**问题描述：**

`normalizePatternRewardRules()` 在月计划场景下只检查了 `MONTH_DAY` 的重复值，没有检查 `MONTH_LAST_DAY` 是否被配置了多次。  
但 `resolvePatternRewardRuleByPriority()` 在运行时会直接 `find()` 第一个命中的 `MONTH_LAST_DAY` 规则。

结果是：

- 后台可以提交两条甚至多条“按月最后一天”规则。
- 运行时只吃第一条，后续规则被静默忽略。
- 奖励口径取决于输入顺序，配置结果不具备确定性。

**风险等级：中高**

这会直接造成月末奖励金额配置歧义，属于典型的“后台可配，运行时 silently pick first”的脏配置问题。

**建议修复：**

- 在月计划规则归一化时，单独统计 `patternType === MONTH_LAST_DAY` 的数量；
- 数量大于 1 时直接抛出 `BadRequestException`；
- 同时补一条单测，覆盖“两个 `MONTH_LAST_DAY` 规则必须报错”。

### 4.4 [建议修改] `update-status` 接口允许不传 `status`，会把无效请求当成功处理

**定位：**

- `libs/growth/src/check-in/dto/check-in-definition.dto.ts:75-78`
- `libs/growth/src/check-in/check-in-definition.service.ts:303-336`

**问题描述：**

`UpdateCheckInPlanStatusDto` 用了 `PartialType(...)`，导致 `status` 变成可选。  
Service 层又用 `dto.status ?? this.resolvePlanStatus(plan)` 兜底，结果是：

- 请求体不传 `status` 也能返回 `true`；
- 审计日志仍会记录一次“更新状态”；
- 调用方难以及时发现自己发的是无效请求。

**建议修复：**

- `UpdateCheckInPlanStatusDto` 应把 `status` 改回必填；
- 若继续保留可选，Service 层至少应显式抛 `BadRequestException('status 不能为空')`。

### 4.5 [建议修改] `planCode` / `planName` 缺少最小长度约束，纯空白字符串会被写入数据库

**定位：**

- `libs/growth/src/check-in/dto/check-in-plan.dto.ts:15-27`
- `libs/growth/src/check-in/check-in-definition.service.ts:160-161`
- `libs/growth/src/check-in/check-in-definition.service.ts:203-204`
- `db/schema/app/check-in-plan.ts`

**问题描述：**

DTO 层只限制了 `maxLength`，没有限制最小长度。  
`StringProperty` 会先做 `trim()`，所以 `"   "` 这样的输入会被收口成空字符串，然后继续写库。

这会导致：

- 后台出现空白计划编码 / 计划名称；
- `planCode` 的唯一约束只能拦住第二条空串，第一条空串仍会成功落库；
- 后续检索、展示和运营排障都不稳定。

**建议修复：**

- DTO 层为 `planCode`、`planName` 增加 `minLength: 1`；
- Service 层在 `trim()` 后再次断言非空；
- 如需更强兜底，可在表层补充 `check(trim(plan_code) <> '')` 一类约束。

## 5. 测试覆盖评估

当前签到模块已经补了不少单测，但高风险场景还有明显缺口：

- 缺少“断签后 `currentStreak` 归零”相关测试。
- 缺少“已成功奖励再次 repair 时，异常不能把状态改回 `FAILED`”测试。
- 缺少“重复 `MONTH_LAST_DAY` 规则必须报错”测试。
- 缺少“`update-status` 缺失 `status` 必须报错”测试。
- 缺少“纯空白 `planCode` / `planName` 必须报错”测试。

## 6. 建议的修复优先级

1. 先修复 `currentStreak` 口径问题。
2. 再修复奖励重试导致的状态倒退问题。
3. 然后补上 `MONTH_LAST_DAY` 重复校验。
4. 最后收紧 `status`、`planCode`、`planName` 的输入契约。

## 7. 本次审查产出

- 审查文档：`docs/reviews/2026-04-15-check-in-module-audit.md`
- 本次未改动业务实现，仅新增审查结果清单。

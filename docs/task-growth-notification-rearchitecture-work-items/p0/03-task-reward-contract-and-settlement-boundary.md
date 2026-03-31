# P0-03 基础奖励与任务 Bonus 合同重估

## 1. 目标

明确积分规则、经验规则、成长账本、任务奖励之间的职责关系，避免“基础行为奖励”和“任务 bonus”继续语义打架。

本任务需要产出的核心合同是：

- 基础行为奖励由成长规则驱动；
- 任务奖励是 bonus 奖励，不替代基础规则；
- 结算入口、幂等键、账本来源、重试补偿、用户展示口径要统一。

## 2. 范围

本任务覆盖以下模块：

- 成长奖励服务：
  - `libs/growth/src/growth-reward/growth-reward.service.ts`
- 成长账本：
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
  - `db/schema/app/growth-ledger-record.ts`
- 积分、经验规则与服务：
  - `libs/growth/src/point/point-rule.service.ts`
  - `libs/growth/src/point/point.service.ts`
  - `libs/growth/src/experience/experience.service.ts`
  - `db/schema/app/user-point-rule.ts`
  - `db/schema/app/user-experience-rule.ts`
- 任务奖励发放与补偿：
  - `libs/growth/src/task/task.service.ts`
- 用户中心成长摘要口径：
  - `apps/app-api/src/modules/user/user.service.ts`

## 3. 当前代码锚点

- `UserGrowthRewardService` 目前已经有两条入口：
  - `tryRewardByRule()`：基础行为奖励
  - `tryRewardTaskComplete()`：任务完成奖励
  - `libs/growth/src/growth-reward/growth-reward.service.ts`
- `task` assignment 创建时已保存 `rewardConfig` 快照，但完成结算时未完全以快照为准：
  - `libs/growth/src/task/task.service.ts`
  - `db/schema/app/task-assignment.ts`
- `reportProgress()/completeTask()` 主链路仍依赖发布校验，但代码里已经存在扫描 `COMPLETED + rewardStatus in (PENDING, FAILED)` 的补偿任务；当前真正缺的是“完整快照结算合同”和“结构化观测/返回”：
  - `libs/growth/src/task/task.service.ts`
- Producer 侧奖励入口仍不统一，一部分直接走 `GrowthLedgerService.applyByRule()`，一部分走 `UserGrowthRewardService.tryRewardByRule()`：
  - `libs/interaction/src/favorite/favorite-growth.service.ts`
  - `libs/interaction/src/follow/follow-growth.service.ts`
  - `libs/interaction/src/browse-log/browse-log-growth.service.ts`
  - `libs/interaction/src/like/like-growth.service.ts`
  - `libs/forum/src/topic/forum-topic.service.ts`
- `growth_ledger_record` 当前没有 `source` 字段，`tryRewardByRule()` 也还未返回结构化结算结果，因此“账本来源可区分”“统一返回 `ledgerIds / dedupeResult`”还停留在文档目标，未落到表结构和服务合同：
  - `db/schema/app/growth-ledger-record.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.types.ts`
  - `libs/growth/src/growth-reward/growth-reward.service.ts`

## 4. 非目标

- 本任务不把积分规则和经验规则强行合表；
- 不改变积分资产、经验资产本身的业务含义；
- 不在本任务中完成所有 producer 的统一接线；
- 不做活动核销、优惠券、现金红包等新奖励资产扩展；
- 不建设复杂财务对账平台，只输出最小对账合同与观测要求。

## 5. 主要改动

### 5.1 固定奖励职责边界

统一定义三层语义：

- 事件层：用户发生了什么行为；
- 基础奖励层：该行为默认得到多少积分/经验；
- 任务层：把一个或多个行为包装成任务目标，完成后追加 bonus。

默认策略为：

- 基础奖励与任务奖励可叠加；
- 若未来出现“任务替代基础奖励”的活动玩法，必须单独建显式开关，不允许隐式覆盖。

### 5.2 统一奖励入口合同

在服务层统一约束：

- 业务行为基础奖励统一走 `UserGrowthRewardService.tryRewardByRule()`；
- 任务完成奖励统一走 `UserGrowthRewardService.tryRewardTaskComplete()`；
- 除兼容期外，producer 不再直接调用 `GrowthLedgerService.applyByRule()`；
- 所有奖励入口都要输出统一的：
  - `bizKey`
  - `source`
  - `ruleType/eventCode`
  - `ledgerIds`
  - `dedupeResult`

为让这套合同真正可落地，第一阶段默认追加两项实现要求：

- `tryRewardByRule()` 从 `Promise<void>` 升级为可返回结构化结算结果，允许调用方在不阻断主流程的前提下复用 `ledgerIds / dedupeResult / failReason`；
- `growth_ledger_record` 新增稳定 `source` 字段，至少区分 `growth_rule` 与 `task_bonus`。

### 5.3 任务奖励按 assignment 快照结算

修复并固化以下规则：

- 任务奖励一律按 assignment 快照中的 `rewardConfig` 结算；
- 不允许任务领取后修改奖励影响存量 assignment；
- 补偿重试仍使用同一份快照，不读取当前 task 配置。

### 5.4 定义幂等与来源枚举

明确至少两类账本来源：

- `growth_rule`：基础行为奖励；
- `task_bonus`：任务 bonus 奖励。

并统一 `bizKey` 生成规范：

- 基础奖励：基于稳定业务实体与事件码；
- 任务奖励：基于 `assignmentId` 或 `taskId + userId + cycleKey + rewardPhase`。

同时补齐公开查询口径：

- 点数/经验明细 DTO 与用户中心摘要要能透出 `source`；
- 若账本上下文已包含 `assignmentId/taskId`，公开查询层应保留这些稳定字段，便于用户和运营定位 bonus 来源。

### 5.5 建立任务奖励补偿通道

把补偿结算从 `reportProgress()/completeTask()` 的发布校验链上拆出来，至少支持：

- 定时扫描 `COMPLETED + rewardStatus in (PENDING, FAILED)`；
- 单条重试；
- 幂等重放；
- 失败原因回写与可观察性保留。

### 5.6 统一用户侧展示口径

用户中心、账本明细、任务奖励通知中统一展示：

- 这是基础行为奖励还是任务 bonus；
- 奖励资产明细；
- 如果同一业务事件与任务 bonus 同时到账，展示上应允许两条明细并存，不互相覆盖。

## 6. 完成标准

- 已形成基础奖励与任务 bonus 的正式语义合同；
- Producer 基础奖励入口统一策略已确定；
- `task` 奖励结算与补偿全部以 assignment 快照为准；
- 账本来源、幂等键、返回结构有统一约束；
- 用户端可区分基础奖励与任务 bonus；
- 至少覆盖以下测试：
  - 同一行为触发基础奖励 + 任务 bonus 的叠加结算；
  - 任务奖励补偿在任务下线/过期后仍可重试；
  - 修改任务奖励配置不影响历史 assignment；
  - 重复触发同一奖励不会重复入账；
  - 账本 `source` 与公开 DTO 能稳定区分 `growth_rule / task_bonus`；
  - `tryRewardByRule()` 返回结构可被 producer、补偿链路和观测链路复用。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- 成长奖励服务设计说明
- 用户中心成长明细接口文档

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P0-03`；
- 直接前置：`P0-01`；
- 完成后主要解锁：`P0-04`、`P1-01`、`P2-01`。

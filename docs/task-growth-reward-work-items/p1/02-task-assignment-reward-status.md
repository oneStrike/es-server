# P1-02 `task_assignment` 奖励状态字段

## 目标

先在 `task_assignment` 上补奖励状态，而不是默认新建 settlement 表。

## 范围

- 增加 `rewardStatus`
- 增加 `rewardResultType`
- 增加 `rewardSettledAt`
- 增加 `rewardLedgerIds`
- 增加 `lastRewardError`

## 当前代码锚点

- `db/schema/app/task-assignment.ts`
- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/growth-reward/growth-reward.service.ts`
- `libs/growth/src/task/task.constant.ts`

## 非目标

- 不新建独立 settlement 表
- 不把最终幂等来源从账本迁到 `task_assignment`
- 不在 assignment 行上保存完整重试历史明细

## 主要改动

- `rewardStatus` 只回答结算流程是否完成，定义为 `PENDING / SUCCESS / FAILED`
- 增加 `rewardResultType` 区分 `APPLIED / IDEMPOTENT / FAILED`
- 发奖成功和失败都要回写 assignment
- 账本继续承担最终幂等
- `rewardLedgerIds` 只记录本次关联到的账本结果，不强行替代账本明细查询

## 完成标准

- 从任务记录能直接看出奖励是否已结算
- 能区分“本次真实发奖成功”和“命中幂等所以未重复落账”
- 不用反查流水也能回答“为什么没发奖”或“为什么这次没新增流水”

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [P1-03 任务奖励返回结构化结果](./03-growth-reward-result.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

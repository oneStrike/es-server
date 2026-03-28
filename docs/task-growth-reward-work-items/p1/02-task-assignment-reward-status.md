# P1-02 `task_assignment` 奖励状态字段

## 目标

先在 `task_assignment` 上补奖励状态，而不是默认新建 settlement 表。

## 范围

- 增加 `rewardStatus`
- 增加 `rewardSettledAt`
- 增加 `rewardLedgerIds`
- 增加 `lastRewardError`

## 主要改动

- 定义 `PENDING / SUCCESS / FAILED`
- 发奖成功和失败都要回写 assignment
- 账本继续承担最终幂等

## 完成标准

- 从任务记录能直接看出奖励是否已结算
- 不用反查流水也能回答“为什么没发奖”

## 执行信息

- 优先级：`S1`
- 硬前置：`P1-03`
- 软前置：`P1-01`
- 直接后置：P1 任务侧闭环完成
- 可并行：`P1-04`

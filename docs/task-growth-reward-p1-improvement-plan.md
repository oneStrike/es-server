# P1 本地改进方案总览

## 1. 阶段目标

P1 重点解决“任务奖励可解释”和“账本来源可解释”的问题。

本阶段只补齐两条链路：

1. `任务完成 -> 发奖 -> 任务侧可见`
2. `账本落地 -> App / 管理端能解释来源`

## 2. 范围边界

P1 纳入范围：

- `rewardConfig` 契约收敛
- `task_assignment` 奖励状态字段
- 任务奖励返回结构化结果
- App / 管理端账本 DTO 增强
- 统一混合成长账本接口

P1 不纳入范围：

- 统一事件中心
- 多渠道通知模板 / 偏好
- 评论审核后台
- Growth 规则彻底合表
- 默认引入独立 `task_reward_settlement` 表

## 3. 默认方案

P1 默认先扩 `task_assignment`，不直接引入新的奖励结算表。

原因很简单：

- 当前任务奖励只支持 `points` 与 `experience`
- 当前完成路径最多只会落少量账本
- 现阶段还没有足够复杂度支撑独立 settlement 模型

## 4. 拆分任务

详细任务已拆到独立目录：

优先级、依赖关系、推荐波次详见：

- [任务执行计划](./task-growth-reward-work-items/execution-plan.md)

- [P1-01 任务奖励配置契约收敛](./task-growth-reward-work-items/p1/01-reward-config-contract.md)
- [P1-02 `task_assignment` 奖励状态字段](./task-growth-reward-work-items/p1/02-task-assignment-reward-status.md)
- [P1-03 任务奖励返回结构化结果](./task-growth-reward-work-items/p1/03-growth-reward-result.md)
- [P1-04 账本 DTO 解释力增强](./task-growth-reward-work-items/p1/04-ledger-dto-explainability.md)
- [P1-05 混合成长账本分页接口](./task-growth-reward-work-items/p1/05-mixed-growth-ledger-page.md)

## 5. 推荐执行顺序

1. `P1-01`
2. `P1-03`
3. `P1-02`
4. `P1-04`
5. `P1-05`

## 6. 阶段验收

P1 完成后，系统要达到：

- 从任务记录能直接看出奖励是否已结算、何时结算、对应哪些账本
- `rewardConfig` 的可配置项与真实结算能力一致
- App 和管理端都能直接看到账本来源、业务键和上下文摘要

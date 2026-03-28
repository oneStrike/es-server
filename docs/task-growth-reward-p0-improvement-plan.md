# P0 本地改进方案总览

## 1. 阶段目标

P0 只解决已经影响正确性、幂等性、审计性的现实问题，不做大规模抽象重构。

本阶段只收敛 4 类问题：

1. 主题审核通过后的发帖奖励补发
2. 举报裁决后的奖励闭环
3. 管理端人工补发的稳定幂等
4. 规则编码、seed、注释的明显漂移

## 2. 范围边界

P0 纳入范围：

- 奖励时机纠偏
- 管理端举报处理闭环
- 稳定 `operationKey`
- 规则编码对齐

P0 不纳入范围：

- 统一事件中心
- 通知模板 / 偏好 / delivery
- 独立任务奖励结算表
- 混合成长账本接口
- 评论审核后台
- chat outbox 域闭环

## 3. 拆分任务

详细任务已拆到独立目录：

优先级、依赖关系、推荐波次详见：

- [任务执行计划](./task-growth-reward-work-items/execution-plan.md)

- [P0-01 业务口径与规则编码对齐](./task-growth-reward-work-items/p0/01-policy-and-rule-code-alignment.md)
- [P0-02 管理端举报处理模块](./task-growth-reward-work-items/p0/02-admin-report-review-module.md)
- [P0-03 举报奖励切到裁决后结算](./task-growth-reward-work-items/p0/03-report-reward-after-judgement.md)
- [P0-04 主题审核通过奖励补发](./task-growth-reward-work-items/p0/04-topic-audit-reward-backfill.md)
- [P0-05 管理端人工补发稳定操作键](./task-growth-reward-work-items/p0/05-admin-manual-adjustment-operation-key.md)

## 4. 推荐执行顺序

1. `P0-01`
2. `P0-02`
3. `P0-03`
4. `P0-04`
5. `P0-05`

## 5. 阶段验收

P0 完成后，系统至少要满足：

- 同一个真实业务动作不会因为重试、审核流转、重复点击而重复发奖
- 团队、运营、代码、seed 对关键规则编码和奖励时机的理解一致

# P1-03 任务奖励返回结构化结果

## 目标

让任务服务拿到明确的发奖结果，而不是只依赖日志判断。

## 范围

- 为任务奖励定义返回类型
- 区分成功、幂等命中、真实失败
- 汇总积分和经验两条落账结果

## 当前代码锚点

- `libs/growth/src/growth-reward/growth-reward.service.ts`
- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/growth-ledger/growth-ledger.types.ts`
- `libs/growth/src/point/point.service.ts`
- `libs/growth/src/experience/experience.service.ts`

## 非目标

- 不引入事件总线或统一调度中心
- 不把日志完全替代成返回值，warning log 仍可保留
- 不直接在本任务里落 assignment 字段回写 schema

## 主要改动

- `tryRewardTaskComplete()` 改为返回结构化对象
- 返回值包含记录 ID、幂等命中标记、错误信息
- warning log 继续保留，但不再作为唯一反馈

## 完成标准

- 调用方能根据返回值更新 assignment 状态
- 幂等跳过和失败能被清楚区分

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [P1-02 task_assignment 奖励状态字段](./02-task-assignment-reward-status.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

# P1-01 任务奖励配置契约收敛

## 目标

让 `rewardConfig` 的配置能力与真实结算能力一致，先消除“配置了但不生效”的误导。

## 范围

- 明确当前只支持 `points`、`experience`
- 调整 DTO 示例
- 增加创建和更新任务的结构校验

## 当前代码锚点

- `libs/growth/src/task/dto/task.dto.ts`
- `libs/growth/src/task/task.service.ts`
- `db/schema/app/task.ts`

## 非目标

- 不在本任务里补齐徽章等奖励能力
- 不直接修改任务完成后的奖励结算流程
- 不对不支持字段做静默兼容

## 主要改动

- 去掉或显式标记 `badgeCodes` 为暂不生效
- 校验奖励字段类型、取值范围和 0 值策略
- 非法字段进入配置时给出明确错误

## 完成标准

- 管理端无法再录入当前不支持的奖励字段
- 任务奖励配置不再误导运营

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [P1-03 任务奖励返回结构化结果](./03-growth-reward-result.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

# P0-01 业务口径与规则编码对齐

## 目标

先统一当前奖励口径和规则编码，避免后续把错误现状继续固化。

## 范围

- 明确 `CREATE_TOPIC` 的结算时机
- 明确举报奖励从“提交即发”切到“裁决后发”
- 对齐 `GrowthRuleTypeEnum`、seed、schema 注释、运营说明

## 当前代码锚点

- `libs/growth/src/growth-rule.constant.ts`
- `db/schema/app/user-point-rule.ts`
- `db/schema/app/user-experience-rule.ts`
- `db/seed/modules/app/domain.ts`

## 非目标

- 不新增新的成长规则编码
- 不直接改举报或主题的具体结算实现时机
- 不在本任务里提前建设事件定义层

## 主要改动

- 标记 `REPORT_VALID / REPORT_INVALID` 为当前主链路规则
- 将 `*_REPORT` 标记为历史兼容口径
- 清理仍在传播旧章节编码的注释和说明

## 完成标准

- 团队、文档、seed、注释对同一规则编码的理解一致
- 新增或修改规则时不再参考旧编码说明

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- 若事件定义层口径受影响，同时同步 [事件定义专项设计](../../event-registry-special-design.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

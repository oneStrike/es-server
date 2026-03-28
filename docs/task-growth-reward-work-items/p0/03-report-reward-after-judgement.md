# P0-03 举报奖励切到裁决后结算

## 目标

把举报奖励从“创建即发”改成“裁决后按结果发”。

## 范围

- 停用 `createReport()` 末尾即时发奖
- 在举报处理流程中按状态触发奖励
- 为举报奖励补稳定业务键

## 当前代码锚点

- `libs/interaction/src/report/report.service.ts`
- `libs/interaction/src/report/report-growth.service.ts`
- `db/schema/app/user-report.ts`
- `libs/growth/src/growth-reward/growth-reward.service.ts`

## 非目标

- 不改举报奖励规则编码本身
- 不允许已裁决举报在奖励层来回反复重算
- 不把管理端处理入口实现细节塞回本任务

## 主要改动

- `RESOLVED` 触发 `REPORT_VALID`
- `REJECTED` 触发 `REPORT_INVALID`
- 使用 `report:handle:{reportId}:status:{status}:{assetType}` 作为幂等键

## 完成标准

- 创建举报不会立即发账
- 同一举报重复处理不会重复发奖
- 规则未配置时有明确初始化说明

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- 若治理依赖变化，同时同步 [P2-C-01 治理闸门统一](../p2c/01-governance-gate-unification.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

# P0-05 管理端人工补发稳定操作键

## 目标

为人工加积分、扣积分、加经验引入稳定 `operationKey`，恢复幂等与审计能力。

## 范围

- DTO 增加 `operationKey`
- `bizKey` 改为基于 `operationKey` 生成
- 保证重试不重复落账

## 当前代码锚点

- `apps/admin-api/src/modules/app-user/app-user.controller.ts`
- `apps/admin-api/src/modules/app-user/app-user.service.ts`
- `apps/admin-api/src/modules/app-user/app-user.type.ts`
- `db/schema/app/growth-ledger-record.ts`
- `db/schema/system/request-log.ts`

## 非目标

- 不引入通用人工回滚框架
- 不取消现有账本唯一约束这层兜底
- 不在第一阶段引入服务端与调用方协商生成 `operationKey` 的复杂流程

## 主要改动

- 管理端 UI 或调用方提交稳定、可重试复用的 `operationKey`
- `bizKey`、审计串联键、请求记录都基于同一 `operationKey` 生成或映射
- 日志、账本、操作记录统一串联同一次人工操作
- 保留现有账本唯一约束作为最终兜底

## 完成标准

- 同一 `operationKey` 重试只会落一次账
- 运营可以通过 `operationKey` 追踪同一次操作对应的请求、审计与账本记录
- 空值或非法 `operationKey` 会在入口被拒绝

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [最终验收清单](../final-acceptance-checklist.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

# P2-A-01 代码级 `EventDefinitionMap`

## 目标

建设统一事件定义层，但不把它做成统一执行中心。

## 范围

- 定义 `EventDefinition` type
- 定义 `EventDefinitionMap`
- 提供查询与枚举能力

## 当前代码锚点

- `libs/growth/src/growth-rule.constant.ts`
- `libs/message/src/notification/notification.constant.ts`
- `libs/message/src/outbox/outbox.type.ts`
- `libs/growth/src/task/dto/task.dto.ts`

## 非目标

- 不把事件定义层做成统一执行中心
- 不在本任务里引入 `event_record`
- 不要求现有业务模块一次性全部切换到统一事件封装

## 主要改动

- 保留 `GrowthRuleTypeEnum` 作为稳定编码层
- 为事件补 `label / domain / governanceGate / consumers / implStatus`
- 提供“已实现 / 可配置”筛选能力

## 完成标准

- 事件定义有唯一事实源
- 任务、成长、通知可以复用同一份元数据

## 完成后同步文档

- [事件定义专项设计](../../event-registry-special-design.md)
- [开发排期版](../development-plan.md)
- [P2-A-03 文档与 DTO 统一引用事件定义](./03-doc-and-dto-alignment.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

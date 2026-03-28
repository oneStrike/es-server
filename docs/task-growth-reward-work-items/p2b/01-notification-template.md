# P2-B-01 通知模板

## 目标

给通知域补最小模板能力，但不一步走到多渠道编排。

## 范围

- 新增 `notification_template`
- 管理端补模板 CRUD
- `libs/message` 接入模板渲染

## 当前代码锚点

- `libs/message/src/notification/notification.service.ts`
- `libs/message/src/outbox/outbox.worker.ts`
- `libs/message/src/notification/notification.constant.ts`
- `apps/admin-api/src/modules/message/message.controller.ts`
- `db/schema/message/user-notification.ts`

## 非目标

- 不建设多渠道编排中心
- 不把接收人选择、幂等键生成、偏好判断收进模板层
- 不要求“有模板才能发通知”，fallback 仍然必须兜底

## 主要改动

- 定义模板唯一键和启停状态
- 模板渲染失败时提供 fallback
- 先覆盖核心站内通知场景
- 模板层只负责渲染，不替代通知域主链路判断
- 与 [通知域契约](../../notification-domain-contract.md) 保持一致

## 完成标准

- 重要通知不再完全依赖硬编码文案
- 模板异常不会直接阻断主链路
- 模板缺失、禁用或渲染失败时仍能使用业务方提供的 fallback 内容发送

## 完成后同步文档

- [通知域契约](../../notification-domain-contract.md)
- [开发排期版](../development-plan.md)
- [领域设计总览](../../task-growth-reward-domain-design.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

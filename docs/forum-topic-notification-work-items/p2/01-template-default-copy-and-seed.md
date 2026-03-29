# P2-01 模板默认文案与 seed 升级

## 目标

让模板层对新增论坛主题通知类型具备开箱即用的动态文案默认值，同时保留业务 fallback。

## 范围

- 为 `TOPIC_*` 增加模板定义
- 升级 `COMMENT_REPLY` 默认模板
- 更新消息域模板 seed

## 当前代码锚点

- `libs/message/src/notification/notification.constant.ts`
- `libs/message/src/notification/notification-template.service.ts`
- `db/seed/modules/message/domain.ts`

## 非目标

- 不在本任务里做模板缓存
- 不在本任务里引入多渠道模板编排
- 不要求“有模板才能发通知”

## 主要改动

- 为 `TOPIC_LIKE` 增加默认模板
- 为 `TOPIC_FAVORITE` 增加默认模板
- 为 `TOPIC_COMMENT` 增加默认模板
- 将 `COMMENT_REPLY` 默认模板升级为动态快照版
- 更新对应 seed 数据
- 保证模板缺失、禁用或渲染失败时仍使用业务 fallback

## 完成标准

- 新增论坛主题通知类型有稳定默认模板
- 回复通知默认模板与 fallback 文案口径一致
- 模板层继续只负责渲染，不侵入业务主链路判断

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- 若通知域口径调整，同时同步 [../../notification-domain-contract.md](../../notification-domain-contract.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

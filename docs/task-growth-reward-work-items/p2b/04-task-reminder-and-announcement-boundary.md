# P2-B-04 任务提醒与公告边界

## 目标

先补 2 到 3 个高价值提醒场景，并明确公告是否进入通知域。

## 范围

- 定义第一批任务提醒触发点
- 明确重要公告是否进入 inbox
- 明确 `app_announcement_read` 与通知未读口径的边界

## 当前代码锚点

- `libs/growth/src/task/task.service.ts`
- `libs/message/src/inbox/inbox.service.ts`
- `libs/message/src/notification/notification.service.ts`
- `apps/app-api/src/modules/system/system.controller.ts`
- `db/schema/app/app-announcement-read.ts`

## 非目标

- 不重做公告内容发布系统
- 不让 inbox 直接读取 `app_announcement`
- 不在第一阶段铺开所有提醒场景

## 主要改动

- 第一批建议只做：新任务可领、任务即将过期、奖励到账
- 提醒使用稳定幂等键
- 奖励到账提醒优先依赖结构化奖励结果，而不是依赖混合账本分页接口
- 公告采用双轨：重要公告进通知，普通公告留内容域
- 重要公告如果进入消息中心，必须物化成 `user_notification(type=SYSTEM_ANNOUNCEMENT)`
- `inbox` 第一阶段继续只汇总 `user_notification + chat`，不直接读取 `app_announcement`

## 完成标准

- 任务提醒不重复轰炸
- 公告、通知、inbox 的边界变清楚
- 重要公告进入消息中心后，未读口径不再依赖 `app_announcement_read`
- `app_announcement_read` 继续只服务内容域公告已读

## 完成后同步文档

- [通知域契约](../../notification-domain-contract.md)
- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

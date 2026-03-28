# P2-A-03 文档与 DTO 统一引用事件定义

## 目标

停止继续复制长枚举注释，让文档和 DTO 回到统一定义层。

## 范围

- 替换 DTO 里的手写长枚举说明
- 让文档引用统一定义层
- 停止继续传播旧编码

## 当前代码锚点

- `libs/growth/src/task/dto/task.dto.ts`
- `apps/app-api/src/modules/user/dto/user-point.dto.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
- `libs/message/src/notification/dto/notification.dto.ts`

## 非目标

- 不把事件定义复制成多份静态注释
- 不在本任务里重新定义 P0 / P1 的业务口径
- 不增加新的手写枚举说明分支

## 主要改动

- 管理端 DTO 改为引用统一事件定义
- 规则配置和账本展示复用统一说明
- 清理历史注释中的过期编码

## 完成标准

- 不再需要同时维护多份长枚举注释
- 枚举变更时只维护一处事实源

## 完成后同步文档

- [事件定义专项设计](../../event-registry-special-design.md)
- [开发排期版](../development-plan.md)
- 若影响下游说明，同时同步 [P2-B-01 通知模板](../p2b/01-notification-template.md) 与 [P2-C-02 评论审核后台](../p2c/02-comment-moderation-admin.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准

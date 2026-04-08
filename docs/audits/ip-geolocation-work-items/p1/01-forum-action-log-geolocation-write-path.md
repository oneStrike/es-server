# P1-01 打通论坛操作日志属地写入

## 目标

- 让现有论坛操作日志写入链路落统一属地快照。
- 保持论坛操作日志页面查询能力不新增属地筛选条件。

## 范围

- `apps/app-api/src/modules/forum/forum-topic.controller.ts`
- `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- `libs/forum/src/action-log/action-log.service.ts`
- `libs/forum/src/action-log/dto/action-log.dto.ts`
- `libs/forum/src/topic/forum-topic.service.ts`
- `libs/forum/src/topic/forum-topic.type.ts`

## 现状锚点（2026-04-08）

- 论坛操作日志当前只有主题服务在写：
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/forum/src/action-log/action-log.service.ts`
- 论坛主题 create / update / delete 对应 controller 当前都已接收 `req`，并在边界层组装统一客户端写入上下文：
  - `apps/app-api/src/modules/forum/forum-topic.controller.ts`
  - `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- `CreateForumActionLogDto` 当前已包含 `ipAddress / userAgent / geo*` 字段：
  - `libs/forum/src/action-log/dto/action-log.dto.ts`
- `forum-topic.service.ts` 当前 create / update / delete 写日志时都已补传统一客户端写入上下文：
  - `libs/forum/src/topic/forum-topic.service.ts`
- 当前仓库未发现评论侧复用 `forum_user_action_log` 的调用点。

## 非目标

- 不为论坛操作日志页面新增属地筛选条件。
- 不在本任务中把评论动作扩展接入 `forum_user_action_log`。
- 不改造论坛操作日志之外的其他后台审计页面。

## 主要改动

- 在论坛主题 create / update / delete 对应 controller 边界补充 `req` 解析，并透传统一客户端写入上下文。
- 扩展 `forum-topic` 领域写入上下文类型，承载论坛操作日志所需的 `ipAddress / userAgent / geo*` 信息。
- 扩展论坛操作日志 DTO 与 service 写入字段，补齐统一属地快照。
- 调整 `forum-topic.service.ts` 现有 `createActionLog(...)` 调用，统一补传 create / update / delete 共用的客户端属地上下文。
- 保持论坛操作日志页面当前查询参数与分页语义不变。

## 完成标准

- 论坛主题 create / update / delete 相关操作写入的 `forum_user_action_log` 记录包含统一属地字段。
- `geoSource` 在论坛操作日志链路中固定为 `ip2region`。
- 论坛操作日志页面不新增属地筛选参数，也不改变既有查询结果结构。
- 相关 service 写入测试或落库验收样例需要覆盖 create / update / delete 三条日志链路，并对 `geo*` 字段留痕。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P1-01` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中论坛操作日志影响模块与验证口径。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录论坛操作日志写入证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P1-01` 为唯一事实源。

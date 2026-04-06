# P1-01 打通论坛操作日志属地写入

## 目标

- 让现有论坛操作日志写入链路落统一属地快照。
- 保持论坛操作日志页面查询能力不新增属地筛选条件。

## 范围

- `libs/forum/src/action-log/action-log.service.ts`
- `libs/forum/src/action-log/dto/action-log.dto.ts`
- `libs/forum/src/topic/forum-topic.service.ts`

## 当前代码锚点

- 论坛操作日志当前只有主题服务在写：
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/forum/src/action-log/action-log.service.ts`
- `CreateForumActionLogDto` 当前只包含 `ipAddress` 和 `userAgent`，未包含属地字段：
  - `libs/forum/src/action-log/dto/action-log.dto.ts`
- 当前仓库未发现评论侧复用 `forum_user_action_log` 的调用点。

## 非目标

- 不为论坛操作日志页面新增属地筛选条件。
- 不在本任务中把评论动作扩展接入 `forum_user_action_log`。
- 不改造论坛操作日志之外的其他后台审计页面。

## 主要改动

- 扩展论坛操作日志 DTO 与 service 写入字段，补齐统一属地快照。
- 调整 `forum-topic.service.ts` 现有 `createActionLog(...)` 调用，统一补传客户端属地上下文。
- 保持论坛操作日志页面当前查询参数与分页语义不变。

## 完成标准

- 论坛主题相关操作写入的 `forum_user_action_log` 记录包含统一属地字段。
- `geoSource` 在论坛操作日志链路中固定为 `ip2region`。
- 论坛操作日志页面不新增属地筛选参数，也不改变既有查询结果结构。

## 完成后同步文档

- 更新 [execution-plan.md](/E:/Code/es/es-server/docs/audits/ip-geolocation-work-items/execution-plan.md) 中 `P1-01` 的状态。
- 在 [final-acceptance-checklist.md](/E:/Code/es/es-server/docs/audits/ip-geolocation-work-items/checklists/final-acceptance-checklist.md) 记录论坛操作日志写入证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](/E:/Code/es/es-server/docs/audits/ip-geolocation-work-items/execution-plan.md) 中的 `P1-01` 为唯一事实源。

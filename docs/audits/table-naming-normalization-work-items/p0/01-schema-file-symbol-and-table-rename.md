# P0-01 收口 Schema 文件名、导出符号与物理表名

## 目标

- 将本轮目标表的 schema 文件名、导出符号和 `pgTable(...)` 物理表名一次性统一到新规范。
- 同步收口 `db/relations/*.ts` 中对这些 schema 常量的关系定义引用。

## 范围

- `db/schema/app/user-badge.ts`
- `db/schema/app/user-badge-assignment.ts`
- `db/schema/app/user-browse-log.ts`
- `db/schema/app/user-comment.ts`
- `db/schema/app/user-download-record.ts`
- `db/schema/app/user-experience-rule.ts`
- `db/schema/app/user-favorite.ts`
- `db/schema/app/user-follow.ts`
- `db/schema/app/user-level-rule.ts`
- `db/schema/app/user-like.ts`
- `db/schema/app/user-point-rule.ts`
- `db/schema/app/user-purchase-record.ts`
- `db/schema/app/user-report.ts`
- `db/schema/app/user-work-reading-state.ts`
- `db/schema/message/user-notification.ts`
- `db/schema/message/notification-preference.ts`
- `db/schema/system/system-config.ts`
- `db/schema/system/system-dictionary.ts`
- `db/schema/system/request-log.ts`
- `db/schema/system/sensitive-word.ts`
- `db/schema/forum/forum-moderator-section.ts`
- `db/schema/forum/forum-topic-tag.ts`
- `db/schema/index.ts`
- `db/relations/app.ts`
- `db/relations/message.ts`
- `db/relations/system.ts`
- `db/relations/forum.ts`
- `db/relations/work.ts`

## 当前代码锚点

- 当前 app 域存在多组裸 `user_*` schema 导出：
  - `db/schema/app/user-comment.ts`
  - `db/schema/app/user-follow.ts`
  - `db/schema/app/user-like.ts`
  - `db/schema/app/user-report.ts`
- 当前 message 域仍有裸 `user_notification` 与 `notification_preference`：
  - `db/schema/message/user-notification.ts`
  - `db/schema/message/notification-preference.ts`
- 当前 system 域混用 `sys_*` 与无域前缀：
  - `db/schema/system/system-config.ts`
  - `db/schema/system/system-dictionary.ts`
  - `db/schema/system/request-log.ts`
  - `db/schema/system/sensitive-word.ts`
- 当前 forum 中间表命名不统一：
  - `db/schema/forum/forum-moderator-section.ts`
  - `db/schema/forum/forum-topic-tag.ts`
- 当前关系定义依赖这些旧导出：
  - `db/relations/app.ts`
  - `db/relations/message.ts`
  - `db/relations/system.ts`
  - `db/relations/forum.ts`
  - `db/relations/work.ts`

## 非目标

- 不在本任务中修改 `apps/*`、`libs/*`、`db/seed/*` 的业务引用。
- 不在本任务中生成 migration 或更新 `db/comments/generated.sql`。
- 不顺手优化 `app_user_count`、`message_ws_metric`、`app_agreement_log` 等非本轮高置信命名问题。
- 不为旧 schema 导出保留兼容 alias。

## 主要改动

- 按 [README.md](../README.md) 确认的 rename matrix 重命名目标 schema 文件。
- 同步将 schema 导出符号收敛到与新表名一致的 camelCase 形式，例如：
  - `userComment` -> `appUserComment`
  - `userNotification` -> `appUserNotification`
  - `notificationPreference` -> `appUserNotificationPreference`
  - `dictionary` -> `systemDictionary`
  - `dictionaryItem` -> `systemDictionaryItem`
  - `requestLog` -> `systemRequestLog`
  - `sensitiveWord` -> `systemSensitiveWord`
  - `forumTopicTag` -> `forumTopicTagRelation`
- 修改各 schema 文件内的 `pgTable(...)` 名称，使其与目标物理表名完全一致。
- 同步收口目标 schema 文件内显式命名的索引、唯一约束、检查约束等对象名称，避免继续携带旧表名前缀。
- 更新 `db/schema/index.ts` 的导出路径和导出符号，保证仓库统一从新命名访问 schema。
- 更新 `db/relations/*.ts` 中的导入、关系归属和关系命名，确保 relation 层不再引用旧常量名；其中 `work.ts` 也要同步切到新的等级规则导出。

## 完成标准

- 目标范围内 `db/schema/*` 不再出现旧物理表名字符串。
- 目标范围内 `db/schema/*` 不再导出旧 schema 常量名。
- `db/schema/index.ts` 与 `db/relations/*.ts` 全部切换到新导出。
- 目标 schema 的索引、约束命名已同步收口，不再保留旧表名前缀。
- 本任务完成后，schema 层的新命名能够作为唯一事实源供运行时代码继续切换。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-01` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中已确认的 schema 与 relations 影响路径。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录 schema 层 rename 证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-01` 为唯一事实源。

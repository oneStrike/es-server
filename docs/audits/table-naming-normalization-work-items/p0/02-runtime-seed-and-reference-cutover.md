# P0-02 切换运行时代码、Seed 与查询引用

## 目标

- 将 `apps/*`、`libs/*`、`db/seed/*` 中对旧 schema 导出和旧表名语义的引用全部切到新命名。
- 确保新环境建库、seed、业务查询和测试都只依赖新 schema 名称。

## 范围

- `apps/app-api/src/modules/*`
- `apps/admin-api/src/modules/*`
- `libs/interaction/src/*`
- `libs/forum/src/*`
- `libs/message/src/*`
- `libs/growth/src/*`
- `libs/config/src/*`
- `libs/content/src/*`
- `libs/app-content/src/*`
- `libs/moderation/sensitive-word/src/*`
- `libs/user/src/*`
- `db/seed/modules/app/domain.ts`
- `db/seed/modules/forum/domain.ts`
- `db/seed/modules/message/domain.ts`
- `db/seed/modules/system/domain.ts`
- `db/seed/modules/work/domain.ts`

## 当前代码锚点

- 当前 app seed 直接引用多组旧 schema 常量：
  - `db/seed/modules/app/domain.ts`
- 当前 forum seed 直接引用旧关系表常量：
  - `db/seed/modules/forum/domain.ts`
- 当前 message seed 直接引用旧通知表常量：
  - `db/seed/modules/message/domain.ts`
- 当前 system seed 直接引用 `dictionary`、`requestLog`、`sensitiveWord`：
  - `db/seed/modules/system/domain.ts`
- 当前业务服务广泛依赖旧导出：
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/follow/follow.service.ts`
  - `libs/message/src/notification/notification.service.ts`
  - `libs/forum/src/moderator/moderator.service.ts`
  - `libs/config/src/dictionary/dictionary.service.ts`
  - `libs/moderation/sensitive-word/src/sensitive-word.service.ts`
- 当前内容域仍直接依赖旧 schema 导出或旧表名注释：
  - `libs/content/src/work/counter/work-counter.service.ts`
  - `libs/content/src/work/chapter/work-chapter.service.ts`
  - `libs/content/src/work/core/work.service.ts`
  - `libs/app-content/src/announcement/announcement.service.ts`

## 非目标

- 不在本任务中生成 migration。
- 不在本任务中重命名业务 service / module / controller 文件名。
- 不为旧导出保留中转 alias 或临时兼容导出。
- 不在本任务中改写非目标表的业务语义或 DTO 契约。

## 主要改动

- 更新 `apps/*` 和 `libs/*` 中所有目标旧 schema 导入，统一改用新导出符号。
- 同步调整服务内的查询入口命名、关系访问命名和注释说明，避免代码注释继续声称访问旧表。
- 清理 `libs/content/*`、`libs/app-content/*` 中对旧表名的说明性注释，避免内容域与消息域继续保留过期命名认知。
- 更新 `db/seed/*` 中对目标 schema 常量的导入和查询调用，保证 `db:seed` 在新命名下可继续运行。
- 更新测试代码中对旧 schema 常量、旧物理表名或旧注释文案的引用，避免测试和实现命名漂移。
- 对直接写明旧表名的说明性注释进行清理，确保维护者不再从注释中看到旧命名结论。

## 完成标准

- `apps/*`、`libs/*`、`db/seed/*` 中不再引用目标范围内的旧 schema 导出符号。
- 目标范围内不再出现“旧表名仍然是事实源”的注释或说明。
- seed 代码和测试代码都能基于新 schema 名称完成编译路径。
- 不存在旧导出和新导出同时并存的临时兼容层。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-02` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中实际波及的 apps / libs / seed 模块。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录运行时代码与 seed 切换证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-02` 为唯一事实源。

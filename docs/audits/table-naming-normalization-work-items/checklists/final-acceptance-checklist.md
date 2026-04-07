# 数据表命名规范化最终验收清单

## 功能与命名验收

- [x] 目标 `23` 张表的物理表名已切换到新规范，证据：
  - 已通过 `.env` 中的数据库连接做独立核验：目标 `23` 张新表全部存在，目标旧表集合为空。
  - 已确认最新迁移记录哈希与 [migration.sql](/D:/code/es/es-server/db/migration/20260407170500_table_naming_normalization_manual/migration.sql) 的 `SHA256` 一致：`4126692b567ec92d94cf64da895f030807d66f20d7cfb23243ea783a2d436a49`。
- [x] 对应 schema 文件名和导出符号已同步切换，证据：
  - [index.ts](/D:/code/es/es-server/db/schema/index.ts) 已切到 `app_*`、`system_*`、`*_relation` 新文件路径。
  - 代表性文件已落到新命名，例如 [app-user-comment.ts](/D:/code/es/es-server/db/schema/app/app-user-comment.ts)、[app-user-notification.ts](/D:/code/es/es-server/db/schema/message/app-user-notification.ts)、[system-request-log.ts](/D:/code/es/es-server/db/schema/system/system-request-log.ts)。
- [x] `db/schema/index.ts` 与 `db/relations/*.ts` 不再引用旧命名，证据：
  - [app.ts](/D:/code/es/es-server/db/relations/app.ts)、[forum.ts](/D:/code/es/es-server/db/relations/forum.ts)、[message.ts](/D:/code/es/es-server/db/relations/message.ts)、[system.ts](/D:/code/es/es-server/db/relations/system.ts)、[work.ts](/D:/code/es/es-server/db/relations/work.ts) 已全部切到新导出。
- [x] `apps/*`、`libs/*`、`db/seed/*` 范围内不存在目标旧导出残留，证据：
  - 已执行源码范围 `rg` 搜索，排除 `docs/**`、`db/migration/**`、`db/comments/**` 后无命中。
  - `pnpm type-check` 已通过，说明运行时代码与 seed 对新导出名的编译链路已打通。

## 迁移与数据安全验收

- [ ] `pnpm db:generate` 已完成，若存在交互，旧表到新表的确认记录已留痕，证据：
  - 当前执行环境为非 TTY，`pnpm db:generate` 无法完成交互式 rename 确认。
  - 用户已明确授权本轮手工迁移例外，当前采用 [migration.sql](/D:/code/es/es-server/db/migration/20260407170500_table_naming_normalization_manual/migration.sql) + [snapshot.json](/D:/code/es/es-server/db/migration/20260407170500_table_naming_normalization_manual/snapshot.json) 作为替代产物。
  - 数据库侧已确认最新 `__drizzle_migrations__` 记录哈希与手工 migration 文件一致。
- [x] 生成的 `migration.sql` / `snapshot.json` 已人工审查，结论为“不会误删线上数据”，证据：
  - 手工迁移文件仅包含 `ALTER TABLE ... RENAME TO`、`ALTER SEQUENCE ... RENAME TO`、`RENAME CONSTRAINT`、`ALTER INDEX ... RENAME TO`。
  - 已确认不包含 `CREATE TABLE`、`DROP TABLE`、`ADD COLUMN`、`DROP COLUMN`。
  - 已确认 [snapshot.json](/D:/code/es/es-server/db/migration/20260407170500_table_naming_normalization_manual/snapshot.json) 中不再存在目标旧表名或旧对象归属。
- [x] 命名索引、约束、序列已与新表名前缀同步，证据：
  - [migration.sql](/D:/code/es/es-server/db/migration/20260407170500_table_naming_normalization_manual/migration.sql) 已覆盖目标序列、主键/唯一约束、显式索引 rename。
  - `db/schema` 中目标表的显式命名对象也已同步切换到新前缀。
  - 已独立查库确认代表性对象存在：`app_badge_type_idx`、`app_user_notification_user_id_biz_key_key`、`system_dictionary_item_dictionary_code_code_key`、`forum_topic_tag_relation_tag_id_created_at_idx`、`system_sensitive_word_word_idx`。
- [x] 不存在需要补充的兼容 view、旧名别名或数据搬迁脚本，证据：
  - 当前 `db/schema` 未定义目标范围内外键对象，迁移不需要额外处理 FK rename。
  - 已确认本轮不引入 view、synonym、双写或数据搬迁脚本。

## 回归与工程验证

- [x] `pnpm type-check` 通过，证据：
  - 已执行 `pnpm type-check`，退出码为 `0`。
- [x] `pnpm db:comments:check` 通过，证据：
  - 已执行 `pnpm db:comments:generate` 刷新 [generated.sql](/D:/code/es/es-server/db/comments/generated.sql)。
  - 随后执行 `pnpm db:comments:check`，退出码为 `0`。
- [x] 变更文件的 `eslint` 通过，证据：
  - 已对本轮涉及的 `apps/*`、`libs/*`、`db/*` TypeScript 文件执行 `eslint`。
- [x] `rg` 搜索源码范围内的目标旧表名和旧导出符号无残留，固定豁免 `docs/audits/table-naming-normalization-work-items/**` 与 `db/migration/**`，证据：
  - 已执行源码范围 `rg` 搜索，当前无命中。
- [x] seed 入口在新 schema 导出下可运行或至少可编译验证，证据：
  - `db/seed/modules/app/domain.ts`、[forum/domain.ts](/D:/code/es/es-server/db/seed/modules/forum/domain.ts)、[message/domain.ts](/D:/code/es/es-server/db/seed/modules/message/domain.ts)、[system/domain.ts](/D:/code/es/es-server/db/seed/modules/system/domain.ts)、[work/domain.ts](/D:/code/es/es-server/db/seed/modules/work/domain.ts) 已切到新导出。
  - `pnpm type-check` 已覆盖这些 seed 文件的编译路径。

## 上线门禁

- [ ] 已确认发布窗口内不会让旧应用版本与新 schema 长时间混跑，证据：
  - 待发布负责人确认维护窗口与应用停写顺序。
- [ ] 已确认迁移前数据库备份方案，证据：
  - 待 DBA / 发布负责人补充。
- [ ] 已确认迁移后冒烟检查项，证据：
  - 待补充站内通知、评论、论坛标签 / 版主关系、系统配置 / 字典、敏感词等核心路径的 DB 级冒烟项。
- [ ] 已确认回滚触发条件与回滚责任人，证据：
  - 待发布负责人补充。

## 阻塞上线项

- 需确认数据库备份、发布窗口、迁移后冒烟项和回滚责任人。
- `pnpm db:generate` 因非 TTY 无法完成 rename 交互，本轮采用用户授权的手工 migration 例外。

## 最终签收问题与结论

- 最终结论：
  - 代码侧命名切换、comments 产物、数据库 rename 迁移和独立数据库核验均已完成；当前待补业务冒烟与发布门禁确认。
- 仍接受的残余风险：
  - 本轮迁移为用户授权的手工例外，需要在预发布 / 生产环境实际执行后再完成最终签收。
- 签收时间：
  - 待迁移执行后补充。

# 数据表命名规范化工作包

## 文档职责

- 本目录承载本次数据库表名、schema 文件名和导出符号的规范化重命名工作包。
- 排期、依赖、状态仅在 [execution-plan.md](./execution-plan.md) 维护。
- 单任务文档只描述本任务的目标、范围、改动和完成标准，不维护第二套排序。
- 验收结论与证据统一沉淀到 [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)。

## 阅读顺序

1. [execution-plan.md](./execution-plan.md)
2. [development-plan.md](./development-plan.md)
3. `p0/` 目录下的单任务文档
4. [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)

## 已确认命名口径

- 表名统一使用小写 `snake_case`。
- 主体边界必须显式表达，不再在 app 域继续新增裸 `user_*` 事实表。
- 用户主体只允许两类稳定前缀：
  - `admin_user_*`
  - `app_user_*`
- system 域统一使用 `system_*` 前缀，不再混用 `sys_*` 或无域前缀。
- 纯中间关系表统一使用 `_relation` 后缀，不再在同一语义层混用裸双名词和 `_relation`。
- 本轮采用直接切换方案，不保留旧表名兼容映射、不加视图别名、不做双写。
- 当前确认存在线上数据，但没有外部系统直接依赖这些表名；因此本轮允许数据库对象一次性改名，但发布时必须避免旧应用版本与新 schema 混跑。
- 数据保留策略为“rename 迁移保留现有数据”，不做新旧表搬迁，不做历史数据回填。

## 本轮范围

### app 用户主体边界统一

- `user_badge` -> `app_badge`
- `user_badge_assignment` -> `app_user_badge_assignment`
- `user_browse_log` -> `app_user_browse_log`
- `user_comment` -> `app_user_comment`
- `user_download_record` -> `app_user_download_record`
- `user_experience_rule` -> `app_user_experience_rule`
- `user_favorite` -> `app_user_favorite`
- `user_follow` -> `app_user_follow`
- `user_level_rule` -> `app_user_level_rule`
- `user_like` -> `app_user_like`
- `user_notification` -> `app_user_notification`
- `user_point_rule` -> `app_user_point_rule`
- `user_purchase_record` -> `app_user_purchase_record`
- `user_report` -> `app_user_report`
- `user_work_reading_state` -> `app_user_work_reading_state`
- `notification_preference` -> `app_user_notification_preference`

### system 域前缀统一

- `sys_config` -> `system_config`
- `sys_dictionary` -> `system_dictionary`
- `sys_dictionary_item` -> `system_dictionary_item`
- `sys_request_log` -> `system_request_log`
- `sensitive_word` -> `system_sensitive_word`

### forum 关系表命名统一

- `forum_moderator_section` -> `forum_moderator_section_relation`
- `forum_topic_tag` -> `forum_topic_tag_relation`

### 同步对象

- 对应 schema 文件名与导出符号
- `db/schema/index.ts`
- `db/relations/*.ts`
- `apps/*`、`libs/*`、`db/seed/*` 中对旧 schema 导出的引用
- `db/comments/generated.sql`
- `db/migration/*` 生成产物

## 非本轮范围

- `admin_user`、`admin_user_token` 等已明确区分主体的表名不改。
- `chat_*`、`message_outbox`、`notification_template`、`notification_delivery`、`task*`、`check_in_*`、`growth_*`、`emoji_*`、`work_*` 主实体表名不因本轮统一而顺手改名。
- `app_user_count`、`message_ws_metric`、`app_agreement_log` 这类“语义可优化但不属于本轮高置信规范问题”的表名暂不纳入。
- 不重命名 service / module / controller 的业务文件名，除非该文件名直接承担 schema 导出职责。
- 不为旧表名保留兼容 view、synonym、二次导出 alias。
- 不手写 migration；迁移仍通过 `pnpm db:generate` 生成，若生成过程出现交互式确认，由用户亲自执行。

## 目录说明

- [p0](./p0)：阻塞直接落地的核心任务单
- [checklists](./checklists)：验收清单与证据记录

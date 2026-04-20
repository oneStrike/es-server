# 数据库表命名规范

适用范围：`db/schema` 中的表名定义。

## 核心原则

- 表名使用 `snake_case` 单数。
- 命名优先表达"它是什么"，而不是"它做什么"。
- 若改名影响 migration、存量数据或 SQL 契约，以兼容性优先。

## 前缀与后缀规则

- 域前缀：`admin_*`、`app_*`、`forum_*`、`work_*`、`sys_*`。
- `app_user*` 用于账号主体及附属表，`user_*` 用于用户行为事实表。
- 后缀示例：`_log`、`_record`、`_count`、`_rule`、`_token`、`_assignment`、`_outbox`。

## 关系表规则

- 多对多中间表优先使用"左实体 + 右实体"命名。
- `work_*` 子域已有 `_relation` 体系时继续沿用。

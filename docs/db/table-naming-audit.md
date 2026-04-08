# 数据库表命名审计清单

审计时间：2026-04-08

审计基线：

- 现有表定义：`db/schema/*`
- 命名规范：`../../.trae/rules/TABLE_NAMING_SPEC.md`

## 1. 审计结论

当前项目共 `74` 张表。

- `71` 张：规范
- `2` 张：可接受，但建议后续新增时收敛口径
- `1` 张：建议改名

整体判断：

- 项目不存在大面积命名失范问题。
- 当前主要问题不是“表名普遍不规范”，而是少量边界表存在前缀口径漂移或主体名过泛。
- 后续治理重点应放在“新表不再继续漂移”，而不是为了形式统一批量重命名存量表。

## 2. 分档标准

### 2.1 规范

同时满足以下条件：

- 使用 `snake_case`
- 默认单数命名
- 前缀、主体、后缀都能稳定表达一行记录的业务语义
- 与同子域已有表的命名模式一致

### 2.2 可接受

满足以下条件：

- 单表语义清楚，可读性没有实质问题
- 但与所在子域或父域的命名口径未完全收敛
- 兼容性成本高于立即改名收益，建议存量保留

### 2.3 建议改名

满足以下条件之一：

- 主体名过泛，无法稳定表达业务对象
- 容易和相邻表、相邻模块或未来新表产生长期歧义
- 若未来发生 schema 变更窗口，值得优先纳入改名候选

## 3. 规范表（71）

### 3.1 admin 域

- `admin_user`
- `admin_user_token`

### 3.2 app 根实体与账号主体

- `app_agreement`
- `app_agreement_log`
- `app_announcement`
- `app_announcement_read`
- `app_config`
- `app_page`
- `app_user`
- `app_user_count`
- `app_user_token`

### 3.3 app 子域：签到

- `check_in_cycle`
- `check_in_plan`
- `check_in_record`
- `check_in_streak_reward_grant`
- `check_in_streak_reward_rule`

### 3.4 app 子域：Emoji

- `emoji_asset`
- `emoji_pack`
- `emoji_recent_usage`

### 3.5 app 子域：成长

- `growth_audit_log`
- `growth_ledger_record`
- `growth_rule_usage_slot`

### 3.6 app 子域：任务执行

- `task_assignment`
- `task_progress_log`

### 3.7 app 子域：用户行为、资产与状态

- `user_badge_assignment`
- `user_browse_log`
- `user_comment`
- `user_download_record`
- `user_experience_rule`
- `user_favorite`
- `user_follow`
- `user_level_rule`
- `user_like`
- `user_point_rule`
- `user_purchase_record`
- `user_report`
- `user_work_reading_state`

### 3.8 forum 域

- `forum_moderator`
- `forum_moderator_action_log`
- `forum_moderator_application`
- `forum_moderator_section`
- `forum_section`
- `forum_section_group`
- `forum_tag`
- `forum_topic`
- `forum_topic_tag`
- `forum_user_action_log`

### 3.9 message 域

- `chat_conversation`
- `chat_conversation_member`
- `chat_message`
- `message_outbox`
- `message_ws_metric`
- `notification_delivery`
- `notification_preference`
- `notification_template`
- `user_notification`

### 3.10 system 域

- `sys_config`
- `sys_dictionary`
- `sys_dictionary_item`
- `sys_request_log`

### 3.11 work 域

- `work`
- `work_author`
- `work_author_relation`
- `work_category`
- `work_category_relation`
- `work_chapter`
- `work_comic`
- `work_comic_archive_import_task`
- `work_novel`
- `work_tag`
- `work_tag_relation`

## 4. 可接受，但建议收敛（2）

### 4.1 `sensitive_word`

当前判断：可接受，建议存量保留。

原因：

- 单表语义清楚，“敏感词表”本身没有歧义。
- 但它位于 `system` 子域时，与 `sys_config`、`sys_dictionary`、`sys_request_log` 形成两套前缀口径。
- 如果后续内容治理相关表继续增加，建议优先独立为 `moderation_*`，而不是继续保留“`sys_*` + 裸前缀”混用。

建议：

- 现阶段不建议仅为了统一而改名。
- 后续若新增同类表，优先明确治理域前缀，再决定是否引入 `moderation_sensitive_word` 一类命名。

### 4.2 `user_badge`

当前判断：可接受，建议存量保留。

原因：

- 结合 `user_badge_assignment` 来看，`user_badge` 实际承载的是“徽章定义”，不是“用户已获得的徽章记录”。
- 现有命名在“用户徽章体系”语境下仍能成立，因此不算错误。
- 但单独看表名时，容易让人误解为“用户与徽章关系表”或“用户已拥有徽章表”。

建议：

- 现阶段不建议为了命名纯度触发存量迁移。
- 若未来有新的 schema 窗口，可评估是否收敛为 `badge` 或 `badge_definition`。

## 5. 建议改名（1）

### 5.1 `task`

当前判断：建议改名。

原因：

- `task` 主体名过泛。
- 结合 `task_assignment` 与 `task_progress_log` 可知，这张表实际承载的是“任务模板 / 任务定义”，而不是所有 task 相关事实的总表。
- 继续保留裸 `task` 命名，未来在引入更多 task 子表时，容易造成“定义表”和“任务域整体”的语义混叠。

建议候选名：

- 首选：`task_definition`
- 备选：`task_template`
- 若未来需要与更大 growth 域强绑定，也可评估：`growth_task`

迁移建议：

- 不建议为了整齐立即发起单独的存量改名。
- 建议仅在以下场景顺带纳入：
  - task 域发生较大 schema 重构；
  - 需要新增更多 task 主体近身表，且命名冲突开始显性化；
  - 已经存在数据库迁移窗口和调用方兼容方案。

## 6. 后续治理建议

### 6.1 立即执行

- 新表命名统一遵循 `../../.trae/rules/TABLE_NAMING_SPEC.md`
- 评审时显式检查 `app_user*` 与 `user_*` 的边界
- 禁止新增新的关系表后缀同义词，例如 `_mapping`、`_link`、`_bind`

### 6.2 暂不执行

- 不做存量表的批量重命名
- 不为了顶层前缀统一，把所有 `check_in_*`、`emoji_*`、`growth_*`、`user_*` 强改成 `app_*`
- 不为了 system 目录整齐，把所有 system 子域表都机械改成 `sys_*`

### 6.3 观察项

- 若内容治理表继续增加，优先考虑拆出 `moderation_*`
- 若 task 域继续扩展，优先评估把 `task` 收敛为 `task_definition`
- 若 badge 域继续细化，评估 `user_badge` 是否需要显式表达“定义表”语义

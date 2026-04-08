# 数据库表命名规范（草案）

适用范围：本仓库 `db/schema/*` 下的全部表定义，以及后续新增的业务表、系统表、关系表、聚合表与审计表。

## 1. 核心原则

- 表名统一使用 `snake_case`。
- 表名默认使用单数，不使用复数。
- 表名必须优先表达“它是什么”，其次才表达“它做什么”或“它怎么被使用”。
- 命名优先复用现有稳定前缀和后缀，不新增同义词体系。
- 若命名调整会影响既有 migration、存量数据、对外 SQL 契约或排障习惯，以兼容性优先；不要为了“看起来更统一”而强改存量表。

## 2. 基础格式

推荐格式：

```text
<域前缀>_<主体>[_<限定词>][_<用途后缀>]
```

示例：

- `admin_user`
- `app_user_token`
- `forum_topic`
- `message_outbox`
- `task_progress_log`
- `growth_rule_usage_slot`

不推荐：

- `users`
- `topicList`
- `forumTopicTable`
- `app_user_data`
- `message_record_log`

## 3. 前缀规则

### 3.1 域前缀

跨域基础实体、后台主体和内容主实体，优先使用稳定域前缀：

- `admin_*`：后台管理员域。
- `app_*`：应用端账号主体及其近身附属表。
- `forum_*`：论坛域核心实体。
- `work_*`：作品域核心实体。
- `sys_*`：系统基础设施级配置、字典、请求审计等全局表。

说明：

- `sys_*` 只用于全局系统基础设施，不要把所有“放在 system 目录下的表”都机械命名为 `sys_*`。
- 若后续出现独立治理域、风控域、结算域，应优先形成明确域前缀，例如 `moderation_*`、`risk_*`，不要继续向 `sys_*` 堆积。

### 3.2 `app_user*` 与 `user_*` 的边界

这两套前缀都合理，但语义边界必须固定：

- `app_user*`：描述应用端账号主体本身，或与账号主体强绑定、近身一对一/一对多的附属表。
  - 示例：`app_user`、`app_user_token`、`app_user_count`
- `user_*`：描述“用户发起的行为”“用户拥有的业务对象”或“面向用户的一类事实记录”。
  - 示例：`user_like`、`user_follow`、`user_comment`、`user_report`、`user_notification`

约束：

- 不要把 `user_*` 行为事实表为了形式统一改成 `app_user_*`。
- 新表若本质上不是账号主体扩展，就不要滥用 `app_user_*`。
- 新表若本质上是账号主体近身配置或登录态扩展，也不要落成泛化的 `user_*`。

## 4. 主体命名规则

### 4.1 核心实体表

核心实体表使用“域前缀 + 主体名”：

- `admin_user`
- `forum_topic`
- `forum_section`
- `work`
- `work_chapter`

要求：

- 主体名使用业务上稳定、常用、可搜索的术语。
- 避免 `data`、`info`、`manage`、`detail`、`list` 等泛词。

### 4.2 泛词控制

以下名称默认禁止直接作为表名主体，除非已形成稳定领域术语：

- `data`
- `info`
- `detail`
- `item`
- `manage`
- `table`
- `list`

说明：

- `dictionary_item` 这类已形成稳定术语的例外可以保留。
- `task` 这类过于泛的表名，新增时优先考虑更准确的 `task_definition`、`task_template` 等表达。

## 5. 后缀规则

后缀要表达“表中一行记录的语义”，不要只追求格式统一。

- `_log`：追加式轨迹、审计、操作流水。
  - 示例：`request_log`、`forum_user_action_log`、`task_progress_log`
- `_record`：业务事实记录，一行就是一条真实业务事实。
  - 示例：`growth_ledger_record`、`user_purchase_record`
- `_count`：聚合快照或读模型计数表。
  - 示例：`app_user_count`
- `_rule`：规则定义、奖励规则、判定规则。
  - 示例：`check_in_streak_reward_rule`、`user_level_rule`
- `_slot`：限流槽位、占位去重、窗口判定。
  - 示例：`growth_rule_usage_slot`
- `_token`：登录态、令牌、凭证。
  - 示例：`app_user_token`、`admin_user_token`
- `_assignment`：带生命周期的分配关系。
  - 示例：`task_assignment`、`user_badge_assignment`
- `_delivery`：业务投递结果。
  - 示例：`notification_delivery`
- `_outbox`：技术外盒事件。
  - 示例：`message_outbox`
- `_state`：某实体在某视角下的当前状态快照。
  - 示例：`user_work_reading_state`

不要混用同义后缀：

- 已使用 `_log` 的语义，不再新增 `_history` 表达同一层语义。
- 已使用 `_assignment` 的语义，不再新增 `_bind`、`_link` 表达同类生命周期关系。
- 已使用 `_outbox` 的技术模式，不再引入 `_event_queue` 之类平行命名。

## 6. 关系表规则

### 6.1 多对多中间表

优先使用“左实体 + 右实体”直接命名：

- `forum_topic_tag`
- `forum_moderator_section`

仅在以下情况允许使用 `_relation`：

- 直接实体对命名会与现有主实体名冲突；
- 直接实体对命名会误导为业务实体，而不是中间关系；
- 同一子域已经存在稳定的 `_relation` 体系，新表必须保持一致。

当前仓库约束：

- `work_*` 子域中已有 `work_author_relation`、`work_category_relation`、`work_tag_relation`，后续同类表继续沿用 `_relation`。
- `forum_*` 子域中已有 `forum_topic_tag`、`forum_moderator_section`，后续同类表默认沿用“实体对”命名。

### 6.2 禁止新增的关系后缀

除非已有稳定历史包袱，否则不要新增以下同义命名：

- `_mapping`
- `_link`
- `_bind`
- `_ref`

## 7. 当前仓库的推荐口径

### 7.1 建议保留现状

以下命名体系已经形成清晰边界，建议保留：

- `app_user*`：应用端账号主体及直接附属表。
- `user_*`：用户行为、用户资产、用户面向业务的事实表。
- `admin_*`、`forum_*`、`work_*`：域前缀明确的核心业务表。
- `chat_*`、`message_*`、`notification_*`：消息域内按子职责拆分的表族。

### 7.2 建议后续新增时收敛

- `sys_*`：只保留给真正的系统基础设施表。
- 内容治理相关新表若持续增多，优先独立为 `moderation_*`，不要继续混在 `sys_*` 与裸前缀之间。
- 新增 task 域主表时，优先避免再出现过泛的裸 `task` 主体名。

## 8. 命名评审检查清单

新增或重命名表前，至少检查以下问题：

- [ ] 表名是否为 `snake_case` 单数？
- [ ] 表名是否优先表达“主体”，而不是实现细节？
- [ ] 前缀是否复用了仓库已有稳定域，而不是新造同义前缀？
- [ ] 后缀是否准确表达一行记录的业务语义？
- [ ] 是否错误地把账号主体附属表命名成 `user_*`，或把行为事实表命名成 `app_user_*`？
- [ ] 是否在同一子域内引入了新的关系表后缀（如 `_mapping` / `_link`）？
- [ ] 若涉及存量改名，是否评估过 migration、兼容性和排障成本？

## 9. 决策顺序

发生命名冲突时，按以下顺序决策：

1. 已上线且稳定运行的存量 schema 与 migration 兼容性。
2. 本规范。
3. 同一业务子域下已存在的稳定命名模式。
4. 若前三者都不能覆盖，再新增新前缀或新后缀，并在本规范中补登记。

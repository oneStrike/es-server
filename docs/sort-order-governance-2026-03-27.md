# sortOrder 统一治理方案 (2026-03-27)

## 1. 目的

本文档定义了全仓库统一的排序语义规则：

1. 如果业务表明确拥有 `sortOrder` 字段，`admin` 和 `app` 都将其作为默认展示顺序。
2. 如果业务表没有 `sortOrder` 字段，仓库级统一回退默认优先使用 `id desc`；无 `id` 的表必须显式声明业务排序与稳定字段。
3. 如果某个模块确实需要 `createdAt`、`updatedAt`、`publishAt`、热度或优先级排序，必须作为业务显式规则声明，而不是隐式全局默认。
4. 每个非唯一的主排序字段必须追加稳定的决胜字段；默认优先使用 `id`，没有 `id` 时使用主键或唯一字段。

本文档是未来重构的基线。它本身不会改变运行时行为。

关系表结构改造已拆分到 [relation-table-refactor-2026-03-27.md](./relation-table-refactor-2026-03-27.md)。
本方案默认以前置完成关系表改造为前提，再开始排序治理。

## 2. 最终决策

### 2.1 核心规则

- `sortOrder` 仅用于手动排列的资源或手动排列的聚合成员。
- 没有 `sortOrder` 的表不应强制套用 `sortOrder` 策略。
- 对于有 `sortOrder` 的表，`admin` 和 `app` 共享相同的默认排序契约。
- 对于没有 `sortOrder` 的表，统一回退默认顺序优先是 `id desc`；无 `id` 的表必须显式声明业务排序与稳定字段。
- `admin` 端仍可支持手动切换到 `createdAt desc` + 稳定决胜字段或 `updatedAt desc` + 稳定决胜字段以便操作。

### 2.2 sortOrder 语义

为了最小化迁移成本并与当前 Schema 注释保持一致，仓库应标准化为：

- `sortOrder` 值越小 = 越靠前展示
- 默认排序 = `sortOrder asc` + 稳定决胜字段
- 默认追加/新项目行为 = 在范围内追加到尾部，通常使用 `max(sortOrder) + 1`

这意味着：

- `sortOrder` 表达展示顺序，而非时间先后。
- "最新优先" 不是 `sortOrder` 的职责。
- 如果 admin 列表需要时间视图，应使用显式的手动排序模式，而不是更改默认契约。

### 2.3 稳定排序规则

- `sortOrder asc` 必须变为 `sortOrder asc` + 稳定决胜字段
- 仓库统一回退默认优先使用 `id desc`
- `createdAt desc` 必须变为 `createdAt desc` + 稳定决胜字段
- `updatedAt desc` 必须变为 `updatedAt desc` + 稳定决胜字段
- 如果表没有 `id`，则必须显式追加可保证稳定性的主键或唯一字段

`buildDrizzlePageQuery()` 已经在分页辅助工具中为包含 `id` 的表自动追加了 `id`。对于没有 `id` 的表，模块必须显式追加主键或唯一字段。原始的 `db.query.*` 和手动 `select().orderBy(...)` 路径也必须显式执行此操作。

## 3. 业务分类

本方案将仓库分为三类：

### 3.1 受管理的展示资源

定义：

- 资源由运营或产品配置直接排列
- 用户可见的顺序应该是稳定且有意的
- `sortOrder` 属于资源本身

默认规则：

- 默认列表顺序：`sortOrder asc` + 稳定决胜字段
- 重排序范围：全局或业务定义的范围
- `admin` 和 `app` 都默认使用此顺序

### 3.2 受管理的关系/成员排序

定义：

- 排序属于聚合或关系范围内的成员
- `sortOrder` 仅在所有者范围内有意义，如 `workId`、`packId`、`dictionaryCode`

默认规则：

- 默认列表顺序：`sortOrder asc` + 稳定决胜字段
- 重排序范围：仅所有者范围
- 交换时不得跨范围

### 3.3 非 sortOrder 业务模块

定义：

- 模块由时间先后、状态、生命周期、审核、审计、账本、搜索或交互流程驱动
- 用户价值不来自手动排列

默认规则：

- 不要添加或推断 `sortOrder`
- 仓库统一回退默认优先：`id desc`
- 如果业务需要时间、发布、活跃度、优先级或相关性排序，必须显式声明，并在非唯一字段后追加稳定决胜字段

### 3.4 关系表的 `id` 与时间字段规则

本方案中的“关系表”并不只指名字里带 `relation` 的表，而是指以下几类承载“某个主体与某个对象之间关系”的表：

- 轻量成员关系：如作品作者、作品分类、作品标签。
- 成员状态关系：如会话成员、阅读状态、版主管辖板块。
- 用户-目标事实关系：如点赞、收藏、关注、已读、徽章获得、下载。
- 用户-目标交易关系：如购买、任务分配。

统一规则如下：

- 不要因为“这是关系表”就默认添加 `id`。
- 只有当关系记录没有足够稳定的自然键，或同一自然键下允许多条并存记录且必须拥有独立记录标识时，才保留 `id`。
- 不要因为“这是关系表”就默认保留通用 `createdAt` / `updatedAt`。
- 只保留真正表达业务事实的时间字段，例如 `readAt`、`joinedAt`、`lastReadAt`、`claimedAt`、`completedAt`。
- 如果关系表是“全量删除再重建”的轻量成员关系，通用生命周期时间通常没有稳定业务价值。
- 如果关系表确实不存在稳定自然键，例如交易记录，则可以保留 `id` 与必要的生命周期时间。

## 4. 全仓库清单

本节涵盖 `libs/*`、`apps/*` 和 `db/schema/*` 下当前存在的全部业务面。

说明：

- 下表中的“推荐的默认顺序”指模块最终采用的默认顺序。
- 对于没有 `sortOrder` 的模块，如果备注未明确写出业务显式排序，则统一回退到 `id desc`。
- `createdAt`、`updatedAt`、`publishAt`、热度、活跃度、优先级等字段只在业务显式需要时作为默认顺序出现。
- 对于没有 `id` 的表，推荐的默认顺序必须明确写出稳定决胜字段，不能省略。

### 4.1 内容域

| 模块                                | 主表 / 数据源                           | 分类               | 加入 `sortOrder` 策略 | 推荐的默认顺序                                      | 备注                                                     |
| --------------------------------- | ---------------------------------- | ---------------- | ----------------- | -------------------------------------------- | ------------------------------------------------------ |
| `content/author`                  | `work_author`                      | 非 sortOrder 资源   | 否                 | `id desc`                                    | 作者本身不是手动排列的。                                           |
| `content/category`                | `work_category`                    | 受管理的展示资源         | 是                 | `sortOrder asc, id asc`                      | 当前 admin 页面使用 `sortOrder desc`；应对齐。                    |
| `content/tag`                     | `work_tag`                         | 受管理的展示资源         | 是                 | `sortOrder asc, id asc`                      | 当前 admin 页面使用 `sortOrder desc`；应对齐。                    |
| `content/work/core`               | `work`, `work_comic`, `work_novel` | 非 sortOrder 资源   | 否                 | `id desc`                                    | 作品列表不是手动排列的列表；如产品明确要求，可显式切到 `publishAt desc, id desc`。 |
| `content/work/chapter`            | `work_chapter`                     | 受管理的关系/成员排序      | 是                 | `workId` 范围内 `sortOrder asc, id asc`         | 当前章节页面回退到全局默认顺序；应使用章节顺序。                               |
| `content/work author relations`   | `work_author_relation`             | 受管理的关系/成员排序      | 是                 | `workId` 范围内 `sortOrder asc, authorId asc`   | 写入路径已按输入顺序分配顺序；目标结构建议与其余作品关系表统一为自然键。                   |
| `content/work category relations` | `work_category_relation`           | 受管理的关系/成员排序      | 是                 | `workId` 范围内 `sortOrder asc, categoryId asc` | 表没有 `id`；写入路径当前写入反向编号；应规范化为一种约定。                       |
| `content/work tag relations`      | `work_tag_relation`                | 受管理的关系/成员排序（候选）  | 有条件是              | `workId` 范围内 `sortOrder asc, tagId asc`      | 表没有 `id`；字段存在，但当前写入路径未维护它。完全采用前必须修复。                   |
| `content/work/content`            | 章节内容、归档导入任务                        | 非 sortOrder 流程模块 | 否                 | `id desc`                                    | 不是展示顺序资源；任务视图如需按状态或时间排序，应显式声明。                         |
| `content/permission`              | 权限检查                               | 支持模块             | 否                 | N/A                                          | 不是可分页的业务资源。                                            |
| `content/work-counter`            | 派生计数器                              | 支持模块             | 否                 | N/A                                          | 不是可分页的业务资源。                                            |

### 4.2 App 内容域

| 模块                         | 主表 / 数据源           | 分类               | 加入 `sortOrder` 策略 | 推荐的默认顺序                                             | 备注                                                               |
| -------------------------- | ------------------ | ---------------- | ----------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| `app-content/agreement`    | `app_agreement`    | 非 sortOrder 资源   | 否                 | admin: `id desc` / app: `publishedAt desc, id desc` | 协议时间先后比手动排列更重要。                                                  |
| `app-content/announcement` | `app_announcement` | 非 sortOrder 资源   | 否                 | 业务定义的复合顺序                                           | 优先 `isPinned`、`priorityLevel`、发布时间窗口，然后按需使用 `createdAt/id`。      |
| `app-content/page`         | `app_page`         | 非 sortOrder 配置资源 | 否                 | `id desc`                                           | 页面标识由代码/路径驱动，而非顺序驱动；如后台需要最近修改视图，可显式使用 `updatedAt desc, id desc`。 |

### 4.3 配置域

| 模块                       | 主表 / 数据源              | 分类               | 加入 `sortOrder` 策略 | 推荐的默认顺序                                      | 备注                                       |
| ------------------------ | --------------------- | ---------------- | ----------------- | -------------------------------------------- | ---------------------------------------- |
| `config/app-config`      | `app_config`          | 非 sortOrder 配置资源 | 否                 | `id desc`                                    | 配置版本由时间先后/版本驱动。                          |
| `config/system-config`   | `system_config`       | 非 sortOrder 配置资源 | 否                 | `id desc`                                    | 当前服务如需保留时间视图，应将其视为显式业务排序。                |
| `config/dictionary`      | `sys_dictionary`      | 非 sortOrder 配置资源 | 否                 | `id desc`                                    | 字典根实体不是排列的。                              |
| `config/dictionary item` | `sys_dictionary_item` | 受管理的关系/成员排序      | 是                 | `dictionaryCode` 范围内 `sortOrder asc, id asc` | App 读取路径已使用 `sortOrder asc`；admin 页面应对齐。 |
| `config/core`            | 共享配置粘合                | 支持模块             | 否                 | N/A                                          | 不是业务列表。                                  |

### 4.4 论坛域

| 模块                                                           | 主表 / 数据源                                              | 分类                | 加入 `sortOrder` 策略 | 推荐的默认顺序                               | 备注                                              |
| ------------------------------------------------------------ | ----------------------------------------------------- | ----------------- | ----------------- | ------------------------------------- | ----------------------------------------------- |
| `forum/section-group`                                        | `forum_section_group`                                 | 受管理的展示资源          | 是                 | `sortOrder asc, id asc`               | 当前 admin 页面使用 `sortOrder desc`；app 端已使用升序。      |
| `forum/section`                                              | `forum_section`                                       | 受管理的关系/成员排序       | 是                 | `groupId` 范围内 `sortOrder asc, id asc` | App 端已将版块视为排列资源；admin 页面应默认使用相同契约。              |
| `forum/tag`                                                  | `forum_tag`                                           | 受管理的展示资源          | 是                 | `sortOrder asc, id asc`               | 当前 admin 页面已对齐。                                 |
| `forum/topic`                                                | `forum_topic`                                         | 非 sortOrder 内容资源  | 否                 | `id desc`                             | 主题列表语义由信息流/搜索驱动；热度、活跃度、相关性或时间排序必须显式定义。          |
| `forum/reply`                                                | 论坛上下文中的 `user_comment`                                | 非 sortOrder 交互资源  | 否                 | `id desc`                             | 回复顺序由对话驱动；如需时间倒序或树形顺序，应显式定义。                    |
| `forum/moderator`                                            | `forum_moderator`, `forum_moderator_section`          | 非 sortOrder 管理资源  | 否                 | `id desc`                             | 没有手动展示顺序；状态或时间视图应显式声明。                          |
| `forum/moderator-application`                                | `forum_moderator_application`                         | 非 sortOrder 工作流资源 | 否                 | `id desc`                             | 申请处理由时间先后/状态驱动，若默认时间视图成立，应在模块内显式写死。             |
| `forum/search`                                               | 搜索聚合                                                  | 非 sortOrder 查询模块  | 否                 | 相关性/热度/时间                             | 不受 `sortOrder` 约束。                              |
| `forum/profile`                                              | 聚合的主题/用户视图                                            | 非 sortOrder 查询模块  | 否                 | 业务特定                                  | 某些关联数据可能携带 `sortOrder`，但模块本身不由其排序。              |
| `forum/action-log`                                           | `forum_user_action_log`, `forum_moderator_action_log` | 非 sortOrder 审计模块  | 否                 | `id desc`                             | 审计/运营数据；若按时间查看，应显式使用 `createdAt desc, id desc`。 |
| `forum/counter`                                              | 派生计数器                                                 | 支持模块              | 否                 | N/A                                   | 不是业务列表。                                         |
| `forum/permission`                                           | 权限检查                                                  | 支持模块              | 否                 | N/A                                   | 不是业务列表。                                         |
| `forum/reply-like`                                           | 交互辅助                                                  | 非 sortOrder 支持模块  | 否                 | N/A                                   | 不是受管理的排序资源。                                     |
| `forum/config`, `forum/badge`, `forum/module`, `forum/forum` | 组合/支持                                                 | 支持模块              | 否                 | N/A                                   | 不是独立排序的业务资源。                                    |

### 4.5 成长域

| 模块                                 | 主表 / 数据源                                       | 分类                | 加入 `sortOrder` 策略 | 推荐的默认顺序                      | 备注                                                         |
| ---------------------------------- | ---------------------------------------------- | ----------------- | ----------------- | ---------------------------- | ---------------------------------------------------------- |
| `growth/level-rule`                | `user_level_rule`                              | 受管理的展示资源          | 是                 | `sortOrder asc, id asc`      | 当前页面查询回退到全局默认；应对齐。范围当前为全局，未来可选择按 `business` 拆分。            |
| `growth/badge`                     | `user_badge`                                   | 受管理的展示资源          | 是                 | `sortOrder asc, id asc`      | 当前页面查询回退到全局默认；应对齐。范围当前为全局，未来可选择按 `business` 拆分。            |
| `growth/point rule`                | `user_point_rule`                              | 非 sortOrder 配置资源  | 否                 | `id desc`                    | 规则标识由类型驱动，而非顺序驱动；如需最近修改视图，应显式使用 `updatedAt desc, id desc`。 |
| `growth/experience rule`           | `user_experience_rule`                         | 非 sortOrder 配置资源  | 否                 | `id desc`                    | 规则标识由类型驱动；如需最近修改视图，应显式使用 `updatedAt desc, id desc`。        |
| `growth/task`                      | `task`, `task_assignment`, `task_progress_log` | 非 sortOrder 工作流资源 | 否                 | 当前业务顺序（`priority desc`，然后时间） | 任务优先级是领域字段，不是 `sortOrder`。                                 |
| `growth/growth-ledger`             | `growth_ledger_record`, usage slot, audit log  | 非 sortOrder 账本资源  | 否                 | `id desc`                    | 账本是仅追加历史；如果需要账本时间视图，应显式使用 `createdAt desc, id desc`。       |
| `growth/growth-reward`             | 奖励编排                                           | 非 sortOrder 流程模块  | 否                 | 按业务                          | 不是展示顺序资源。                                                  |
| `growth/permission`                | 权限检查                                           | 支持模块              | 否                 | N/A                          | 不是业务列表。                                                    |
| `growth/resolver`, `growth/growth` | 组合/支持                                          | 支持模块              | 否                 | N/A                          | 不是独立排序的业务资源。                                               |

### 4.6 交互域

| 模块                                                    | 主表 / 数据源                  | 分类                   | 加入 `sortOrder` 策略 | 推荐的默认顺序                              | 备注                                                                    |
| ----------------------------------------------------- | ------------------------- | -------------------- | ----------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `interaction/emoji pack`                              | `emoji_pack`              | 受管理的展示资源             | 是                 | `sortOrder asc, id asc`              | 当前 admin/app 行为已基本对齐。                                                 |
| `interaction/emoji asset`                             | `emoji_asset`             | 受管理的关系/成员排序          | 是                 | `packId` 范围内 `sortOrder asc, id asc` | 当前 admin/app 行为已基本对齐。                                                 |
| `interaction/comment`                                 | `user_comment`            | 非 sortOrder 交互资源     | 否                 | `id desc`                            | 不是手动排列列表；如需时间倒序或树形顺序，应显式定义。                                           |
| `interaction/like`                                    | `user_like`               | 非 sortOrder 交互资源     | 否                 | `id desc`                            | 历史列表；如需最近操作视图，应显式使用 `createdAt desc, id desc`。                        |
| `interaction/favorite`                                | `user_favorite`           | 非 sortOrder 交互资源     | 否                 | `id desc`                            | 历史列表；如需最近操作视图，应显式使用 `createdAt desc, id desc`。                        |
| `interaction/follow`                                  | `user_follow`             | 非 sortOrder 交互资源     | 否                 | `id desc`                            | 历史列表；如需最近操作视图，应显式使用 `createdAt desc, id desc`。                        |
| `interaction/report`                                  | `user_report`             | 非 sortOrder 审核/工作流资源 | 否                 | `id desc`                            | 处理队列，不是排列内容；如业务坚持时间视图，应显式使用 `createdAt desc, id desc`。                |
| `interaction/browse-log`                              | `user_browse_log`         | 非 sortOrder 历史资源     | 否                 | `id desc`                            | 仅追加行为；如需最近浏览视图，应显式使用 `createdAt desc, id desc`。                       |
| `interaction/download`                                | `user_download_record`    | 非 sortOrder 历史资源     | 否                 | `id desc`                            | 可能暴露章节 `sortOrder`，但不拥有排序语义；如需最近下载视图，应显式使用 `createdAt desc, id desc`。 |
| `interaction/purchase`                                | `user_purchase_record`    | 非 sortOrder 历史资源     | 否                 | `id desc`                            | 可能暴露章节 `sortOrder`，但不拥有排序语义；如需最近购买视图，应显式使用 `createdAt desc, id desc`。 |
| `interaction/reading-state`                           | `user_work_reading_state` | 非 sortOrder 状态资源     | 否                 | `id desc`                            | 状态时间先后比手动排列更重要；若产品要求最近阅读视图，应显式使用 `lastReadAt desc, id desc`。          |
| `interaction/user-assets`                             | 资产聚合                      | 非 sortOrder 查询模块     | 否                 | 按业务                                  | 不是受管理的排序资源。                                                           |
| `interaction/purchase-contract`, `interaction/module` | 支持/组合                     | 支持模块                 | 否                 | N/A                                  | 不是独立排序的业务资源。                                                          |

### 4.7 消息域

| 模块                                  | 主表 / 数据源                                     | 分类               | 加入 `sortOrder` 策略 | 推荐的默认顺序                                             | 备注                                                      |
| ----------------------------------- | -------------------------------------------- | ---------------- | ----------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `message/notification`              | `user_notification`                          | 非 sortOrder 消息资源 | 否                 | `id desc`                                           | 收件箱/通知通常按时间先后驱动；若保持该视图，应显式使用 `createdAt desc, id desc`。 |
| `message/inbox`                     | 对话/消息聚合                                      | 非 sortOrder 消息资源 | 否                 | 对话活跃度 desc                                          | 不是手动排列列表。                                               |
| `message/chat`                      | `chat_conversation`, `chat_message`, members | 非 sortOrder 消息资源 | 否                 | 最后消息时间 / seq                                        | 对话顺序由活跃度驱动。                                             |
| `message/outbox`                    | `message_outbox`                             | 非 sortOrder 运营队列 | 否                 | worker 用 `createdAt asc`，admin 视图用 `createdAt desc` | 队列语义，不是展示排列。                                            |
| `message/monitor`                   | ws 指标                                        | 非 sortOrder 监控模块 | 否                 | 基于时间                                                | 不是展示顺序资源。                                               |
| `message/message`, `message/module` | 组合/支持                                        | 支持模块             | 否                 | N/A                                                 | 不是独立排序的业务资源。                                            |

### 4.8 审核域

| 模块                          | 主表 / 数据源         | 分类               | 加入 `sortOrder` 策略 | 推荐的默认顺序   | 备注                           |
| --------------------------- | ---------------- | ---------------- | ----------------- | --------- | ---------------------------- |
| `moderation/sensitive-word` | `sensitive_word` | 非 sortOrder 治理资源 | 否                 | `id desc` | 治理数据不是手动排列的；命中数或最近命中视图应显式定义。 |

### 4.9 身份域

| 模块               | 主表 / 数据源   | 分类   | 加入 `sortOrder` 策略 | 推荐的默认顺序   | 备注                                                  |
| ---------------- | ---------- | ---- | ----------------- | --------- | --------------------------------------------------- |
| `identity/core`  | 会话/认证支持    | 支持模块 | 否                 | N/A       | 没有业务列表。                                             |
| `identity/token` | token/会话存储 | 支持模块 | 否                 | `id desc` | 没有手动排列；如后台需要最近签发视图，应显式使用 `createdAt desc, id desc`。 |

### 4.10 用户域

| 模块                    | 主表 / 数据源 | 分类   | 加入 `sortOrder` 策略 | 推荐的默认顺序 | 备注          |
| --------------------- | -------- | ---- | ----------------- | ------- | ----------- |
| `user/core`           | 用户聚合辅助   | 支持模块 | 否                 | 按业务     | 不是受管理的排序资源。 |
| `user/app-user-count` | 派生计数器    | 支持模块 | 否                 | N/A     | 不是受管理的排序资源。 |

### 4.11 平台 / 基础设施域

| 模块                                                                                                                                      | 主表 / 数据源 | 分类   | 加入 `sortOrder` 策略 | 推荐的默认顺序 | 备注                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------- | ------- | -------------------- |
| `platform/auth`, `platform/upload`, `platform/cache`, `platform/logger`, `platform/health`, `platform/crypto`, `platform/sms`, DTO/配置辅助 | 基础设施     | 支持模块 | 否                 | N/A     | 永不加入 `sortOrder` 策略。 |

### 4.12 关系表专项清单

关系表结构改造的详细清单、逐表结论、API 影响和实施顺序，已经独立到：

- [relation-table-refactor-2026-03-27.md](./relation-table-refactor-2026-03-27.md)

本排序文档只保留 3 条摘要规则：

- 关系表改造先于排序改造执行
- 关系表是否保留 `id` / 通用时间字段，以独立文档为准
- 涉及 `sortOrder` 的关系表，必须在结构稳定后再统一排序语义与唯一约束

## 5. API 层映射

App/admin API 层不应发明第二套排序策略。它应遵循上述领域决策。

### 5.1 应默认使用 `sortOrder` 的 Admin 模块

- `admin/content/category`
- `admin/content/tag`
- `admin/content/novel/chapter`
- `admin/content/comic/chapter`
- `admin/content/emoji-pack`
- `admin/content/emoji-asset`
- `admin/forum/section-groups`
- `admin/forum/sections`
- `admin/forum/tags`
- `admin/dictionary` 项目页面
- `admin/growth/level-rules`
- `admin/growth/badges`

### 5.2 不应默认使用 `sortOrder` 的 Admin 模块

- `admin/content/author`
- `admin/content/comic`
- `admin/content/novel`
- `admin/forum/topic`
- `admin/forum/moderators`
- `admin/forum/moderator-application`
- `admin/forum/search`
- `admin/forum/sensitive-word`
- `admin/growth/points-rules`
- `admin/growth/experience-rules`
- `admin/task`
- `admin/message`
- `admin/system`
- `admin/audit`
- `admin/system-user`
- `admin/app-users`
- 所有认证/上传/配置/审计/监控页面

### 5.3 当前消费 `sortOrder` 的 App 模块

- `app/emoji`
- `app/forum/section-groups`
- `app/forum/sections`
- `app/work/chapter`
- `app/dictionary` 项目读取
- 暴露章节 `sortOrder` 的阅读历史 / 下载 / 购买 DTO

这些 app 模块应继续将 `sortOrder` 作为用户可见的顺序契约。

## 6. 当前仓库缺口

当前代码库尚未与目标规则保持一致。

### 6.1 已识别的现有不一致

- `content/category` 页面默认使用 `sortOrder desc`
- `content/tag` 页面默认使用 `sortOrder desc`
- `forum/section-group` admin 页面默认使用 `sortOrder desc`
- `forum/section` admin 页面当前回退到全局默认而非 `sortOrder`
- `content/work/chapter` admin 页面当前回退到全局默认而非 `sortOrder`
- `config/dictionary item` admin 页面当前回退到全局默认而非 `sortOrder`
- `growth/level-rule` 页面当前回退到全局默认而非 `sortOrder`
- `growth/badge` 页面当前回退到全局默认而非 `sortOrder`
- `work_tag_relation` 拥有 `sortOrder` 列，但当前写入路径未维护它
- `work_author_relation` 与 `work_category_relation` / `work_tag_relation` 在主键与通用生命周期字段上结构不一致

### 6.2 基础设施缺口

- `maxOrder` 在字段名不存在时静默返回 `0`；对于仓库级标准来说这太宽松了
- 大多数 `sortOrder` 表只有普通索引，缺少范围唯一约束，因此仍可能出现重复排序值
- 某些 `findMany()` 和手动 SQL 查询路径在非唯一主排序后未追加 `id`
- 关系/成员排序尚未从资源级排序中抽象分离

## 7. 目标技术设计

### 7.1 单一事实来源

添加一个内部策略来源，例如：

- `db/core/query/sort-order-policy.ts`

职责：

- 定义 `sortOrder` 方向 (`asc`)
- 定义稳定排序表达式的辅助构建器
- 定义无 `sortOrder` 资源的统一回退默认（优先 `id desc`）
- 定义默认追加/新项目策略
- 公开一小套可复用的辅助工具

建议的 API：

```ts
export type ManagedOrderMode = 'sortOrder' | 'id'

export function buildManagedSortOrder(
  mode: ManagedOrderMode = 'sortOrder',
  stableFields?: string | string[],
): Array<Record<string, 'asc' | 'desc'>>

export function buildStableOrderBy(
  records: Array<Record<string, 'asc' | 'desc'>>,
  stableFields?: string | string[],
): Array<Record<string, 'asc' | 'desc'>>

export function buildSortOrderScope(
  scope?: Record<string, string | number | null>,
): Record<string, string | number | null>

export async function getNextSortOrder(
  tableName: string,
  scope?: Record<string, string | number | null>,
): Promise<number>

export function isSortOrderManagedResource(
  tableName: string,
): boolean
```

### 7.2 资源级辅助规则

对于拥有 `sortOrder` 的表：

- 默认顺序应由辅助工具构建，而不是在每个服务中手写
- `sortOrder` 资源页面辅助工具应返回：
  - 默认：`[{ sortOrder: 'asc' }, { id: 'asc' }]`
- 如果表没有 `id`，必须显式传入稳定决胜字段，例如：
  - `buildManagedSortOrder('sortOrder', 'categoryId')`
  - `buildManagedSortOrder('sortOrder', 'tagId')`
- `admin` 如果要切到手动创建/更新时间视图，应显式使用稳定排序构建器：
  - `buildStableOrderBy([{ createdAt: 'desc' }])`
  - `buildStableOrderBy([{ updatedAt: 'desc' }])`

对于没有 `sortOrder` 的表：

- 仓库统一回退默认应返回：
  - `buildManagedSortOrder('id')`
- 如果表被设计为无 `id`（例如部分轻量关系表），则不应依赖仓库回退默认，必须显式声明业务排序与稳定字段
- 只有模块明确声明业务默认时，才允许改为：
  - `buildStableOrderBy([{ createdAt: 'desc' }])`
  - `buildStableOrderBy([{ updatedAt: 'desc' }])`
  - `buildStableOrderBy([{ publishAt: 'desc' }])`
  - 其他业务排序字段加稳定决胜字段

### 7.3 关系/成员辅助规则

对于聚合成员或关系排序：

- 顺序仅在所有者范围内有效
- `swapField` 和任何未来的批量重排序操作必须验证范围相等性
- 推荐的范围：
  - `work_chapter`: `workId`
  - `work_author_relation`: `workId`
  - `work_category_relation`: `workId`
  - `work_tag_relation`: `workId`
  - `emoji_asset`: `packId`
  - `sys_dictionary_item`: `dictionaryCode`
  - `forum_section`: `groupId`，`null` 作为显式的"未分组"范围

关系表的主键与时间字段同时应遵循 4.12 的专项清单：

- 轻量成员关系优先自然键，不额外引入 `id`
- 成员状态关系优先保留业务时间，不强制保留通用 `createdAt/updatedAt`
- 即使当前项目已经对外暴露 `id`，只要自然键足够，也应同步移除并调整 DTO/API
- 只有不存在稳定自然键的交易记录，才应继续保留 `id`

### 7.4 全局资源的推荐范围规则

全局资源应保持全局排序，除非业务明确需要按域分子排序：

- `work_category`: 全局
- `work_tag`: 全局
- `forum_tag`: 全局
- `forum_section_group`: 全局
- `emoji_pack`: 全局
- `user_level_rule`: 暂时全局；如果 `business` 变成独立的可见等级阶梯则重新考虑
- `user_badge`: 暂时全局；如果徽章按 `business` 渲染则重新考虑

## 8. 数据库约束方案

为了使 `sortOrder` 成为真正的契约而非软约定，长期目标是：

- 每个受管理的 `sortOrder` 资源在其范围内获得唯一约束
- 每个关系/成员排序在所有者范围内获得唯一约束
- 软删除表在存活行上使用部分唯一索引

建议方向：

| 表                        | 推荐的唯一范围                                        |
| ------------------------ | ---------------------------------------------- |
| `emoji_pack`             | 存活行：`(sortOrder)`                              |
| `emoji_asset`            | 存活行：`(packId, sortOrder)`                      |
| `forum_section_group`    | 存活行：`(sortOrder)`                              |
| `forum_section`          | 存活行：范围分组排序，需要 nullable-group 策略                |
| `forum_tag`              | `(sortOrder)`                                  |
| `work_category`          | `(sortOrder)`                                  |
| `work_tag`               | `(sortOrder)`                                  |
| `sys_dictionary_item`    | `(dictionaryCode, sortOrder)`                  |
| `user_level_rule`        | `(sortOrder)` 或业务确认后使用 `(business, sortOrder)` |
| `user_badge`             | `(sortOrder)` 或业务确认后使用 `(business, sortOrder)` |
| `work_author_relation`   | `(workId, sortOrder)`                          |
| `work_category_relation` | `(workId, sortOrder)`                          |
| `work_tag_relation`      | `(workId, sortOrder)`                          |
| `work_chapter`           | 已有存活 `(workId, sortOrder)` 唯一索引                |

在添加这些约束之前，需要对现有数据进行去重脚本处理。

## 9. 实施阶段

### 前置阶段：关系表结构改造

- 先执行 [relation-table-refactor-2026-03-27.md](./relation-table-refactor-2026-03-27.md)
- 先去掉不必要的关系表 `id`
- 先去掉不必要的关系表通用时间字段
- 先把关系表的自然键与稳定决胜字段固定下来

### 第一阶段：策略和辅助层

- 创建共享的 `sort-order-policy` 辅助工具
- 在代码中明确方向：`small-first`
- 使稳定排序构建器可复用
- 将临时手写的 `sortOrder asc/desc` 默认值替换为辅助工具调用

### 第二阶段：对齐受管理的资源页面

第一波，因为它们是直接且用户可见的：

- `content/category`
- `content/tag`
- `forum/section-group`
- `forum/section`
- `forum/tag`
- `interaction/emoji pack`
- `interaction/emoji asset`
- `config/dictionary item`
- `growth/level-rule`
- `growth/badge`
- `content/work/chapter`

### 第三阶段：对齐受管理的关系/成员排序

- `work_author_relation`
- `work_category_relation`
- `work_tag_relation`
- 章节重排序辅助工具
- 作品聚合编辑下的任何 admin 拖拽重排序界面
- 同步收口关系表的 `id` / 时间字段规范，优先处理作品关系表结构不一致的问题

### 第四阶段：添加 admin 手动排序模式

对于所有受管理的资源：

- 保持默认 `sortOrder asc` + 稳定决胜字段
- 公开显式的手动排序选项：
  - `createdAt desc` + 稳定决胜字段
  - `updatedAt desc` + 稳定决胜字段

这应该是 UI/查询参数能力，而不是回退默认值。

对于没有 `sortOrder` 的模块：

- 保持仓库统一回退默认优先 `id desc`
- 只有在产品明确要求时，才把时间、活跃度、发布或优先级视图做成模块级显式默认

### 第五阶段：添加数据库约束和修复脚本

- 审计重复的 `sortOrder` 数据
- 修复每个范围内的重复
- 添加唯一索引
- 在重复压力下为交换/创建/更新路径添加测试

## 10. 测试和验证策略

### 10.1 辅助工具测试

- 稳定排序构建器返回 `sortOrder + 稳定决胜字段`
- 无 `sortOrder` 的统一回退构建器返回 `id desc`
- 时间排序构建器返回 `createdAt/updatedAt + 稳定决胜字段`
- 无 `id` 的关系表稳定排序构建器返回 `sortOrder + 主键/唯一字段`
- 不支持的字段抛出显式错误

### 10.2 服务测试

- 受管理的资源页面默认使用 `sortOrder asc` + 稳定决胜字段
- admin 显式覆盖到 `createdAt` 和 `updatedAt` 有效
- 交换/重排序拒绝跨范围操作
- 创建路径在正确范围内追加到尾部

### 10.3 数据迁移检查

- 每表/范围的重复 `sortOrder` 检测器
- 分组资源的 null 范围检测器
- 孤儿关系行
- 有 `sortOrder` 但无维护路径的关系表

### 10.4 基线命令

- `pnpm type-check`
- 对涉及的服务/辅助工具进行针对性 `eslint`
- 对辅助工具和服务覆盖进行针对性 `jest`

## 11. 执行优先级

推荐的实施顺序：

1. 先完成关系表结构改造
2. 冻结本策略
3. 实现辅助层
4. 对齐直接受管理的资源
5. 修复关系/成员排序
6. 添加数据库约束
7. 添加迁移脚本和回归测试

## 12. 实施期间需解决的开放决策

这些是唯一仍需要明确确认的业务决策：

1. `user_level_rule.sortOrder` 应保持全局，还是按 `business` 划分范围？
2. `user_badge.sortOrder` 应保持全局，还是按 `business` 划分范围？
3. `work_tag_relation.sortOrder` 是否真的是产品需求，如果作品内的标签顺序没有意义，是否应该移除该字段？
4. 对于 `groupId = null` 的 `forum_section`，"未分组"版块应共享一个排序范围还是从 null 分组迁移走？

## 13. 实用总结

仓库应标准化为以下内容：

- 如果模块拥有 `sortOrder`，它加入统一的 `sortOrder` 策略
- `admin` 和 `app` 默认使用相同的 `sortOrder asc` + 稳定决胜字段
- `admin` 可手动切换到 `createdAt/updatedAt`
- 如果模块没有 `sortOrder`，仓库统一回退默认优先是 `id desc`；无 `id` 的表必须显式声明业务排序
- `createdAt`、`updatedAt`、`publishAt`、热度、活跃度、优先级等只允许作为模块显式业务默认
- 所有非唯一排序必须追加稳定决胜字段

这使得系统保持连贯，而不会将时间驱动的业务列表强制纳入手动排列模型。

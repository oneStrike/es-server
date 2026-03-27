# 关系表结构改造方案 (2026-03-27)

## 1. 目的

本文档从更大范围的“关系表全面去 `id`”讨论中收敛出来，只覆盖本轮真正值得落地的第 1、2 组表：

1. 第 1 组：轻量关系表 / 事实关系表
2. 第 2 组：状态关系表，但允许同步改 DTO / service / controller 契约

本轮不再追求“所有关系表风格一致”，而是遵循更稳妥的工程实践：

- 纯 junction table 优先使用复合主键或自然键。
- 状态关系表只有在收益明确、影响面可控时才移除 `id`。
- 工作流、日志、交易、下载/关注/点赞/收藏记录等表，不为追求表面统一而强行去 `id`。

## 2. 本轮范围

### 2.1 纳入本轮

- `work_author_relation`
- `work_category_relation`
- `work_tag_relation`
- `forum_topic_tag`
- `forum_moderator_section`
- `app_announcement_read`
- `emoji_recent_usage`
- `user_badge_assignment`
- `user_work_reading_state`
- `chat_conversation_member`

### 2.2 明确移出本轮

以下表本轮不做“去 `id`”改造，也不纳入本文档的执行范围：

- `task_assignment`
- `task_progress_log`
- `user_like`
- `user_favorite`
- `user_follow`
- `user_download_record`
- `user_purchase_record`

原因：

- 这些表已经明显偏向工作流实体、日志记录、交易记录，或已被对外接口稳定暴露为“独立记录”。
- 当前收益不足以覆盖契约破坏、幂等键迁移、分页规则重写、历史数据回填等成本。

## 3. 总原则

### 3.1 主键与身份表达

- 轻量关系表优先使用复合主键。
- 自然键已经稳定表达身份时，不再额外保留冗余 `id`。
- 若当前阶段仍需要围绕记录本身做独立引用、幂等、日志或子表绑定，则保留 `id`，而不是为了形式统一强行删除。

### 3.2 时间字段

- 默认不保留通用 `updatedAt`。
- 只有具备明确业务语义或承担稳定排序职责的时间字段才保留。
- 本轮保留的时间字段包括：
  - `createdAt` 作为事实发生时间
  - `readAt` 作为已读时间
  - `lastUsedAt` 作为最近使用时间
  - `lastReadAt` 作为最近阅读时间
  - `joinedAt` / `leftAt` 作为成员状态时间

### 3.3 稳定排序策略

去掉 `id` 后，所有列表都必须显式给出稳定排序规则，避免分页重复或漏项。

统一规则：

- 有 `sortOrder` 的成员关系：`sortOrder asc` + 自然键次列 `asc`
- 有事实时间的关系：业务时间 `desc` + 自然键次列 `asc`
- 有状态时间的关系：状态时间 `desc` + 自然键次列 `asc`
- 没有时间也没有排序字段时：按自然键字典序

说明：

- 这里的“自然键次列”是指该查询维度下最稳定的键，例如 `badgeId`、`workId`、`userId`、`topicId`、`emojiAssetId`。
- 若业务查询同时涉及两个自然键列，排序时应先按业务主维度过滤，再以剩余键列作决胜字段。

### 3.4 API 契约原则

- 第 1 组表优先做结构收口，不额外扩散接口改造。
- 第 2 组表如果移除 `id`，必须在同一批改完：
  - schema
  - service 返回结构
  - DTO 继承结构
  - controller 入参
  - seed 写法
  - 默认排序

### 3.5 约束与关联方式

- 本仓库本轮**不允许引入数据库外键**。
- 表间一致性统一在业务层控制，不依赖数据库 FK 约束。
- schema 层只保留：
  - 主键
  - 唯一约束
  - 必要索引
- 存在性校验、可删性校验、级联清理、状态约束都放在 service / transaction 中处理。
- Drizzle `relations` 仍可继续使用，但仅作为应用层查询关系，不代表数据库外键。

## 4. 本轮总表与最终结论

| 表 | 类型 | 目标主键/唯一键 | `id` 结论 | 时间字段结论 | 默认排序 |
| --- | --- | --- | --- | --- | --- |
| `work_author_relation` | 轻量成员关系 | 复合主键 `(workId, authorId)` | 移除 | 移除 `createdAt/updatedAt` | `sortOrder asc, authorId asc` |
| `work_category_relation` | 轻量成员关系 | 维持复合主键 `(workId, categoryId)` | 不引入 | 移除 `createdAt/updatedAt` | `sortOrder asc, categoryId asc` |
| `work_tag_relation` | 轻量成员关系 | 维持复合主键 `(workId, tagId)` | 不引入 | 移除 `createdAt/updatedAt` | `tagId asc` |
| `forum_topic_tag` | 事实关系 | 复合主键 `(topicId, tagId)` | 移除 | 保留 `createdAt` | `createdAt desc, topicId asc` |
| `forum_moderator_section` | 当前状态映射 | 复合主键 `(moderatorId, sectionId)` | 移除 | 移除 `createdAt/updatedAt` | `sectionId asc` |
| `app_announcement_read` | 已读事实 | 复合主键 `(announcementId, userId)` | 移除 | 保留 `readAt` | `readAt desc, announcementId asc` |
| `emoji_recent_usage` | 聚合状态关系 | 维持复合主键 `(userId, scene, emojiAssetId)` | 不引入 | 保留 `lastUsedAt`，移除 `createdAt/updatedAt` | `lastUsedAt desc, emojiAssetId asc` |
| `user_badge_assignment` | 状态/事实关系 | 复合主键 `(userId, badgeId)` | 移除 | 保留 `createdAt` | 用户维度：`createdAt desc, badgeId asc`；徽章维度：`createdAt desc, userId asc` |
| `user_work_reading_state` | 状态关系 | 复合主键 `(userId, workId)` | 移除 | 保留 `lastReadAt`，移除 `createdAt/updatedAt` | `lastReadAt desc, workId asc` |
| `chat_conversation_member` | 成员状态关系 | 复合主键 `(conversationId, userId)` | 移除 | 保留 `joinedAt`、`leftAt`、`lastReadAt` | 会话成员列表：`joinedAt asc, userId asc` |

## 5. 第一批：低风险、先收口结构

### 5.1 `work_author_relation`

目标结构：

- 主键改为 `(workId, authorId)`
- 保留字段：`workId`、`authorId`、`sortOrder`
- 移除字段：`id`、`createdAt`、`updatedAt`
- 默认排序：`sortOrder asc, authorId asc`

说明：

- 当前作品更新路径就是删光再建，`id` 与通用时间字段都没有稳定业务意义。
- 这类纯成员关系最适合直接收敛到复合主键。

### 5.2 `work_category_relation`

目标结构：

- 主键维持 `(workId, categoryId)`
- 保留字段：`workId`、`categoryId`、`sortOrder`
- 移除字段：`createdAt`、`updatedAt`
- 默认排序：`sortOrder asc, categoryId asc`

### 5.3 `work_tag_relation`

目标结构：

- 主键维持 `(workId, tagId)`
- 保留字段：`workId`、`tagId`
- 移除字段：`sortOrder`、`createdAt`、`updatedAt`
- 默认排序：`tagId asc`

说明：

- 标签关系不再单独承载成员排序语义。
- 若业务需要标签展示顺序，应使用标签资源自身排序，而不是关系表 `sortOrder`。

### 5.4 `forum_topic_tag`

目标结构：

- 主键改为 `(topicId, tagId)`
- 移除 `id`
- 保留 `createdAt`
- 默认排序：按标签看主题时使用 `createdAt desc, topicId asc`

说明：

- `createdAt` 既表达“打标签时间”，也承担“最近使用该标签的主题”查询的稳定排序职责。

### 5.5 `forum_moderator_section`

目标结构：

- 主键改为 `(moderatorId, sectionId)`
- 移除 `id`
- 移除 `createdAt`、`updatedAt`
- 保留 `permissions`
- 默认排序：`sectionId asc`

说明：

- 这是当前权限映射，不是权限变更历史。
- 历史审计应走专门日志，不依赖关系表通用时间字段。

### 5.6 `app_announcement_read`

目标结构：

- 主键改为 `(announcementId, userId)`
- 移除 `id`
- 保留 `readAt`
- 默认排序：`readAt desc, announcementId asc`

### 5.7 `emoji_recent_usage`

目标结构：

- 维持复合主键 `(userId, scene, emojiAssetId)`
- 不引入 `id`
- 保留 `lastUsedAt`
- 移除 `createdAt`、`updatedAt`
- 默认排序：`lastUsedAt desc, emojiAssetId asc`

说明：

- 这是典型的“最新状态聚合表”，保留最近使用时间即可。

## 6. 第二批：允许改接口契约的状态关系

### 6.1 `user_badge_assignment`

目标结构：

- 主键改为 `(userId, badgeId)`
- 移除 `id`
- 保留 `createdAt`
- 默认排序：
  - 查询某用户的徽章：`createdAt desc, badgeId asc`
  - 查询某徽章的用户：`createdAt desc, userId asc`

接口改造要求：

- 不再返回 `assignmentId`
- 以 `badgeId + createdAt` 表达“获得了哪个徽章、何时获得”
- 删除接口继续使用 `userId + badgeId`
- 所有默认按 `id desc` 的徽章分配分页，统一改为按 `createdAt desc` + 自然键决胜

### 6.2 `user_work_reading_state`

目标结构：

- 主键改为 `(userId, workId)`
- 移除 `id`
- 保留 `lastReadAt`
- 保留 `lastReadChapterId`
- 移除 `createdAt`、`updatedAt`
- 默认排序：`lastReadAt desc, workId asc`

接口改造要求：

- `BaseReadingStateDto` 不再继承 `BaseDto`
- 删除单条阅读历史：
  - 应用端接口改为按 `workId`
  - service 内部按 `userId + workId` 删除
- 所有历史分页以 `lastReadAt desc, workId asc` 稳定排序

### 6.3 `chat_conversation_member`

目标结构：

- 主键改为 `(conversationId, userId)`
- 移除 `id`
- 保留字段：
  - `conversationId`
  - `userId`
  - `role`
  - `isMuted`
  - `joinedAt`
  - `leftAt`
  - `lastReadAt`
  - `lastReadMessageId`
  - `unreadCount`
- 默认排序：
  - 会话成员列表：`joinedAt asc, userId asc`
  - 会话列表仍按会话维度排序，不依赖成员表 `id`

说明：

- `role` 与 `isMuted` 都属于当前成员状态，不应在去 `id` 时顺手删掉。
- 该表不对外提供独立 `memberId` 语义，本轮可以随结构一起收口。

## 7. 不在本轮处理的表

以下表保留现状，不纳入本轮文档的执行清单：

- `task_assignment`
- `task_progress_log`
- `user_like`
- `user_favorite`
- `user_follow`
- `user_download_record`
- `user_purchase_record`

统一处理原则：

- 不去 `id`
- 不在本轮同步改 DTO / controller 契约
- 后续如果要动，必须单独立项并先定义：
  - 契约兼容边界
  - 幂等键迁移方案
  - 默认排序与分页决胜字段
  - 历史数据迁移策略

## 8. 业务层约束要求

由于本项目明确不使用数据库外键，本轮所有表都要遵守以下要求：

1. 插入关系前，service 层先校验父记录存在且状态允许引用。
2. 删除父记录时，service 层决定是阻止删除、同步清理关系，还是保留历史。
3. 所有“唯一关系”都通过主键/唯一约束兜底，并在业务层补充可读错误信息。
4. 所有批量覆盖写入都放在事务中完成，避免中间态暴露。
5. `db/relations/*` 可以继续维护查询关系，但不得据此补数据库 FK。

## 9. 改造顺序

### 第一批：先做低风险结构收口

- `work_author_relation`
- `work_category_relation`
- `work_tag_relation`
- `forum_topic_tag`
- `forum_moderator_section`
- `app_announcement_read`
- `emoji_recent_usage`

目标：

- 先清掉最明显的冗余 `id` 与通用时间字段
- 不把工作流表、日志表一起卷进来
- 为后续排序治理保留更干净的表结构

### 第二批：再做带契约调整的状态关系

- `user_badge_assignment`
- `user_work_reading_state`
- `chat_conversation_member`

目标：

- 在同一批完成 schema、DTO、接口入参、默认排序的同步收口
- 避免出现“表已经没 `id`，接口还在讲 `id`”的半改状态

## 10. 与排序治理的衔接

关系表结构收口完成后，再继续排序治理，但只覆盖本轮纳入的表。

后续排序治理应处理：

- `work_author_relation` / `work_category_relation` 的 `sortOrder` 统一语义
- 无 `id` 后的稳定决胜字段是否需要沉淀成共享 helper
- 是否需要补排序唯一约束

顺序固定为：

1. 先执行本文档
2. 再执行 `sort-order-governance-2026-03-27.md` 中与本轮表相关的部分

## 11. 本轮剩余确认点

当前范围内无阻塞确认项，可直接进入执行。

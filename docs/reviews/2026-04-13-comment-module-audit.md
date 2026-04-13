# 评论模块审查报告

- 审查日期：2026-04-13
- 审查范围：`apps/app-api/src/modules/comment`、`libs/interaction/src/comment`、`libs/interaction/src/mention`、`libs/interaction/src/emoji`、`libs/message/src/notification|outbox`、`db/schema/app/user-comment.ts`、`db/schema/app/user-mention.ts`
- 审查方式：静态代码审查为主；通知与 DTO 结论结合现有 spec；性能结论基于查询形态与索引匹配分析，未连接数据库执行 `EXPLAIN ANALYZE`

## 一、现状梳理

### 1. 评论关系模型

- 评论事实统一落在 `user_comment`，根评论使用 `reply_to_id = null`，楼中楼使用 `reply_to_id = 直接父评论`，`actual_reply_to_id = 一级根评论`，即“展示扁平化、关系双指针”模型。
- 一级评论有 `floor`，在 `CommentService.createComment()` 中通过 `max(floor) + 1` 分配；回复评论不分配楼层，保持 `floor = null`。
- Drizzle relation 已经定义了 `userComment.replyTo`、`userComment.actualReplyTo`、`userComment.replies`、`userComment.actualReplies`，说明“被回复评论”和“根评论”关系在数据层是可直接回查的，见 `db/relations/app.ts:316-335`。

### 2. 表情接入现状

- 评论写入前会调用 `MentionService.buildBodyTokens()`，再由 `EmojiParserService.parse()` 把正文切成 `text / mentionUser / emojiUnicode / emojiCustom` 混合 token，见 `libs/interaction/src/comment/comment.service.ts:822-831`、`974-983`，`libs/interaction/src/mention/mention.service.ts:42-91`，`libs/interaction/src/emoji/emoji-parser.service.ts:24-91`。
- `body_tokens` 已经持久化到 `user_comment.body_tokens`，读路径可以直接回放，不需要二次解析。
- 评论场景已经定义了 `EmojiSceneEnum.COMMENT`，说明 schema 和 parser 都预留了评论表情场景。

### 3. 提及接入现状

- 写入评论/回复后，会在事务内调用 `replaceMentionsInTx()` 覆盖 `user_mention` 事实表，持久化 `source_type/source_id/mentioned_user_id/start_offset/end_offset/notified_at`，见 `libs/interaction/src/comment/comment.service.ts:891-897`、`1057-1063`，`libs/interaction/src/mention/mention.service.ts:98-175`。
- 可见评论进入通知链路时，会调用 `dispatchCommentMentionsInTx()` 补发 `COMMENT_MENTION` 通知，并在同一事务内回写 `notified_at`，见 `libs/interaction/src/comment/comment.service.ts:725-807`、`libs/interaction/src/mention/mention.service.ts:181-220`。
- 目前提及只校验“用户存在且可用”，不校验好友/关注关系，见 `libs/interaction/src/mention/mention.service.ts:140-149`。

### 4. 事件通知现状

- 评论通知统一走 `message_outbox`，由 `MessageOutboxWorker` 异步消费，再落 `user_notification` 和 `notification_delivery`，见 `libs/message/src/outbox/outbox.worker.ts:41-98`、`libs/message/src/notification/notification.service.ts:175-240`。
- 回复评论在“可见”时会补发 `COMMENT_REPLY`，且会在发送前排除“回复自己”，见 `libs/interaction/src/comment/comment.service.ts:755-802`；通知落库时也有 `SKIPPED_SELF` 兜底，见 `libs/message/src/notification/notification.service.ts:194-203`。
- 评论命中提及时会补发 `COMMENT_MENTION`，见 `libs/interaction/src/mention/mention.service.ts:181-220`。
- 论坛主题只有一级评论会触发 `TOPIC_COMMENT`，回复评论不会再给主题作者重复发这类通知，见 `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts:143-188`。
- 作品/章节 comment resolver 只提供了 `ownerUserId` 和计数更新，没有对应的 `postCommentHook` 通知逻辑；当前非论坛目标默认没有“目标被评论”通知。

### 5. 读取链路现状

- 用户侧公开读取主要有三条：
- `GET app/work/comment/page`、`GET app/work/chapter/comment/page`、`GET app/forum/topic/comment/page` 统一走 `CommentService.getTargetComments()`，返回一级评论和预览回复，见 `apps/app-api/src/modules/work/work.controller.ts:83-100`、`apps/app-api/src/modules/forum/forum-topic.controller.ts:95-110`。
- `GET app/comment/reply/page` 走 `CommentService.getReplies()`，返回扁平化回复分页，见 `apps/app-api/src/modules/comment/comment.controller.ts:84-94`。
- `GET app/comment/my/page` 走 `CommentService.getUserComments()`，返回“我的评论”分页，见 `apps/app-api/src/modules/comment/comment.controller.ts:72-82`。
- 管理端详情 `getAdminCommentDetail()` 已经能带出 `replyTo.user`，说明数据层能力是存在的，缺的是用户侧 DTO 和查询装配，见 `libs/interaction/src/comment/comment.service.ts:1642-1692`。

## 二、核心结论

- 评论关系、提及、回复通知、论坛主题一级评论通知已经串起来了。
- 评论正文已经支持“提及 + emoji”混合 token 持久化。
- 当前最主要的功能缺口不在写入，而在“用户侧返回结构”与“回复目标治理边界”。
- 当前最主要的性能风险集中在“主题评论最热排序”和“用户维度评论查询缺少复合索引”。

## 三、主要问题

### 1. [必须修复] 用户侧评论返回结构没有补齐“被回复人”，不满足查看回复人和被回复人的需求

**现象**

- `CommentReplyItemDto`、`CommentPreviewReplyDto`、`TargetCommentItemDto` 只有当前评论作者 `user` 和 `replyToId`，没有 `replyToUser` 或 `replyTo` 快照，见 `libs/interaction/src/comment/dto/comment.dto.ts:399-480`、`486-540`。
- `getReplies()` 只批量查询当前回复作者信息，没有回查 `replyTo` 对应评论作者，见 `libs/interaction/src/comment/comment.service.ts:1246-1308`。
- `getTargetComments()` 组装 `previewReplies` 时同样只补 `user`，没有补 `replyTo.user`，见 `libs/interaction/src/comment/comment.service.ts:1447-1510`。
- 反而管理端详情已经补了 `replyTo.user`，见 `libs/interaction/src/comment/comment.service.ts:1648-1682`。

**影响**

- 客户端最多只能知道“这条回复指向哪条评论 ID”，不能直接渲染“张三 回复 李四”。
- 如果前端额外发请求回查 `replyToId -> user`，会把原本单次分页查询拆成二次或 N 次查询，放大接口复杂度和延迟。

**建议**

- 在用户侧 DTO 中显式补 `replyToUser`，至少包含 `id/nickname/avatarUrl`；更稳妥的做法是补一个最小 `replyTo` 快照，包含 `id/userId` 和 `user`。
- `getReplies()` / `getTargetComments()` 在批量查作者时，把 `replyToId` 对应评论的 `userId` 一并批量查出，再批量取 `app_user`，避免回退到逐条查询。
- `my/page` 如果也要展示回复关系，同样要扩展 DTO，而不是继续复用 `BaseCommentDto`。

### 2. [必须修复] 回复链路没有校验“被回复评论是否可见”，会允许回复隐藏/未过审评论

**现象**

- `replyComment()` 当前只校验 `replyTo` 是否存在和 `deletedAt`，没有校验 `auditStatus` / `isHidden`，见 `libs/interaction/src/comment/comment.service.ts:985-1005`。
- 读取侧却明确只暴露“审核通过 + 未隐藏 + 未删除”的评论/回复，见 `buildVisibleReplyConditions()` 和 `buildVisibleRootCommentConditions()`，即 `libs/interaction/src/comment/comment.service.ts:325-378`。

**影响**

- 只要客户端持有旧的 commentId，或恶意猜测到隐藏评论 ID，就可以对不可见评论继续回复。
- 这类回复会写入目标对象评论计数，也可能继续触发 `COMMENT_REPLY` 通知，形成“回复对象不可见，但回复事实和通知仍然存在”的治理穿透。
- 如果被回复的是一级评论，被删/被隐藏后还会留下 `actual_reply_to_id` 指向不可见根评论的孤儿楼中楼。

**建议**

- 明确业务规则：是否允许回复自己的待审核评论；除该例外外，建议统一要求 `replyTo` 满足 `APPROVED && !isHidden && deletedAt is null`。
- 如果产品允许回复不可见评论，也需要同步设计读取与计数语义，否则会长期积累孤儿回复。

### 3. [建议修改] 主题评论“最热”排序使用相关子查询统计 replyCount，热点主题下成本会快速放大

**现象**

- `getTargetComments(sort=hot)` 为每一条一级评论构造了一个相关子查询 `replyCountSql`，然后按 `likeCount desc, replyCount desc, createdAt desc, id desc` 排序，见 `libs/interaction/src/comment/comment.service.ts:1349-1404`。
- `user_comment` 现有根评论索引主要是：
- `(target_type, target_id, created_at)`，见 `db/schema/app/user-comment.ts:122`
- `(target_type, target_id, audit_status, is_hidden, deleted_at)`，见 `db/schema/app/user-comment.ts:131`
- `(target_type, target_id, deleted_at, created_at)`，见 `db/schema/app/user-comment.ts:140`
- 这些索引都不能直接支撑 `like_count + 动态 replyCount` 的排序。

**影响**

- 当单个主题下一级评论很多时，数据库需要对候选根评论反复计算可见回复数，再做排序；这条 SQL 的成本不会随着分页页大小线性收敛。
- 当前代码里 `onlyAuthor` 还会把 replyCount 统计口径再次带进相关子查询，进一步增加 planner 复杂度。

**建议**

- 如果“最热”是高频查询，建议把“可见回复数”物化到根评论或专门的 comment counter 聚合表，在写路径/审核补偿里同步维护。
- 至少应改成“一次 group by 聚合 + join”而不是“每行一个 count(\*) 相关子查询”。
- 如果短期不改模型，建议先在真实数据上跑 `EXPLAIN ANALYZE`，重点观察热点主题下排序耗时与 rows removed by filter。

### 4. [建议修改] 用户维度评论查询缺少复合索引，我的评论分页和频控查询会逐步变重

**现象**

- `getUserComments()` 的过滤条件是 `user_id + deleted_at (+ target_type/target_id/audit_status)`，排序是 `created_at desc / like_count desc`，见 `libs/interaction/src/comment/comment.service.ts:1525-1546`。
- `CommentPermissionService.ensureUserLevelRateLimit()` 会频繁执行：
- `count(user_comment where user_id = ? and created_at >= today)`，见 `libs/interaction/src/comment/comment-permission.service.ts:149-158`
- `select created_at from user_comment where user_id = ? order by created_at desc limit 1`，见 `libs/interaction/src/comment/comment-permission.service.ts:176-181`
- 但 `user_comment` 只有 `user_comment_user_id_idx` 和 `user_comment_created_at_idx` 两个单列索引，没有 `(user_id, deleted_at, created_at)` 或 `(user_id, created_at desc)` 这类复合索引，见 `db/schema/app/user-comment.ts:144-148`。

**影响**

- 活跃用户评论量上来后，“我的评论”分页和发言频控都会依赖更多回表与排序。
- 这些查询都在主写路径前执行，属于会直接影响发评论时延的同步热点。

**建议**

- 至少补一个 `(user_id, deleted_at, created_at desc)` 复合索引。
- 如果 `my/page` 的筛选组合长期稳定，可以再评估 `(user_id, deleted_at, audit_status, created_at desc)`。
- 如果“最热”我的评论真有高频场景，再单独评估 `user_id + deleted_at + like_count + created_at` 口径，而不是先过度建索引。

### 5. [建议修改] 评论表情接入只完成了解析与持久化，没有打通评论场景的最近使用闭环

**现象**

- 评论/回复写入时会构建 `bodyTokens`，但没有像聊天那样把解析出的 `emojiAssetId` 回写到 `emoji_recent_usage`。
- 评论侧只调用了 `MentionService.buildBodyTokens()`，见 `libs/interaction/src/comment/comment.service.ts:822-831`、`974-983`。
- 最近使用能力已经存在于 `EmojiCatalogService.recordRecentUsageInTx()`，见 `libs/interaction/src/emoji/emoji-catalog.service.ts:348-391`。
- 全仓现有调用方只有聊天消息发送链路，见 `libs/message/src/chat/chat.service.ts:803-809`。

**影响**

- 如果产品要支持“评论输入框里的最近使用表情”，当前 comment scene 的数据永远不会增长。
- 评论和聊天会形成两套不一致的用户体验：都能发表情，但只有聊天会沉淀 recent。

**建议**

- 复用聊天的做法：从 `bodyTokens` 提取 `emojiAssetId/useCount`，在评论事务里调用 `recordRecentUsageInTx(scene = COMMENT)`。
- 如果产品明确不需要评论 recent，也建议把 `EmojiSceneEnum.COMMENT` 和相关 schema 规划写清楚，避免后续误判“已经接入完毕”。

### 6. [问题] “提及好友”当前只实现了“提及可用用户”，没有好友/关注关系约束

**现象**

- `replaceMentionsInTx()` 只通过 `UserService.findAvailableUsersByIds()` 校验用户存在且可用，见 `libs/interaction/src/mention/mention.service.ts:140-149`。
- 代码里没有任何好友关系、互关关系或同圈层关系校验。

**需要确认**

- 如果产品语义只是“可以 @ 其他用户”，现状没问题。
- 如果产品语义是“只能 @ 好友/互关用户”，后端校验尚未落地，不能只靠前端候选列表限制。

### 7. [问题] 当前只有论坛主题一级评论会通知目标拥有者，作品/章节是否需要“被评论”通知需要补充产品口径

**现象**

- `ForumTopicCommentResolver.postCommentHook()` 会在一级评论时发 `TOPIC_COMMENT`，回复评论直接 return，见 `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts:143-188`。
- 作品/章节 resolver 虽然都能解析 `ownerUserId`，但没有对应 `postCommentHook` 通知逻辑，见：
- `libs/content/src/work/core/resolver/work-comic-comment.resolver.ts`
- `libs/content/src/work/core/resolver/work-novel-comment.resolver.ts`
- `libs/content/src/work/chapter/resolver/work-comic-chapter-comment.resolver.ts`
- `libs/content/src/work/chapter/resolver/work-novel-chapter-comment.resolver.ts`

**需要确认**

- 如果事件通知要求覆盖“作品/章节被评论”，当前实现是不完整的。
- 如果只要求“回复别人评论时提醒对方”，当前链路已经满足。

## 四、建议的改造优先级

### P0

- 用户侧评论 DTO 和查询装配补齐 `replyToUser` / `replyTo` 快照。
- 回复写入前补可见性校验，避免回复隐藏/未过审评论。

### P1

- 优化主题评论 `hot` 查询：改聚合策略，避免相关子查询排序。
- 为用户维度评论分页和发言频控补复合索引。

### P2

- 补评论场景 emoji recent usage。
- 明确“提及好友”是否要求好友关系校验。
- 明确作品/章节是否需要 owner notification。

## 五、建议的最小改造方案

1. 扩展 `CommentReplyItemDto`、`CommentPreviewReplyDto`、`BaseCommentDto`（或新增用户侧 response DTO），增加 `replyToUser`。
2. 在 `getReplies()` / `getTargetComments()` 中批量加载：
   - 当前评论作者 `userId`
   - `replyToId -> replyTo.userId`
   - `replyTo.userId -> appUser`
3. 在 `replyComment()` 里把 `replyTo` 查询升级为显式校验可见性，至少补 `auditStatus` / `isHidden`。
4. 为 `user_comment` 增加：
   - `(user_id, deleted_at, created_at desc)`
   - 视真实压测结果再评估根评论可见列表或热榜专用索引/聚合表。
5. 从 `bodyTokens` 提取评论场景 emoji recent usage，接入 `EmojiCatalogService.recordRecentUsageInTx()`。

## 六、审查结论

- 当前评论模块的“基础写入能力”已经比较完整：评论关系、提及事实表、emoji token 持久化、回复通知、提及通知、论坛主题一级评论通知都已打通。
- 当前最明显的不满足项是“用户侧返回结构没有被回复人快照”。
- 当前最明确的 correctness 风险是“允许回复隐藏/未过审评论”。
- 当前最值得优先处理的性能点是“主题评论最热排序”以及“用户维度评论查询缺少复合索引”。

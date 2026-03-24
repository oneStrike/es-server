# 作品模块与论坛模块联动多维审查报告

- 审查时间：2026-03-19
- 审查方式：静态代码审查
- 审查范围：
  - `apps/app-api/src/modules/work`
  - `apps/admin-api/src/modules/content/comic`
  - `apps/admin-api/src/modules/content/novel`
  - `apps/admin-api/src/modules/forum/topic`
  - `libs/content/src/work`
  - `libs/forum/src/topic`
  - `libs/forum/src/counter`
  - `libs/interaction/src/{like,favorite,comment,browse-log,report}`
- 关注维度：
  - 联动正确性
  - 接口齐全性
  - 入参与过滤条件合理性
  - 回参与 DTO/Swagger 契约一致性
  - 安全性与可见性控制
  - 性能与可扩展性
  - 可维护性与代码质量

## 总体结论

当前“作品 -> 论坛板块 -> 论坛主题 -> 通用互动”这条链路已经搭起来了，优点是：

- 作品创建时会自动创建论坛板块，删除作品时也会同步处理板块。
- 作品、论坛主题都通过 `libs/interaction` 的 resolver 机制接入了点赞、收藏、评论、浏览、举报。
- 主要写操作普遍使用事务，基础一致性意识是有的。

但从联动质量看，这条链路仍有明显断层，且包含数个高风险问题：

- 发布态与板块启停的联动在管理端实际没有走通。
- 用户端可见性控制不完整，未发布作品、禁用板块、隐藏或未审核主题都存在被绕过的空间。
- 论坛主题删除存在跨目标误删评论的风险。
- DTO/Swagger 契约与真实回参存在系统性偏差。
- 用户端论坛 API 明显不完整，底层服务能力和控制器暴露不一致。

结论：当前联动“能跑”，但还不能认为“闭环可靠”。建议先处理 P0/P1，再做 API 和 DTO 收口。

## 核心问题

### P0. 管理端更新作品发布状态时，没有同步论坛板块启停

- 证据：
  - `apps/admin-api/src/modules/content/comic/core/comic.controller.ts:61-70`
  - `apps/admin-api/src/modules/content/novel/novel.controller.ts:61-70`
  - `libs/content/src/work/core/work.service.ts:446-473`
  - `libs/content/src/work/core/work.service.ts:475-493`
- 现状：
  - `WorkService.updateStatus()` 已经实现了 `work.isPublished` 与 `forumSection.isEnabled` 的同步。
  - 但漫画/小说管理端控制器实际调用的是 `updateWorkFlags()`，只改作品表，不改论坛板块。
- 影响：
  - 作品上下架与论坛板块启停脱节。
  - 已下架作品的讨论板块可能仍处于启用态。
  - 后续任何依赖 `forum_section.is_enabled` 的逻辑都会出现脏状态。
- 维度：
  - 联动正确性
  - 数据一致性
  - 可维护性
- 建议：
  - 管理端发布态更新统一改走 `WorkService.updateStatus()`。
  - 禁止控制器绕开带联动语义的方法直接改 flag。

### P0. 删除论坛主题时，会按 `targetId` 误删同 ID 的非论坛评论

- 证据：
  - `libs/forum/src/topic/forum-topic.service.ts:370-407`
- 现状：
  - 删除主题时，代码只按 `user_comment.target_id = topic.id` 软删评论。
  - 没有限制 `targetType = FORUM_TOPIC`。
- 影响：
  - 只要作品、章节、论坛主题存在相同数值 ID，就可能把别的业务目标下的评论一起删掉。
  - 这是直接的数据破坏问题。
- 维度：
  - 安全性
  - 数据一致性
  - 代码质量
- 建议：
  - 删除条件必须补上 `targetType = CommentTargetTypeEnum.FORUM_TOPIC`。
  - 同时补充回归测试，覆盖“相同 targetId、不同 targetType”的场景。

### P0. 用户端可见性控制不完整，未发布作品与隐藏/未审核主题存在绕过路径

- 证据：
  - `apps/app-api/src/modules/work/work.controller.ts:71-109`
  - `libs/content/src/work/core/work.service.ts:623-676`
  - `libs/content/src/work/core/work.service.ts:685-775`
  - `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts:71-84`
  - `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts:51-68`
  - `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts:48-63`
  - `libs/forum/src/topic/resolver/forum-topic-browse-log.resolver.ts:78-96`
  - `libs/content/src/work/core/resolver/work-comic-comment.resolver.ts:88-105`
  - `libs/content/src/work/core/resolver/work-comic-like.resolver.ts:49-67`
  - `libs/content/src/work/core/resolver/work-comic-favorite.resolver.ts:47-62`
  - `libs/content/src/work/core/resolver/work-comic-browse-log.resolver.ts:81-100`
  - 小说 resolver 与漫画 resolver 为同构实现，问题同样存在。
- 现状：
  - `getWorkDetail()` 只校验 `deletedAt is null`，没有校验 `isPublished`。
  - `getWorkForumSection()` 不校验作品是否已发布，也不拦截禁用板块。
  - `getWorkForumTopics()` 只筛主题 `auditStatus=APPROVED` 和 `isHidden=false`，但不要求板块处于启用态。
  - 论坛主题的评论/点赞/浏览/收藏 resolver 普遍只校验“未删除”，没有统一校验“板块启用 + 主题可见 + 审核通过”。
  - 作品侧 resolver 普遍只校验“作品存在”，没有统一校验“已发布”。
- 影响：
  - 已下架作品可被直接查看详情。
  - 已禁用作品板块仍可能通过作品接口被公开读到。
  - 只要知道 topicId，用户就可能对隐藏帖、待审核帖继续点赞、评论、收藏或制造浏览。
- 维度：
  - 安全性
  - 权限控制
  - 审核闭环
- 建议：
  - 引入统一的“用户端可见目标校验层”，不要把“存在即合法”散落在 resolver 里。
  - 作品侧至少统一校验 `deletedAt is null && isPublished = true`。
  - 论坛主题侧至少统一校验：
    - 主题未删除
    - 审核通过
    - 非隐藏
    - 所属板块启用

### P1. 论坛主题更新允许修改 `sectionId` / `userId`，但没有做计数和审核语义补偿

- 证据：
  - `libs/forum/src/topic/dto/forum-topic.dto.ts:37-51`
  - `libs/forum/src/topic/dto/forum-topic.dto.ts:198-200`
  - `libs/forum/src/topic/forum-topic.service.ts:289-361`
- 现状：
  - `UpdateForumTopicDto` 直接继承 `CreateForumTopicDto`，因此允许修改 `sectionId` 和 `userId`。
  - `ForumTopicService.updateTopic()` 直接 `set(updateData)`。
  - 但更新逻辑没有处理：
    - 老板块/新板块 `topicCount` 迁移
    - 老用户/新用户 `forumProfile.topicCount` 迁移
    - 变更板块后按新板块审核策略重算
- 影响：
  - 主题迁移板块或改归属用户后，计数器会脏。
  - 审核策略可能还是按旧板块算。
- 维度：
  - 联动正确性
  - 数据一致性
  - 可维护性
- 建议：
  - 如果业务不允许迁移归属，直接从 `UpdateForumTopicDto` 去掉 `sectionId`、`userId`。
  - 如果业务允许迁移，就必须单独做“迁移主题”服务并补齐计数与审核策略。

### P1. 论坛评论统计与板块最后发帖时间没有真正维护，作品侧读取到的数据不可靠

- 证据：
  - `libs/forum/src/counter/forum-counter.service.ts:61-75`
  - `libs/forum/src/counter/forum-counter.service.ts:84-94`
  - `libs/forum/src/counter/forum-counter.service.ts:227-259`
  - `libs/forum/src/topic/forum-topic.service.ts:176-191`
  - `libs/forum/src/topic/forum-topic.service.ts:380-406`
  - `libs/forum/src/topic/forum-topic.service.ts:542-560`
  - `libs/content/src/work/core/work.service.ts:639-651`
- 现状：
  - 创建/删除主题时只更新 `topicCount`，没有更新 `forum_section.lastPostAt` / `lastTopicId`。
  - `ForumCounterService.updateReplyRelatedCounts()` 存在，但没有被实际使用。
  - `ForumTopicService.incrementReplyCount()` 也没有被调用。
  - 作品侧论坛板块详情却把 `commentCount`、`lastPostAt` 当成可返回字段。
- 影响：
  - 板块页、作品讨论区页拿到的 `commentCount` / `lastPostAt` 可能长期失真。
  - 排序、推荐、运营判断都会受影响。
- 维度：
  - 联动正确性
  - 数据质量
  - 接口可靠性
- 建议：
  - 明确“论坛评论”是否就是 `user_comment`。
  - 如果是，评论创建/删除必须回写 topic/section/profile 的 comment 统计与最后发帖时间。
  - 如果不是，就不要继续在用户端返回这套字段，避免误导。

### P1. 用户端论坛 API 不完整，底层有能力但接口层没有接齐

- 证据：
  - `apps/app-api/src/modules/app.module.ts:17-35`
  - `apps/app-api/src/modules/work/work.controller.ts:91-109`
  - `apps/admin-api/src/modules/forum/topic/topic.controller.ts:23-120`
  - `libs/forum/src/topic/forum-topic.service.ts:117-279`
  - `apps/app-api/src/modules/comment/comment.controller.ts:19-77`
  - `apps/app-api/src/modules/like/like.controller.ts:20-76`
  - `apps/app-api/src/modules/favorite/favorite.controller.ts:20-81`
- 现状：
  - app 侧没有独立的 `forum` 模块，也没有 `app/forum/topic/page|detail|create|update|delete`。
  - 目前仅通过作品模块暴露了：
    - `app/work/forum-section/detail`
    - `app/work/forum-topic/page`
  - 但 app 侧又已经开放了评论、点赞、收藏等通用互动接口，理论上支持 `FORUM_TOPIC`。
- 影响：
  - 论坛在 app 侧呈现为“半成品”：可互动，但缺少完整话题读写闭环。
  - 客户端必须依赖作品模块间接访问论坛主题，接口语义不清晰。
- 维度：
  - 接口齐全性
  - 领域边界清晰度
  - 可维护性
- 建议：
  - 至少补齐 app 侧 forum topic 的 `page`、`detail`、`create`。
  - 如果当前产品只允许“作品讨论区”，也建议把论坛接口显式放到 `app/forum/...`，避免继续挂在 `app/work/...` 下扩散耦合。

### P1. DTO / Swagger 契约与真实回参存在系统性偏差

- 证据：
  - `apps/app-api/src/modules/work/dto/work.dto.ts:44-70`
  - `apps/app-api/src/modules/work/dto/work.dto.ts:139-174`
  - `libs/content/src/work/core/work.service.ts:616-620`
  - `libs/content/src/work/core/work.service.ts:639-658`
  - `libs/content/src/work/core/work.service.ts:665-676`
  - `libs/content/src/work/core/work.service.ts:759-775`
  - `apps/admin-api/src/modules/forum/topic/topic.controller.ts:23-120`
  - `libs/forum/src/topic/forum-topic.service.ts:223-245`
- 现状：
  - `WorkDetailDto` 基于 `PageWorkDto`，没有声明 `description`、`viewRule`、`chapterPrice`、`canComment`、`commentCount`、`forumSectionId` 等字段，但 `getWorkDetail()` 实际返回的是完整 work 行再加用户态。
  - `WorkForumSectionDto` 没声明 `topicCount`、`commentCount`，但 `getWorkForumSection()` 实际会返回。
  - `WorkForumTopicDto` 只声明了精简字段，但 `getWorkForumTopics()` 直接返回 `forum_topic` 全行分页结果。
  - admin 侧 `ForumTopicController.getDetail()` 文档声明 `BaseForumTopicDto`，但 `getTopicById()` 实际返回 `topicTags`、`section`、`user.forumProfile`、`user.level`。
- 影响：
  - Swagger 不可信。
  - 前端和测试会误判字段来源与稳定性。
  - DTO 已经失去“回参契约”意义。
- 维度：
  - 回参与 DTO 一致性
  - 接口文档质量
  - 代码质量
- 建议：
  - 明确“DTO 是输入校验模型”还是“真实输出契约模型”，不要混用。
  - 所有控制器返回值要么走显式映射，要么补齐响应 DTO，不要继续直接透传数据库实体。

### P1. 点赞/收藏列表 DTO 语义失真，论坛主题也被塞进 `work` 字段

- 证据：
  - `apps/app-api/src/modules/like/dto/like.dto.ts:21-31`
  - `apps/app-api/src/modules/favorite/dto/favorite.dto.ts:31-45`
  - `libs/interaction/src/like/like.service.ts:317-329`
  - `libs/interaction/src/favorite/favorite.service.ts:269-281`
  - `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts:135-149`
- 现状：
  - app DTO 把列表详情字段命名为 `work`，结构约定为 `{ id, name, cover }`。
  - 实际上 `LikeService` / `FavoriteService` 对所有 targetType 都把 resolver 返回详情挂到 `work`。
  - 论坛主题 resolver 返回的是 `{ id, title }`。
- 影响：
  - 收藏/点赞列表对论坛主题会出现字段形态与 DTO 不匹配。
  - 前端如果按作品模型解析，会直接出错。
- 维度：
  - 回参与 DTO 一致性
  - 接口设计
- 建议：
  - 改成 `targetDetail` 多态字段，按 targetType 分派。
  - `work` 仅保留给作品类目标，论坛主题单独使用 `topic`。

### P1. `QueryWorkDto` 声明了多种筛选条件，但 `getWorkPage()` 实际没有执行

- 证据：
  - `apps/app-api/src/modules/work/dto/work.dto.ts:73-95`
  - `libs/content/src/work/core/work.service.ts:587-620`
- 现状：
  - DTO 声明了 `serialStatus`、`language`、`region`、`ageRating`、`isRecommended`、`isHot`、`isNew` 等筛选项。
  - `getWorkPage()` 实际只用了：
    - `type`
    - `isPublished`
    - `name`
    - `publisher`
    - `author`
    - `tagIds`
  - 其余字段只是被透传到分页参数对象，没有进入 where。
- 影响：
  - 入参与实现不一致。
  - 前端或测试认为“可筛选”的条件实际上无效。
- 维度：
  - 入参合理性
  - 接口可信度
  - 代码质量
- 建议：
  - 删除无效筛选字段，或把筛选补齐。
  - 对外接口不要保留“看起来支持、实际不生效”的参数。

### P2. 作品与论坛板块的联动只覆盖“创建/上下架/删除/改名”，没有覆盖描述等元数据同步

- 证据：
  - `libs/content/src/work/core/work.service.ts:221-237`
  - `libs/content/src/work/core/work.service.ts:341-360`
- 现状：
  - 创建作品时会把 `work.description.slice(0, 500)` 写入 `forum_section.description`。
  - 更新作品时只同步板块名称，不同步板块描述，也没有同步 icon、分组、权限等论坛侧信息。
- 影响：
  - 作品详情和作品讨论区描述很容易漂移。
  - 日后很难判断论坛板块是作品派生数据，还是独立维护数据。
- 维度：
  - 联动正确性
  - 可维护性
- 建议：
  - 明确论坛板块字段的“单一来源”。
  - 如果板块描述应跟作品描述同步，就在 `updateWork()` 内补齐。
  - 如果板块描述允许独立维护，就不要在创建时偷偷复制作品描述，应改成显式初始化策略。

### P2. `getWorkPage()` 的实现方式在数据量扩大后扩展性一般

- 证据：
  - `libs/content/src/work/core/work.service.ts:597-613`
- 现状：
  - 作者、标签筛选是“先查 relation 表拉出全量 workId，再拼 `IN (...)`”。
  - 这在小规模数据下可接受，但数据量大时容易出现：
    - 中间 ID 集合过大
    - SQL 过长
    - 优化器难命中最佳路径
- 影响：
  - 分页前先做全量 ID 汇总，后续扩展性较弱。
- 维度：
  - 性能
  - 可维护性
- 建议：
  - 改成 `exists` 子查询或直接 join/filter。
  - 同时把尚未生效的筛选条件一并收口，避免后面继续堆叠临时查询。

## 维度复盘

### 1. 安全与权限

- 当前最大问题不是“有没有鉴权”，而是“鉴权后是否还做了目标可见性校验”。
- 作品、论坛主题在用户端都存在“存在即可互动/查看”的倾向，审核态、发布态、板块启用态没有被统一纳入判断。

### 2. 接口齐全性

- 论坛底层 service 已有完整 CRUD 能力。
- admin 侧 topic 管理接口也完整。
- app 侧却只有“作品讨论区只读列表”和通用互动接口，缺少 forum 自己的清晰入口。

### 3. DTO/契约一致性

- 当前 DTO 更像“Swagger 装饰载体”，而不是“真实响应契约”。
- 如果不收口，后续前后端联调、自动化测试、API 变更管理都会持续产生隐性成本。

### 4. 数据一致性

- 作品与论坛板块之间最核心的问题是“联动逻辑散落在多个入口，且没有强制走同一条路径”。
- 论坛内部最核心的问题是“计数器字段存在，但并未形成稳定的回写闭环”。

### 5. 性能

- 当前没有看到会立刻炸掉的热点 SQL。
- 但 `getWorkPage()` 的筛选实现、直接透传整行分页结果、以及多处“数据库实体直接出接口”都不利于后续扩展。

## 建议整改顺序

### 第一批：必须先修

1. 修复主题删除时误删跨目标评论的问题。
2. 统一管理端作品发布状态入口，确保同步板块启停。
3. 收紧用户端可见性校验，至少封住未发布作品、禁用板块、隐藏/待审核主题的读取和互动入口。

### 第二批：联动闭环补齐

1. 收口论坛主题更新 DTO，禁止无补偿地修改 `sectionId` / `userId`。
2. 补齐 commentCount、lastPostAt、lastTopicId 的维护链路，或者下掉无效字段。
3. 明确作品与论坛板块哪些字段需要强同步，哪些字段独立维护。

### 第三批：接口与契约治理

1. 补 app 侧 forum topic 的明确接口。
2. 清理 DTO 与真实回参偏差。
3. 给 like/favorite 列表定义真正的多态 `targetDetail` 契约。
4. 清理 `QueryWorkDto` 中未生效的筛选项。

## 建议补测用例

- 作品下架后，关联板块是否同步禁用。
- 删除 `forum_topic.id = N` 时，`targetType != FORUM_TOPIC && targetId = N` 的评论是否被误删。
- 未发布作品能否被 `app/work/detail` 直接访问。
- 已隐藏/待审核论坛主题能否被 comment/like/favorite/report 接口操作。
- 更新主题归属板块或归属用户后，相关计数是否正确迁移。
- `app/work/forum-section/detail` 与 `app/work/forum-topic/page` 的回参是否与 Swagger 定义一致。

## 结论

这次排查最值得优先处理的不是“代码风格”，而是三个实质性问题：

- 联动入口没有统一，导致作品发布态与论坛板块状态脱节。
- 用户端可见性收口不严，审核/发布边界存在绕过路径。
- 数据删除和计数回写存在明显一致性风险。

如果只允许做一轮短平快整改，建议先做：

1. 修复主题删除条件。
2. 修复作品发布态同步入口。
3. 统一封装作品/论坛主题的用户端可见性校验。

完成这三项后，再推进接口补齐和 DTO 治理，整体收益会最高。

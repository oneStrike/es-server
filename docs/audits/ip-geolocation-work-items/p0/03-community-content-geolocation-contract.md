# P0-03 打通社区内容属地写入与 App 返回契约

## 目标

- 让论坛主题、评论在写入时持久化统一属地快照。
- 让 app 端论坛主题与评论的现有列表 / 详情接口，以及复用相关返回 DTO 的现有接口返回归属地字段。

## 范围

- `apps/app-api/src/modules/forum/forum-topic.controller.ts`
- `apps/app-api/src/modules/comment/comment.controller.ts`
- `apps/app-api/src/modules/favorite/favorite.controller.ts`
- `apps/app-api/src/modules/work/work.controller.ts`
- `apps/app-api/src/modules/work/work-chapter.controller.ts`
- `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- `libs/forum/src/topic/forum-topic.service.ts`
- `libs/forum/src/topic/forum-topic.type.ts`
- `libs/forum/src/topic/dto/forum-topic.dto.ts`
- `libs/forum/src/profile/profile.service.ts`
- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/dto/comment.dto.ts`
- `libs/interaction/src/comment/comment.type.ts`
- `libs/interaction/src/favorite/dto/favorite.dto.ts`

## 现状锚点（2026-04-08）

- app 端论坛主题详情当前只把 `ipAddress/device` 用于浏览日志，不参与主题创建落库：
  - `apps/app-api/src/modules/forum/forum-topic.controller.ts`
- app / admin 端论坛主题 create / update / delete 当前都已接收 `req`，并在 controller 边界组装 `ForumTopicClientContext`：
  - `apps/app-api/src/modules/forum/forum-topic.controller.ts`
  - `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- 评论创建 / 回复当前已透传客户端属地上下文：
  - `apps/app-api/src/modules/comment/comment.controller.ts`
  - `libs/interaction/src/comment/comment.service.ts`
- `TargetCommentItemDto` 当前不仅用于论坛主题评论分页，也被作品、章节评论分页复用：
  - `apps/app-api/src/modules/forum/forum-topic.controller.ts`
  - `apps/app-api/src/modules/work/work.controller.ts`
  - `apps/app-api/src/modules/work/work-chapter.controller.ts`
- `PublicForumTopicPageItemDto` 当前除论坛主题公共分页 / 我的主题外，还被收藏主题分页嵌套复用：
  - `apps/app-api/src/modules/favorite/favorite.controller.ts`
  - `libs/interaction/src/favorite/dto/favorite.dto.ts`
- 收藏主题分页当前已补齐与 `PublicForumTopicPageItemDto` 对齐的 `geo*` 查询投影与组装字段：
  - `libs/forum/src/topic/forum-topic.service.ts`
- 论坛主题 app 端现有返回 DTO：
  - `PublicForumTopicPageItemDto`
  - `PublicForumTopicDetailDto`
  - `MyForumTopicItemDto`
- 评论 app 端现有返回 DTO：
  - `BaseCommentDto`
  - `TargetCommentItemDto`
  - `CommentReplyItemDto`

## 非目标

- 不新增 app 端全站评论 detail 路由。
- 不改造浏览日志的属地写入。
- 不新增后台论坛主题或后台评论页面的属地筛选能力。
- 不回填历史主题 / 评论记录，也不在读取时按旧 IP 补算属地。

## 主要改动

- 在论坛主题创建链路中补充客户端属地上下文：
  - app controller
  - admin controller
  - forum topic service
- 在评论创建 / 回复链路中补充客户端属地上下文：
  - comment controller
  - comment service
- 扩展论坛主题与评论相关 schema 查询投影、DTO 与组装逻辑，使 app 端现有列表 / 详情接口返回归属地字段。
- 论坛主题与评论的新增属地字段在读路径按可空字段处理；旧记录返回空值属于预期行为。
- 若共享实体 DTO 复用导致后台详情 / 分页被动带出只读 `geo*` 字段，可接受；本轮不新增后台属地查询条件。
- 论坛主题返回口径覆盖：
  - 公共分页 `page`
  - 详情 `detail`
  - 我的主题 `my/page`
  - 收藏主题 `app/favorite/topic/page`（复用 `PublicForumTopicPageItemDto`）
- 评论属地按全站评论能力收口，返回口径覆盖：
  - 我的评论 `my/page`
  - 回复分页 `reply/page`
  - `app/forum/topic/comment/page`
  - `app/work/comment/page`
  - `app/work/chapter/comment/page`

## 完成标准

- 新创建的论坛主题记录写入统一属地字段。
- 新创建的评论与回复记录写入统一属地字段。
- app 端论坛主题现有列表 / 详情接口，以及复用 `PublicForumTopicPageItemDto` 的现有接口返回归属地字段，且 DTO 契约一致。
- app 端全站评论能力相关现有接口返回归属地字段，且 DTO 契约一致。
- 论坛主题收藏分页相关查询投影与组装逻辑已对齐 `PublicForumTopicPageItemDto` 的 `geo*` 字段，避免共享 DTO 扩展后出现漏字段。
- 不新增新的评论 detail 接口，也不改变既有分页语义与排序语义。
- 历史主题 / 评论记录允许保持 `geo*` 空值，不要求回填。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-03` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中的 app 契约影响描述。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 补充论坛主题与评论接口返回证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-03` 为唯一事实源。

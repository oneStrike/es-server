# App Pagination Hard Cutover

## Scope

本次切换覆盖 app 端所有通过 `ApiPageDoc` 暴露的分页接口，并删除旧
`ApiCursorPageDoc` contract。受影响范围包括：

- 内容与作品：分类、标签、作品列表、章节列表、作品评论、章节评论、我的评论、回复列表。
- 互动资产：收藏、关注、点赞、举报、购买、下载、优惠券、钱包流水、阅读历史。
- 论坛：主题列表、热门/关注主题、用户/我的主题、主题评论、hashtag 列表与关联内容、论坛搜索、治理操作日志、治理申请。
- 成长与用户：任务列表、我的任务、签到记录、签到排行榜、积分记录、经验记录、用户徽章、用户提及候选。
- 消息与系统内容：通知、会话列表、站内信时间线、公告。

明确例外：聊天消息历史同步接口仍保留其协议专用的 `cursor` /
`afterSeq` / `limit` 入参。该接口不是普通列表分页，调用方不应把它按
`PageDto` 迁移。

## Impacted Endpoints

- Check-in: `app/check-in/my/page`, `app/check-in/leaderboard/page`
- Comment: `app/comment/my/page`, `app/comment/reply/page`
- Coupon: `app/coupon/my/page`
- Download: `app/download/work/page`, `app/download/chapter/page`
- Favorite: `app/favorite/work/page`, `app/favorite/topic/page`
- Follow: `app/follow/author/page`, `app/follow/section/page`, `app/follow/hashtag/page`, `app/follow/user/following/page`, `app/follow/user/follower/page`
- Forum hashtag: `app/forum/hashtag/hot/page`, `app/forum/hashtag/topic/page`, `app/forum/hashtag/comment/page`
- Forum moderator: `app/forum/moderator-application/my/page`, `app/forum/moderator/action-log/my/page`
- Forum search: `app/forum/search/page`
- Forum topic: `app/forum/topic/page`, `app/forum/topic/hot/page`, `app/forum/topic/following/page`, `app/forum/topic/comment/page`, `app/forum/topic/user/page`, `app/forum/topic/my/page`
- Like: `app/like/my/page`
- Message: `app/message/notification/page`, `app/message/chat/conversation/page`, `app/message/inbox/timeline/page`
- Purchase: `app/purchase/work/page`, `app/purchase/chapter/page`
- Reading history: `app/reading-history/my/page`
- Report: `app/report/my/page`
- System content: `app/system/announcement/page`
- Task: `app/task/page`, `app/task/my/page`
- User growth: `app/user/points/record/page`, `app/user/experience/record/page`, `app/user/badges/page`, `app/user/mention/page`
- Wallet: `app/wallet/ledger/page`
- Work taxonomy/content: `app/work/category/page`, `app/work/chapter/page`, `app/work/chapter/comment/page`, `app/work/tag/page`, `app/work/hot/page`, `app/work/new/page`, `app/work/recommended/page`, `app/work/page`, `app/work/comment/page`

## Change Type

- 破坏性更新。
- 无运行时代码兼容层。
- 删除 `ApiCursorPageDoc`，`ApiPageDoc` 是 app 标准分页文档入口。

`.trae/rules/02-controller.md` 默认要求 breaking change 提供 versioning / compat / 下线计划。本次选择 release-gated hard cutover：服务端不提供旧 cursor 入参、旧响应字段或兼容包装；调用方必须在同一发布窗口切换到新 contract。

## Versioning / Compat / Downline Plan

### Release Gate

- Release status: `blocked-before-release`。
- Missing release inputs:
  - 服务端发布时间窗口，由 product/release owner 在发版前补齐。
  - 最低客户端版本或 build，由 app 客户端 owner 在发版前补齐。
  - Owner sign-off，至少需要服务端 owner、app 客户端 owner、release owner 三方确认。
  - Rollback trigger，必须在发版前明确旧客户端请求比例、分页错误率、关键页面不可用率或回滚窗口。
  - 监控 dashboard 或查询链接，用于发布后巡检旧客户端请求、分页错误率、空页率和关键页面可用性。

上述输入没有补齐并把 release status 更新为 `releasable` 前，本次 hard
cutover 只能进入实现与验证，不得发布到生产。缺失发布治理输入不能通过旧
cursor 入参、旧响应字段、兼容包装、双写双读、shadow DTO 或运行时 shim
替代。

### Compatibility Model

- 不接受旧 `cursor` 作为分页推进参数。
- 不返回旧 `hasMore` / `nextCursor` 字段。
- 不新增旧响应包装、双写双读、shadow DTO 或运行时 shim。
- 兼容性由发布治理保证：客户端先完成版本门禁和调用迁移，再进入服务端 hard cutover 发布窗口。

### Deployment Order

1. 客户端完成全部 affected endpoint 迁移并发布到最低版本门禁。
2. Release owner 确认低版本拦截、灰度比例、监控指标和 rollback trigger。
3. 服务端发布删除 cursor contract 的 hard cutover。
4. 发布后按 Impacted Endpoints 逐项巡检接口错误率、分页空页率和客户端页面可用性。

### Downline Client Checklist

- 删除请求中的 `cursor`。
- 删除对 `hasMore` / `nextCursor` 的读取。
- 下一页改为发送 `pageIndex + 1`。
- 是否还有下一页改为基于 `total`、`pageIndex`、`pageSize` 计算。
- 空列表页必须能处理 `list: []` 且保留 `total/pageIndex/pageSize`。
- 所有 affected endpoint 的调用模型、缓存 key、埋点和错误处理同步更新。

## Request Contract

旧请求：

```ts
{
  cursor?: string
  pageSize?: number
  // domain filters...
}
```

新请求：

```ts
{
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  startDate?: string
  endDate?: string
  // domain filters...
}
```

`pageIndex` 为 1-based 页码。`orderBy`、`startDate`、`endDate` 与 admin
端共享 `PageDto` contract，由各 owner service 按自己的字段 allowlist 与
日期字段显式映射。不再接受 `cursor` 作为这些接口的分页推进参数。

## Response Contract

旧响应：

```ts
{
  list: T[]
  pageSize: number
  hasMore: boolean
  nextCursor: string | null
}
```

新响应：

```ts
{
  list: T[]
  total: number
  pageIndex: number
  pageSize: number
}
```

所有本轮切换接口的运行时实现必须真实执行 offset 分页和总数统计；不得只把 Swagger 从 `ApiCursorPageDoc` 改名为 `ApiPageDoc`。

## Client Migration

- 将后续翻页逻辑从保存 `nextCursor` 改为维护 `pageIndex + 1`。
- 删除对 `hasMore` / `nextCursor` 的读取，改用 `total`、`pageIndex`、`pageSize` 计算是否还有下一页。
- 请求参数中不要继续发送 `cursor`；旧参数不会作为兼容输入处理。

## Owner Spec Checklist

- Check-in: `libs/growth/src/check-in/check-in-contract.service.spec.ts`
- Comment: `libs/interaction/src/comment/comment.service.spec.ts`
- Coupon: `libs/interaction/src/coupon/coupon.service.spec.ts`
- Download: `libs/interaction/src/download/download.service.spec.ts`
- Favorite: `libs/interaction/src/favorite/favorite.service.spec.ts`
- Follow: `libs/interaction/src/follow/follow.service.spec.ts`
- Forum hashtag: `apps/app-api/src/modules/forum/forum-hashtag.controller.spec.ts`, `libs/forum/src/hashtag/forum-hashtag.service.spec.ts`
- Forum moderator: `libs/forum/src/moderator/moderator-application.service.spec.ts`, `libs/forum/src/moderator/moderator-action-log.service.spec.ts`
- Forum search: `libs/forum/src/search/search.service.spec.ts`
- Forum topic/profile: `apps/app-api/src/modules/forum/forum-topic.controller.spec.ts`, `libs/forum/src/topic/forum-topic-query.service.spec.ts`, `libs/forum/src/profile/profile.service.spec.ts`
- Like: `libs/interaction/src/like/like.service.spec.ts`
- Message: `libs/message/src/notification/notification.service.spec.ts`, `libs/message/src/inbox/inbox.service.spec.ts`, `libs/message/src/chat/chat-read-query.service.spec.ts`, `libs/message/src/chat/chat.service.spec.ts`
- Purchase: `libs/interaction/src/purchase/purchase.service.spec.ts`
- Reading history: `libs/interaction/src/reading-state/reading-state.service.spec.ts`
- Report: `libs/interaction/src/report/report.service.spec.ts`
- System content: `libs/app-content/src/announcement/announcement.service.spec.ts`
- Task: `libs/growth/src/task/task-execution.service.spec.ts`
- User mentions: `libs/user/src/user.service.spec.ts`
- User growth: `libs/growth/src/point/point.service.spec.ts`, `libs/growth/src/experience/experience.service.spec.ts`
- Wallet: `libs/interaction/src/wallet/wallet.service.spec.ts`
- Work taxonomy/content: `apps/app-api/src/modules/work/work-catalog.controller.spec.ts`, `libs/content/src/category/category.service.spec.ts`, `libs/content/src/tag/tag.service.spec.ts`, `libs/content/src/work/core/work.service.spec.ts`

## Verification

本次切换的交付验证重点：

- `rg -n "ApiCursorPageDoc" apps libs db` 无业务调用，平台层也不再导出该装饰器。
- app 普通分页 DTO 直接使用完整 `PageDto` 或有业务字段的
  `IntersectionType(..., PageDto, ...)`；不新增空别名，也不使用只裁剪
  `pageIndex/pageSize/orderBy` 的 `PickType(PageDto, ...)`。
- 受影响服务使用 `buildPageParams` 统一归一化 `pageIndex`、`pageSize`、
  `orderBy`、`startDate`、`endDate`，并由 owner service 显式拼接日期字段和
  `toPageResult` 响应形状。
- `pnpm type-check` 通过。
- 相关 owner specs 覆盖 `list/total/pageIndex/pageSize`，并断言不再返回 `hasMore/nextCursor`。
- controller specs 覆盖 comment 与 hashtag app 入口层不会丢弃
  `orderBy/startDate/endDate`。
- `pnpm exec prettier --check docs/breaking-changes/app-pagination-hard-cutover.md` 通过。

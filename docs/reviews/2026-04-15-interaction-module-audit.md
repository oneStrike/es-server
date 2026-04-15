# interaction 模块审查清单（2026-04-15）

## 审查范围

- `libs/interaction/src/**`
- `apps/app-api/src/modules/comment/comment.controller.ts`
- `apps/app-api/src/modules/download/download.controller.ts`
- `apps/app-api/src/modules/emoji/emoji.controller.ts`
- `apps/app-api/src/modules/favorite/favorite.controller.ts`
- `apps/app-api/src/modules/follow/follow.controller.ts`
- `apps/app-api/src/modules/like/like.controller.ts`
- `apps/app-api/src/modules/purchase/purchase.controller.ts`
- `apps/app-api/src/modules/reading-history/reading-history.controller.ts`
- `apps/app-api/src/modules/report/report.controller.ts`
- `apps/admin-api/src/modules/comment/comment.controller.ts`
- `apps/admin-api/src/modules/report/report.controller.ts`
- `apps/admin-api/src/modules/content/emoji/*.controller.ts`
- `db/schema/app/user-comment.ts`
- `db/schema/app/user-download-record.ts`
- `db/schema/app/user-follow.ts`
- `db/schema/app/user-like.ts`
- `db/schema/app/user-purchase-record.ts`
- `db/schema/app/user-report.ts`
- `db/schema/app/user-work-reading-state.ts`
- 与交互模块直接耦合的 resolver 注册点和消费方导入关系（`libs/content/**`、`libs/forum/**`、`libs/message/**` 中的 interaction 依赖）

## 总体结论

`interaction` 模块整体分层是清楚的：Controller 基本保持薄层，核心行为集中在 `libs/interaction`，大部分子模块通过 resolver 模式把业务差异下沉给 owner 模块；`comment`、`follow`、`like`、`favorite` 这些高频交互链路也已经有一定测试基础。

当前主要风险不在代码风格，而在“状态迁移的并发一致性”和“对外契约与读模型口径一致性”。其中有 3 项问题会直接影响线上正确性，建议按“必须修复”处理。

## 发现的问题

### 1. [必须修复] 评论审核/隐藏更新按旧快照补副作用，并发下会重复加减计数和重复发奖励

- 位置：
  - `libs/interaction/src/comment/comment.service.ts:1950-2007`
  - `libs/interaction/src/comment/comment.service.ts:2035-2082`
- 问题：
  - `updateCommentAuditStatus()` 和 `updateCommentHidden()` 都先在事务外读取 `current`，再在事务内按 `id` 直接更新。
  - `syncCommentVisibilityTransition()` 使用的是事务外那份旧快照来判断“是否从不可见变可见”。
  - 更新语句没有把旧状态带进 `where`，也没有基于最新返回行重新计算迁移。
- 影响：
  - 两个管理员并发把同一条待审核评论改成已通过时，两个事务都可能认为发生了“首次可见”，从而重复执行：
    - `applyCommentCountDelta(...)`
    - `resolver.postCommentHook(...)`
    - `commentGrowthService.rewardCommentCreated(...)`
  - 隐藏/取消隐藏并发时同样可能把评论计数和派生字段推偏。
- 建议：
  - 把状态流转改成带旧状态条件的原子更新，例如 `where id=? and audit_status=? and is_hidden=?`。
  - 或者在事务内先锁定当前行，再基于锁内最新值做状态机判断。
  - 奖励和计数副作用必须建立在“本次事务确实完成了唯一一次状态迁移”之上，而不是建立在事务外快照之上。

### 2. [必须修复] 举报裁决链路是“先查再改”，并发裁决会互相覆盖并重复发放成长事件

- 位置：
  - `libs/interaction/src/report/report.service.ts:326-385`
- 问题：
  - `handleReport()` 先读当前状态，再执行 `update ... where id = ?`。
  - 更新条件没有约束原始状态，也没有做版本/状态校验。
  - 事务结束后无条件调用 `reportGrowthService.rewardReportHandled(...)`。
- 影响：
  - 两个后台操作同时处理同一条 `PENDING` 举报时，两个请求都可能通过 `ensureCanHandleReportStatus()`。
  - 最终状态可能被后写请求覆盖，但两个请求都会发出一份“举报已裁决”的成长事件。
  - 这会造成裁决结果不稳定和奖励重复结算。
- 建议：
  - 把状态流转改成原子条件更新，例如只允许 `PENDING/PROCESSING -> RESOLVED/REJECTED` 的单次命中。
  - 只在“本次更新真正命中了 1 行且完成合法迁移”后再发奖励事件。
  - 补一条并发裁决或重复裁决回归测试。

### 3. [必须修复] 删除根评论只删除当前节点，不处理回复树，公开读链路会留下孤儿回复和错误计数

- 位置：
  - `libs/interaction/src/comment/comment.service.ts:1331-1416`
  - `libs/interaction/src/comment/comment.service.ts:1544-1644`
- 问题：
  - `deleteComment()` 只把当前评论打上 `deletedAt`，并只对当前评论执行一次 `applyCommentCountDelta(..., -1)`。
  - 该方法不会级联软删除 `actualReplyToId = 当前根评论` 的回复，也不会回收这些回复对应的目标评论计数。
  - 公开读链路 `getTargetComments()` 只从可见根评论出发加载回复预览；根评论删掉后，这些回复在目标页上不再可达。
- 影响：
  - 数据库里仍然保留“可见回复”，但前台目标评论列表已经无法从根评论入口访问到它们，形成孤儿回复。
  - 目标对象上的 `commentCount` 只减 1，不会同步扣减这批失联回复，对外计数会偏大。
- 建议：
  - 明确根评论删除语义：
    - 要么级联软删除整棵回复树，并同步回退整棵树的可见计数与副作用；
    - 要么保留根评论壳并标记删除，让回复树仍然有公开入口。
  - 无论采用哪种语义，都需要补删除根评论场景的行为测试。

### 4. [建议修改] 下载历史查询没有过滤已删除作品/章节，读模型口径与购买历史不一致

- 位置：
  - `libs/interaction/src/download/download.service.ts:198-225`
  - `libs/interaction/src/download/download.service.ts:278-315`
  - 对照：`libs/interaction/src/purchase/purchase.service.ts:301-305`
  - 对照：`libs/interaction/src/purchase/purchase.service.ts:407-409`
- 问题：
  - 下载历史的两条原生 SQL 都只按 `user_id`、`target_type`、`work_id` 和日期过滤，没有像购买历史那样补 `wc.deleted_at IS NULL`、`w.deleted_at IS NULL`。
- 影响：
  - 已被软删除的作品或章节仍可能继续出现在“已下载作品/章节”列表里。
  - 同一交互域内，购买历史隐藏已删内容、下载历史却继续暴露，读模型口径不一致。
- 建议：
  - 如果产品语义是“历史列表只展示当前仍可访问内容”，这里应和购买历史保持一致，补齐删除过滤。
  - 如果产品语义是“保留历史快照”，则需要显式补 tombstone 字段或快照字段，而不是继续直接 join 在线主表。

### 5. [建议修改] 已购列表 DTO 暴露了 `targetType` 过滤条件，但 service 完全没有消费这个参数

- 位置：
  - `libs/interaction/src/purchase/dto/purchase.dto.ts:81-114`
  - `libs/interaction/src/purchase/purchase.service.ts:270-351`
  - `libs/interaction/src/purchase/purchase.service.ts:357-487`
- 问题：
  - `QueryPurchasedWorkDto` / `QueryPurchasedWorkChapterDto` 继承了 `targetType` 字段。
  - 但 `getPurchasedWorks()` / `getPurchasedWorkChapters()` 解构查询参数时完全没有使用 `targetType`，SQL 仍固定写成 `IN (${PURCHASE_WORK_CHAPTER_TARGET_TYPES_SQL})`。
- 影响：
  - 客户端即使传了 `targetType`，结果也不会被过滤，属于静默失效参数。
  - 这会让 Swagger、SDK 类型和真实行为产生偏差，排查起来很隐蔽。
- 建议：
  - 二选一：
    - 删除 DTO 中无效的 `targetType` 查询字段；
    - 或在 SQL 层真实消费该参数，并补对应测试。

### 6. [建议修改] app 侧“删除评论”接口文档声明返回 `Boolean`，实际返回 `{ id }`

- 位置：
  - `apps/app-api/src/modules/comment/comment.controller.ts:63-69`
  - `libs/interaction/src/comment/comment.service.ts:1385-1416`
- 问题：
  - Controller 的 Swagger 模型写的是 `Boolean`。
  - Service 实际返回的是 `{ id: found.id }`。
- 影响：
  - 生成客户端、接口测试和文档使用者都会以为这是一个布尔接口。
  - 真实返回值与契约不一致，属于典型接口文档漂移。
- 建议：
  - 要么把文档模型改成 `IdDto`；
  - 要么服务端直接返回 `true`，与当前文档对齐。

## 测试与覆盖面结论

### 已执行验证

- `pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/comment/comment-growth.service.spec.ts libs/interaction/src/comment/resolver/comment-like.resolver.spec.ts libs/interaction/src/follow/resolver/user-follow.resolver.spec.ts libs/interaction/src/mention/mention.service.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts`
- 结果：`6` 个 suite、`22` 个测试全部通过

### 现有测试覆盖到的内容

- 评论回复展示、预览和回复目标裁剪
- 评论可见性补偿的部分路径
- 评论点赞 resolver 的基础行为
- mention 规范化与通知发送基础路径
- 用户关注 resolver 的基础规则
- comment DTO 的部分契约约束

### 当前缺失的关键测试

- `CommentService.deleteComment()` 的根评论删除/回复树处理测试
- `CommentService.updateCommentAuditStatus()` / `updateCommentHidden()` 的并发状态迁移测试
- `ReportService.handleReport()` 的重复裁决/并发裁决测试
- `DownloadService` 的已删作品/章节过滤测试
- `PurchaseService` 查询参数 `targetType` 的契约测试
- `browse-log`、`download`、`emoji`、`favorite`、`like`、`purchase`、`reading-state`、`report`、`user-assets` 主 service 当前都没有对应 `*.spec.ts`

## 建议整改顺序

1. 先修复评论审核/隐藏与举报裁决的并发状态迁移问题。
2. 再明确根评论删除语义，并补齐回复树/计数联动。
3. 统一下载历史与购买历史的读模型口径。
4. 清理购买查询里的无效 `targetType` 参数和评论删除接口的 Swagger 漂移。
5. 最后补 interaction 其余子模块的基础 service 级测试，至少把下载、购买、举报、阅读状态补齐。

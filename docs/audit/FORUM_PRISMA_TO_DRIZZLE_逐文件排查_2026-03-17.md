# forum 模块 Prisma → Drizzle 逐文件排查报告（2026-03-17）

## 1. 审查目标

- 基于以下两份既有迁移文档提炼 forum 迁移要点，并对 `libs/forum/src` 做逐文件排查：
  - `docs/audit/INTERACTION_GROWTH_Drizzle逐文件审查_2026-03-17.md`
  - `docs/migration/INTERACTION_GROWTH_PRISMA_TO_DRIZZLE_EXEC_PLAN.md`
- 目标是为“快速开发阶段一次性切换”提供可直接执行的改造输入：
  - 彻底移除 Prisma 入口与 Prisma 类型透出；
  - 全面收敛到 `DrizzleService` 与 `db/core` 扩展能力；
  - 同时标注不合理业务逻辑与高风险实现点。

## 2. 迁移基线（从参考文档提炼）

### 2.1 强制性迁移原则

1. 不做双驱动并存：forum 目标态不应再出现 `this.prisma`、`PlatformService` 作为数据库入口。
2. 统一读写入口：`this.drizzle.db` + `this.drizzle.schema`。
3. 写操作语义统一：`withErrorHandling` + `assertAffectedRows`。
4. 列表查询统一：`ext.findPagination` + `buildWhere`。
5. 事务类型统一：禁止 `tx: any`、禁止 Prisma 事务类型外露，使用 Drizzle 事务类型抽象。
6. 快速开发阶段允许直接重构：无需兼容旧 API/旧 helper 形态。

### 2.2 forum 现状量化快照

- `libs/forum/src` 共 `69` 个 TS 文件。
- 仍包含 `this.prisma` 的文件：`16` 个（`79` 处出现）。
- 仍 `extends PlatformService` 的文件：`18` 个。
- 使用 `DrizzleService` 的文件：仅 `1` 个（`forum-topic-browse-log.resolver.ts`）。
- 含 `$transaction` 的文件：`5` 个（仍是 Prisma 事务风格）。

## 3. 覆盖范围与分组

### 3.1 直接涉及数据访问/事务的核心文件（23 个）

- action-log: `action-log.service.ts`
- config: `forum-config.service.ts`, `forum-config-cache.service.ts`
- counter: `forum-counter.service.ts`
- moderator: `moderator.service.ts`
- notification: `notification.service.ts`
- profile: `profile.service.ts`
- reply: `forum-reply.service.ts`
- reply-like: `forum-reply-like.service.ts`
- search: `search.service.ts`
- section: `forum-section.service.ts`, `section-permission.service.ts`
- section-group: `forum-section-group.service.ts`
- tag: `forum-tag.service.ts`
- topic: `forum-topic.service.ts`
- topic resolver: `forum-topic-browse-log.resolver.ts`, `forum-topic-comment.resolver.ts`, `forum-topic-favorite.resolver.ts`, `forum-topic-like.resolver.ts`, `forum-topic-report.resolver.ts`
- 装配联动：`forum.module.ts`, `topic/forum-topic.module.ts`, `reply/forum-reply.module.ts`, `reply-like/forum-reply-like.module.ts`

### 3.2 非数据库逻辑文件（46 个）

- 其余 DTO / constant / module / index / types 文件未直接触发 ORM 调用。
- 审查结论：无需先改业务逻辑，但需要在迁移后做类型与导出收口（避免 Prisma 相关类型残留透出）。

## 4. 逐文件审查结论（核心文件）

| 文件 | 当前状态 | Prisma 残留 | Drizzle 规范符合度 | 不合理逻辑/风险点 | 优先级 |
|---|---|---|---|---|---|
| action-log.service.ts | 纯 Prisma 扩展调用 | 高 | D | 依赖 `this.prisma`；分页走 Prisma 扩展而非 `drizzle.ext.findPagination` | P1 |
| config/forum-config.service.ts | 配置主链路全 Prisma | 高 | D | 多写操作未统一 `withErrorHandling/assertAffectedRows`；`changes: any` 类型降级；多处读后写未做事务封装 | P0 |
| config/forum-config-cache.service.ts | 缓存回源走 Prisma | 高 | D | 仍继承 `PlatformService`；默认配置创建写操作未走 Drizzle 错误语义 | P1 |
| counter/forum-counter.service.ts | 计数中台全 Prisma | 高 | D | 大量 `tx: any`；增减计数全手写；缺失 `assertAffectedRows`；迁移后应优先改为 `ext.applyCountDelta` 风格 | P0 |
| moderator/moderator.service.ts | 版主管理全 Prisma | 高 | D | `moderatorData as any`；事务内批量 upsert 可优化；异常语义依赖手工校验 | P1 |
| notification/notification.service.ts | 通知读写全 Prisma | 高 | D | 重复查询（未读数接口重复）；批量更新/删除未统一受影响断言 | P1 |
| profile/profile.service.ts | 用户画像聚合 Prisma | 高 | D | 使用 `PrismaClientType`；多处 `throw new Error` 非业务异常；收藏详情存在二次查询拼装 | P1 |
| reply/forum-reply.service.ts | 历史论坛回复服务（基于 `userComment`） | 高 | D- | 与 `@libs/interaction` 的 `CommentService` 职责重叠；仓库内未检索到业务调用方；大量 `(this.prisma as any)/(tx as any)` | P0 |
| reply-like/forum-reply-like.service.ts | 历史论坛回复点赞服务（基于 `userLike`） | 高 | D | 与 `@libs/interaction` 的评论点赞能力重叠；仓库内未检索到业务调用方；仍是 Prisma 事务写法 | P0 |
| search/search.service.ts | 搜索链路 Prisma 类型 where | 高 | D | 仍使用 Prisma `WhereInput`；默认 `pageIndex=0` 与 1-based 规范不一致 | P1 |
| section/forum-section.service.ts | 板块管理 Prisma | 高 | D- | `createSection` 重复名校验条件反向（存在明显逻辑错误）；`updateSectionSort` 交换字段疑似错误使用 `groupId`；`updatePayload:any` | P0 |
| section/section-permission.service.ts | 权限管理 Prisma | 高 | D | upsert/delete 直接调用，无统一错误语义；迁移可直接改 Drizzle + exists | P2 |
| section-group/forum-section-group.service.ts | 板块分组 Prisma | 高 | D | `handlePrismaError` 绑定 Prisma 错误码；`deleteSectionGroup` 抛原生 `Error`；删除语义与软删策略不一致 | P1 |
| tag/forum-tag.service.ts | 标签主链路 Prisma | 高 | D | `where:any` 类型降级；标签绑定/解绑事务可改 Drizzle returning 断言；存在重复 existence 查询 | P1 |
| topic/forum-topic.service.ts | 主题主链路 Prisma | 高 | D | 核心创建/更新/删除均 Prisma；`updatePayload:any`；多写操作缺失统一受影响断言；敏感词与审核分支可继续收敛 | P0 |
| topic/resolver/forum-topic-browse-log.resolver.ts | 已接入 DrizzleService | 低 | B | `update` 后未做受影响断言；可统一 `ext.applyCountDelta` 或 `returning` 断言 | P2 |
| topic/resolver/forum-topic-comment.resolver.ts | 混合态（Drizzle + PlatformService） | 中 | C | 仍继承 `PlatformService`；`update + findFirst` 二次查询可合并为 `returning` | P1 |
| topic/resolver/forum-topic-favorite.resolver.ts | 混合态 | 中 | C | 仍继承 `PlatformService` 且 `batchGetDetails` 仍用 `this.prisma`; `update + findFirst` 可合并 | P1 |
| topic/resolver/forum-topic-like.resolver.ts | 混合态 | 中 | C | 同上；通知类型命名沿用 COMMENT_LIKE 语义可读性一般；二次查询可合并 | P1 |
| topic/resolver/forum-topic-report.resolver.ts | Drizzle tx 查询风格 | 低 | B+ | 结构基本正确；建议统一到 `DrizzleService` 注入模式，与其他 resolver 一致 | P3 |
| forum.module.ts | 模块聚合层 | 无直接 | B | 需要在服务迁移后复核导入耦合，剔除遗留 Prisma 依赖链 | P2 |
| topic/forum-topic.module.ts | 模块装配层 | 无直接 | B | resolver 混合态下依赖关系复杂，迁移后应简化注入边界 | P2 |
| reply/forum-reply.module.ts | 模块装配层 | 无直接 | B | 依赖健康；待服务切 Drizzle 后复核 provider | P3 |
| reply-like/forum-reply-like.module.ts | 模块装配层 | 无直接 | B | 同上 | P3 |

## 5. 不合理业务逻辑专项（需优先确认）

### 5.1 明确可判定的高风险问题

1. `section/forum-section.service.ts`
   - `createSection` 中“板块名称已存在”校验条件反向，当前写法会在“名称不存在”时抛错。
   - `updateSectionSort` 使用 `sourceField: 'groupId'`，与“排序”语义不匹配，疑似应为 `sortOrder`。

2. `reply/forum-reply.service.ts`
   - 删除回复时对子回复作者计数逐条回收，存在 N+1 更新，数据量上升会明显放大事务耗时。
   - 审核状态直接写数字常量（0/2），与枚举驱动风格不一致，后续维护易出错。

3. `search/search.service.ts`
   - 分页默认 `pageIndex=0`，与迁移基线中“1-based 语义统一”冲突。

4. `section-group/forum-section-group.service.ts`、`profile/profile.service.ts`
   - 仍存在原生 `Error` 抛出，异常语义不统一，不利于接口稳定输出。

5. `reply/forum-reply.service.ts`、`reply-like/forum-reply-like.service.ts`
   - 已切到统一底表（`user_comment` / `user_like`），但仍保留 forum 私有服务实现。
   - 与 interaction 通用评论/点赞能力形成“双实现并存”，在快速开发阶段应避免继续维护两套路径。

### 5.2 回复/回复点赞是否可从 forum 迁移项去除（专项结论）

结论：**可以从“forum 的 Drizzle 逐文件迁移任务”中去除“按原样迁移”做法，但不能直接忽略该域逻辑；应改为“能力收口/退场”任务。**

判定依据：

1. 数据归属已统一
   - 回复数据已统一在 `prisma/models/app/user-comment.prisma`（`UserComment`）；
   - 回复点赞数据已统一在 `prisma/models/app/user-like.prisma`（`UserLike`）。

2. 能力层已有通用实现
   - `@libs/interaction` 已有 `CommentService`（评论/回复链路，Drizzle）；
   - `@libs/interaction` 已有 `LikeService + comment-like.resolver`（评论点赞链路，Drizzle）。

3. forum 历史服务在仓库内无显式调用方
   - 未检索到 `ForumReplyService` / `ForumReplyLikeService` 被 controller 或其他业务服务直接调用（仅模块自身 provider/export 与 `ForumModule` 聚合导入）。

执行建议（快速开发模式）：

- 不再把 `reply/forum-reply.service.ts`、`reply-like/forum-reply-like.service.ts` 作为“Prisma→Drizzle 等价改写”任务；
- 改为“能力收口”：
  - 统一走 `CommentService` / `LikeService`；
  - 下线或删除 forum 历史 reply/reply-like 服务与模块导出；
  - 清理 `ForumModule` 的相关 imports/exports，避免遗留 provider 常驻。

## 6. forum 迁移改造要点（按参考文档对齐）

### 6.1 架构与类型收敛

- 全量移除 `extends PlatformService` 与 `this.prisma`。
- 统一注入 `DrizzleService`，服务内以 `db`/`schema` 访问。
- 删除 Prisma 类型透出：`PrismaClientType`、`ForumTopicWhereInput`、`UserCommentWhereInput` 等依赖改为 Drizzle 条件构建（`SQL[] + and(...)` / `buildWhere`）。
- 事务参数统一为 Drizzle tx 类型，不允许 `tx: any`。

### 6.2 查询与写入规范收敛

- 列表查询统一 `drizzle.ext.findPagination`。
- 写操作统一 `drizzle.withErrorHandling` 包裹，更新/删除统一 `assertAffectedRows`。
- 存在性判断优先 `ext.exists/existsActive`，减少“先查再判”模板。
- 计数增减统一 `ext.applyCountDelta` 或 `update ... returning`，避免“update + 再查一次”。

### 6.3 快速开发阶段策略

- 不保留 Prisma 兼容层，不做双实现。
- 允许直接改签名、改内部 helper、改模块注入结构。
- 以“最终一致的 Drizzle 形态”为唯一目标态。

## 7. 可执行迁移任务清单（forum 专项）

| 序号 | 文件/范围 | 改造内容 | 预计工时 | 风险 | 完成状态 |
|---|---|---|---|---|---|
| F1 | `libs/forum/src/counter/forum-counter.service.ts` | 先改计数中台：统一 tx 类型 + applyCountDelta + affectedRows 断言 | 3h | H | 已完成 |
| F2 | `libs/forum/src/topic/forum-topic.service.ts` | 主题主链路迁移 Drizzle（创建/更新/删除/状态更新） | 8h | H | 已完成 |
| F3 | `libs/forum/src/reply/*` | 回复域能力收口：统一切到 `CommentService`，下线 forum 历史 reply 服务 | 4h | H | 已完成 |
| F4 | `libs/forum/src/reply-like/*` | 回复点赞能力收口：统一切到 `LikeService(comment)`，下线历史服务 | 2h | M | 已完成 |
| F5 | `libs/forum/src/section/*.service.ts` | 板块与权限迁移；修复 createSection / 排序字段问题 | 5h | H | 已完成 |
| F6 | `libs/forum/src/section-group/forum-section-group.service.ts` | 分组服务迁移，统一软删与异常语义 | 3h | M | 已完成 |
| F7 | `libs/forum/src/tag/forum-tag.service.ts` | 标签链路迁移，收敛事务与去重查询 | 4h | M | 已完成 |
| F8 | `libs/forum/src/profile/profile.service.ts` | 移除 Prisma 类型依赖，统一异常类型与分页构建 | 4h | M | 已完成 |
| F9 | `libs/forum/src/notification/notification.service.ts` | 通知读写迁移，合并重复未读统计 | 3h | M | 已完成 |
| F10 | `libs/forum/src/config/*.service.ts` | 配置与缓存回源迁移 Drizzle | 5h | M | 已完成 |
| F11 | `libs/forum/src/search/search.service.ts` | 搜索查询迁移 + pageIndex 1-based 统一 | 3h | M | 已完成 |
| F12 | `libs/forum/src/topic/resolver/*.resolver.ts` | resolver 全量去 PlatformService，统一 Drizzle 注入风格 | 4h | M | 已完成 |
| F13 | `libs/forum/src/action-log/action-log.service.ts` | 行为日志迁移 Drizzle 风格分页与写入 | 2h | L | 已完成 |
| F14 | `libs/forum/src/*/*.module.ts` + `forum.module.ts` | provider/import 收口，剔除遗留链路 | 2h | L | 已完成 |
| F15 | 仓库级验证 | lint + typecheck 全量校验并修复 | 2h | M | 已完成 |

> 预计总工时：约 54h（快速开发模式，单人）

## 8. 验收标准（forum 专项）

- `libs/forum/src` 内不再出现：
  - `this.prisma`
  - `extends PlatformService`（数据库服务）
  - `PrismaClientType` / Prisma `WhereInput` / `tx: any`
- 关键链路（topic/section/counter）写操作全部具备统一错误语义与受影响行断言。
- 回复与回复点赞链路完成能力收口：forum 不再保留私有 reply/reply-like 服务实现。
- 分页语义统一为 1-based。
- 已识别不合理逻辑完成修复：
  - `createSection` 名称校验；
  - 板块排序字段；
  - 原生 `Error` 抛出收敛。
- lint/typecheck 通过。

## 9. 非数据库文件巡检结论（46 个）

- DTO、常量、module、index、types 文件当前不直接阻塞 ORM 迁移。
- 但迁移完成后建议统一做一次“导出与类型清理”，避免通过 re-export 间接保留 Prisma 类型。
- 建议在 F14 阶段一次性收口，不单独拆分。

## 10. 结论

- forum 主链路服务已完成 Drizzle 迁移，`libs/forum/src` 内已清理 `LegacyPlatformService / this.prisma / WhereInput / tx:any` 等遗留写法。
- 历史 reply/reply-like/notification/section-permission 已完成下线，topic/section/search/tag/profile/moderator/section-group/config/action-log/counter 已完成迁移收口。
- 当前建议将迁移重心转为跨模块一致性治理（例如 app-api/admin-api 中仍使用 Prisma 的业务服务），并沿用本报告验收标准持续推进。

## 11. 下一步（2026-03-17 续）

- 已补齐 `topic/resolver` 写操作断言语义：`comment/like/favorite` 统一使用 `drizzle.assertAffectedRows`。
- 已完成 `counter/forum-counter.service.ts` 到纯 Drizzle 事务路径迁移，已移除旧事务兼容分支。
- 已完成 `topic/forum-topic.service.ts` 创建/更新/删除/状态更新/计数更新到 Drizzle 实现，并移除 `LegacyPlatformService` 继承。
- 已完成 `search/search.service.ts` 与 `section-group/forum-section-group.service.ts` 迁移到 Drizzle 实现。
- 已完成 `section/forum-section.service.ts` 与 `moderator/moderator.service.ts` 迁移到 Drizzle 实现。
- 已完成 `tag/forum-tag.service.ts` 与 `profile/profile.service.ts` 迁移到 Drizzle 实现。
- 已完成 `app-api/auth.service.ts` 注册流程切换到 Drizzle 事务，`profile.initForumProfile` 已移除 Prisma 事务兼容分支。
- 已完成 `app-api/auth.service.ts` 的 `appUser` 查询/登录/登录态更新时间迁移，已移除 `PlatformService` 继承与 `this.prisma` 访问。
- 已完成 `app-api/sms.service.ts` 与 `app-api/password.service.ts` 的 `appUser` 读写迁移到 Drizzle 实现。
- 已完成仓库校验：`lint + type-check` 通过。

## 12. 未完成任务清单（跨模块）

- `app-api`
  - `apps/app-api/src/modules/user/user.service.ts`：用户中心主服务仍使用 Prisma；
  - `apps/app-api/src/modules/auth/token-storage.service.ts`：仍使用 Prisma Delegate（`BaseTokenStorageService` 适配）。
- `admin-api`
  - `apps/admin-api/src/modules/auth/auth.service.ts`：管理端认证主服务仍使用 Prisma；
  - `apps/admin-api/src/modules/user/user.service.ts`：管理员用户主服务仍使用 Prisma；
  - `apps/admin-api/src/modules/app-user/app-user.service.ts`：APP 用户管理主服务仍使用 Prisma；
  - `apps/admin-api/src/modules/system/audit/audit.service.ts`：审计服务仍使用 Prisma；
  - `apps/admin-api/src/modules/message/message-monitor.service.ts`：消息监控服务仍使用 Prisma；
  - `apps/admin-api/src/modules/auth/token-storage.service.ts`：仍使用 Prisma Delegate（`BaseTokenStorageService` 适配）。
- 建议优先级
  - P0：`admin-api/auth.service.ts`、`admin-api/user.service.ts`、`app-api/user.service.ts`
  - P1：`admin-api/app-user.service.ts`
  - P2：`audit/message-monitor/token-storage` 三类适配层收敛

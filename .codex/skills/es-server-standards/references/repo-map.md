# Repo Map

## Entry Apps

- `apps/admin-api`: 管理端 Fastify 应用入口。
- `apps/app-api`: 用户端 Fastify 应用入口，包含 WebSocket 适配。

## Shared Layers

- `libs/platform`: 基础装饰器、DTO、bootstrap、配置、鉴权与通用工具。
- `libs/content`: 漫画、小说、作者、分类、标签、章节等内容域能力。
- `libs/app-content`: 公告、协议、页面等 APP 内容能力。
- `libs/config`: 系统配置、字典等配置域能力。
- `libs/forum`: 论坛主题、板块、标签、版主、搜索等能力。
- `libs/growth`: 任务、积分、经验、等级、徽章、台账等能力。
- `libs/identity`: 认证、令牌存储等身份能力。
- `libs/interaction`: 评论、点赞、收藏、举报、阅读状态、购买等互动能力。
- `libs/message`: 通知、聊天、出站事件、WebSocket 监控等能力。
- `libs/user`: 用户计数等跨域用户能力。
- `libs/moderation`: 敏感词等治理能力。

## Database

- `db/schema`: Drizzle 表定义与邻近推导类型的主位置。
- `db/core`: `DrizzleService`、provider、错误处理、事务与 where builder。
- `db/extensions`: 分页、存在性校验、软删、排序、计数增减等扩展。

## Common Abstractions

- Swagger 与上下文装饰器：`libs/platform/src/decorators`
- 基础 DTO：`libs/platform/src/dto`
- Drizzle 入口：`db/core/drizzle.service.ts`
- 分页实现：`db/extensions/findPagination.ts`
- Schema 汇总出口：`db/schema/index.ts`

## Validation Commands

- 全量类型检查：`pnpm type-check`
- 根 tsconfig：`pnpm exec tsc -p tsconfig.json --noEmit`
- admin-api：`pnpm exec tsc -p apps/admin-api/tsconfig.app.json --noEmit`
- app-api：`pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit`

## Useful Searches

- controller 入口：`rg -n "@Controller\\(" apps`
- Swagger 用法：`rg -n "ApiDoc|ApiPageDoc|@ApiTags" apps libs`
- DTO 基类：`rg -n "class Base.*Dto|PickType|OmitType|PartialType|IntersectionType" apps libs`
- Drizzle 典型用法：`rg -n "withErrorHandling|assertAffectedRows|findPagination|buildWhere" apps libs`

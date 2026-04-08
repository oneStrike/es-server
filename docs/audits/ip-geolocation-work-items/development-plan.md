# IP 属地接入开发补充

## 开工条件

- `ip2region.js` 依赖已确认可接入当前工作区。
- `ip2region` 开源版离线数据文件的仓库存放位置已确认。
- 属地字段命名和返回口径以 [README.md](./README.md) 为准，不再派生第二套命名。
- 数据库迁移通过 `pnpm db:generate` 生成；若存在交互式确认，由用户亲自执行。
- 涉及 schema 字段注释变更时，同步更新 `db/comments/generated.sql`，并通过 `pnpm db:comments:check` 校验。

## 影响模块

### Schema

- `db/schema/forum/forum-topic.ts`
- `db/schema/app/user-comment.ts`
- `db/schema/app/app-user-token.ts`
- `db/schema/admin/admin-user-token.ts`
- `db/schema/system/request-log.ts`
- `db/schema/forum/forum-user-action-log.ts`

### 平台能力

- `libs/platform/src/modules/geo/*`
- `libs/platform/src/utils/requestParse.ts`
- `libs/platform/src/utils/request-parse.types.ts`
- 视实现方式可能波及 `libs/platform/src/utils/index.ts`
- `libs/platform/src/config/validation.config.ts`

### 登录态与审计

- `apps/app-api/src/modules/auth/*`
- `apps/admin-api/src/modules/auth/*`
- `libs/identity/src/session.service.ts`
- `libs/identity/src/token/drizzle-token-storage.base.ts`
- `libs/platform/src/modules/auth/token-storage.types.ts`
- `apps/admin-api/src/modules/system/audit/audit.service.ts`
- `libs/platform/src/modules/audit/dto/audit.dto.ts`

### 社区内容与 app 契约

- `apps/app-api/src/modules/forum/forum-topic.controller.ts`
- `apps/app-api/src/modules/comment/comment.controller.ts`
- `apps/app-api/src/modules/favorite/favorite.controller.ts`
- `apps/app-api/src/modules/work/work.controller.ts`
- `apps/app-api/src/modules/work/work-chapter.controller.ts`
- `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- `libs/forum/src/topic/*`
- `libs/forum/src/profile/profile.service.ts`
- `libs/interaction/src/comment/*`
- `libs/interaction/src/favorite/dto/favorite.dto.ts`

### 论坛操作日志

- `apps/app-api/src/modules/forum/forum-topic.controller.ts`
- `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- `libs/forum/src/action-log/*`
- `libs/forum/src/topic/forum-topic.service.ts`
- `libs/forum/src/topic/forum-topic.type.ts`

### 管理端 xdb 管理与热切换

- `apps/admin-api/src/modules/system/ip2region/*`
- `apps/admin-api/src/modules/admin.module.ts`
- `.env.example`

## 统一实现约束

- 原始 `FastifyRequest` 只允许停留在 controller、interceptor、filter 这类 HTTP 边界。
- 业务 service 和 `libs/*` 领域层不直接依赖 `FastifyRequest`，统一接收已解析的客户端上下文。
- `geoSource` 在所有写入链路固定为 `ip2region`，不引入大小写别名或可选来源枚举。
- 本轮只保证新写入链路落库属地，不兼容历史数据。
- 不做历史数据回填，不在读路径按现存 IP 反查补算属地；旧记录缺少 `geo*` 字段时按空值处理。
- app 端接口只返回当前确认需要的属地字段，不顺带开放后台筛选能力。
- 后台若因现有查询实现或共享 DTO 复用而被动返回只读属地字段，不视为范围扩散；但不新增属地筛选、排序和统计。
- 管理端 `xdb` 上传能力只服务接收上传请求的当前进程热切换，不在本轮处理跨 API 进程或跨实例同步。

## 接口契约影响

### 论坛主题

- app 端现有列表接口、详情接口，以及复用 `PublicForumTopicPageItemDto` 的现有接口需要补充属地字段返回：
  - `page`
  - `detail`
  - `my/page`
  - `app/favorite/topic/page`

### 评论

- 评论属地按全站评论能力收口，所有复用评论返回 DTO 的 app 端现有接口都需要补充属地字段返回：
  - `my/page`
  - `reply/page`
  - `app/forum/topic/comment/page`
  - `app/work/comment/page`
  - `app/work/chapter/comment/page`
- 当前仓库未发现独立的 app 端评论 detail 路由，本轮不新增该接口。

### 后台

- 审计日志与论坛操作日志本轮只补写入，不新增属地查询条件。

## 测试与验证重点

- `pnpm type-check`
- `pnpm db:comments:check`
- 变更文件的 `eslint`
- admin 端 `ip2region` 上传接口与状态接口返回检查
- 合法 / 非法 `xdb` 上传后的热切换与失败回退检查
- 服务重启后 `active` 目录加载行为检查
- app 端论坛主题列表 / 详情 / 我的主题接口返回字段检查
- app 端收藏主题分页返回字段检查
- app 端评论我的列表 / 回复列表 / 论坛主题评论列表返回字段检查
- app 端作品评论 / 章节评论列表返回字段检查
- 登录态 token 落库样例检查
- 请求审计日志、论坛操作日志落库样例检查
- ForumTopic 公开列表 / 详情 / 我的主题组装测试需要补齐 `geo*` 字段断言。
- ForumTopic 收藏主题分页组装测试需要补齐 `geo*` 字段断言，避免共享 DTO 已扩展但收藏查询投影漏补。
- Comment 列表 / 回复 / 目标评论测试需要补齐 `geo*` 字段断言，并覆盖论坛、作品、章节等复用入口。
- auth session / token storage 写入测试需要补齐 `geo*` 字段断言。
- 审计日志 / 论坛操作日志写入测试需要补齐 `geo*` 字段断言。
- 若现有 spec 无覆盖，至少新增 service 层自动化测试，避免只依赖手工验收。

## 风险提示

- `P0-03` 与 `P1-01` 都会改 `libs/forum/src/topic/forum-topic.service.ts`，需避免并行写冲突。
- 论坛主题属地字段会通过 `PublicForumTopicPageItemDto` 复用到收藏主题分页，容易出现主题公共分页已补字段、收藏分页查询投影仍漏补的契约漂移。
- 评论属地按全站评论能力收口，会波及论坛、作品、章节等多个 app 端评论入口，容易出现“schema 已加字段但接口漏返回”的契约漂移。
- 若在 `P0-01` 阶段提前固化运行时 `xdb` 存储布局，`P1-02` 的 `tmp / versions / active` 设计会产生 owner 冲突；当前应仅由 `P0-01` 负责默认加载入口。
- 若 `admin-api` 与 `app-api` 以独立进程运行，管理端上传后的“立即生效”默认只覆盖当前进程，需要在交付说明中明确这一部署边界。

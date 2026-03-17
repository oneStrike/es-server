# libs/content Prisma → Drizzle 全量迁移报告（逐文件）

## 1. 目标与范围

- 目标：将 `libs/content` 内部直接依赖 Prisma / PlatformService 的实现切换为 DrizzleService + Drizzle 扩展。
- 范围：业务服务、交互 resolver、相关 admin-api controller 的调用适配，以及权限与分页查询路径。
- 迁移完成判定：
  - `libs/content/src` 下不再存在 `extends PlatformService`；
  - `libs/content/src` 下不再存在 `this.prisma`；
  - 全局 `pnpm type-check` 通过；
  - 全局 `pnpm lint` 通过。

## 2. 审计规范来源（docs/audit 梳理结果）

基于以下文档提炼迁移规范并执行：

- `FORUM_PRISMA_TO_DRIZZLE_逐文件排查_2026-03-17.md`
- `INTERACTION_GROWTH_Drizzle逐文件审查_2026-03-17.md`
- `INTERACTION_GROWTH_全量模块审查报告_2026-03-17.md`
- `RESOLVER_优化优先级清单_2026-03-17.md`

提炼后的统一规范：

1. **服务层统一注入**
   - 用 `DrizzleService` 替换 `PlatformService` 继承。
   - 通过 `drizzle.db`、`drizzle.schema`、`drizzle.ext` 访问数据库、表与扩展能力。

2. **查询与写入模式统一**
   - 读取：`db.query.xxx.findFirst/findMany` + `columns/with/where/orderBy`。
   - 写入：`db.insert/update/delete` + `returning()`。
   - 事务：`db.transaction(async (tx) => {})`。

3. **常用扩展替换**
   - `findPagination` → `drizzle.ext.findPagination(table, options)`。
   - `exists` → `drizzle.ext.exists(table, condition)`。
   - `maxOrder` → `drizzle.ext.maxOrder(table)`。
   - `swapField` → `drizzle.ext.swapField(table, options)`。

4. **错误处理与断言**
   - 统一使用 `drizzle.withErrorHandling` 处理唯一键冲突；
   - 使用 `drizzle.assertAffectedRows` 处理“未命中更新/删除”。

5. **权限与 resolver 规范**
   - resolver 不再继承 `PlatformService`；
   - resolver 内批量详情查询统一走 `db.query`；
   - 权限校验统一由 `ContentPermissionService` 承担。

6. **迁移风险控制**
   - 对 Prisma 复杂 `select/include` 场景，拆为 Drizzle `columns/with` 或“分页后补充关联”；
   - 对数组字段过滤（如 `hasSome/hasEvery`），改为 PostgreSQL 数组操作符 SQL 条件。

## 3. 逐文件迁移清单

### 3.1 libs/content 服务与权限

- `libs/content/src/author/author.service.ts`
  - 完成：`PlatformService` → `DrizzleService`。
  - 完成：create/page/detail/update/delete 全部改为 Drizzle 查询/写入。
  - 完成：新增 `updateAuthorStatus`、`updateAuthorRecommended` 供控制器调用。

- `libs/content/src/category/category.service.ts`
  - 完成：切换 Drizzle。
  - 完成：分页、更新状态、排序交换、删除逻辑迁移。
  - 说明：按当前表结构保留硬删除（无 `deletedAt` 字段）。

- `libs/content/src/tag/tag.service.ts`
  - 完成：切换 Drizzle。
  - 完成：分页、详情、更新、排序、批量删除迁移。
  - 完成：新增 `updateTagStatus` 供控制器调用。
  - 说明：按当前表结构保留硬删除（无 `deletedAt` 字段）。

- `libs/content/src/permission/content-permission.select.ts`
  - 完成：移除 Prisma 类型依赖。

- `libs/content/src/permission/content-permission.types.ts`
  - 完成：改为基于 Drizzle schema infer 的类型定义，不再依赖 Prisma payload 类型。

- `libs/content/src/permission/content-permission.service.ts`
  - 完成：全链路改为 Drizzle 查询。
  - 完成：章节/作品权限解析、会员校验、购买校验切换 Drizzle。
  - 完成：`checkChapterAccess` 返回结构保留，支持动态 select 投影。

- `libs/content/src/content-counter.service.ts`
  - 完成：切换 Drizzle。
  - 完成：计数增减改为 SQL 表达式更新，支持交互事务上下文。

### 3.2 作品与章节主服务

- `libs/content/src/work/chapter/work-chapter.service.ts`
  - 完成：切换 Drizzle。
  - 完成：章节创建、分页、详情、前后章节、更新、删除、排序迁移。
  - 完成：详情中的关联查询（作品、会员等级）改为 Drizzle `with`。

- `libs/content/src/work/core/work.service.ts`
  - 完成：切换 Drizzle。
  - 完成：创建/更新/删除走 Drizzle transaction。
  - 完成：作者/分类/标签关联改为关系表批量写入与重建。
  - 完成：作者作品数增减改为 SQL 表达式更新。
  - 完成：热门/最新/推荐/综合分页统一迁移。
  - 完成：关系数据采用“分页后补充关联”模式。
  - 完成：新增 `updateWorkFlags` 提供 controller 状态位更新入口。
  - 兼容：`publishAt` 在写入时统一归一化为 ISO 字符串，匹配 schema 类型。

### 3.3 章节内容服务

- `libs/content/src/work/content/comic-content.service.ts`
  - 完成：切换 Drizzle。
  - 完成：章节存在校验、内容更新/移动/删除/清空改为 Drizzle。
  - 完成：权限返回章节数据做显式结构化转换，避免弱类型问题。

- `libs/content/src/work/content/novel-content.service.ts`
  - 完成：切换 Drizzle。
  - 完成：章节内容读写、上传、清空改为 Drizzle。
  - 完成：权限结果结构化处理。

### 3.4 交互 resolver（work + chapter）

- `libs/content/src/work/core/resolver/work-comic-like.resolver.ts`
- `libs/content/src/work/core/resolver/work-novel-like.resolver.ts`
- `libs/content/src/work/core/resolver/work-comic-favorite.resolver.ts`
- `libs/content/src/work/core/resolver/work-novel-favorite.resolver.ts`
- `libs/content/src/work/core/resolver/work-comic-comment.resolver.ts`
- `libs/content/src/work/core/resolver/work-novel-comment.resolver.ts`
- `libs/content/src/work/chapter/resolver/work-comic-chapter-like.resolver.ts`
- `libs/content/src/work/chapter/resolver/work-novel-chapter-like.resolver.ts`
- `libs/content/src/work/chapter/resolver/work-comic-chapter-comment.resolver.ts`
- `libs/content/src/work/chapter/resolver/work-novel-chapter-comment.resolver.ts`
- `libs/content/src/work/core/resolver/work-reading-state.resolver.ts`

以上文件完成点：

- 移除 `PlatformService` 继承；
- 需要查询时改为 `DrizzleService` + `db.query`；
- 交互计数增减继续走 SQL 表达式，保持原子更新行为。

## 4. admin-api 适配（调用面）

因为原 controller 存在直接调用 `service.xxx.update/updateMany` 的 Prisma Delegate 习惯，迁移后统一改为显式 service 方法调用：

- `apps/admin-api/src/modules/content-management/author/author.controller.ts`
  - 改为调用 `updateAuthorStatus` / `updateAuthorRecommended`。

- `apps/admin-api/src/modules/content-management/tag/tag.controller.ts`
  - 改为调用 `updateTagStatus`。

- `apps/admin-api/src/modules/work/work.controller.ts`
  - 改为调用 `updateWorkFlags`。

- `apps/admin-api/src/modules/content-management/comic/core/comic.controller.ts`
  - 改为调用 `updateWorkFlags`。

- `apps/admin-api/src/modules/content-management/novel/novel.controller.ts`
  - 改为调用 `updateWorkFlags`。

## 5. 迁移后校验

### 5.1 静态检查

- 执行：`pnpm type-check`
  - 结果：通过。

- 执行：`pnpm lint`
  - 结果：通过。

### 5.2 代码痕迹检查

- 已清理 `libs/content/src` 中的 `extends PlatformService`。
- 已清理 `libs/content/src` 中的 `this.prisma`。
- 已清理 `libs/content/src` 中对 `@libs/platform/database` 的直接依赖。

## 6. 关键变更策略说明

1. **复杂分页 + 关联展开**
   - Prisma 的深层 `select/include` 迁移到 Drizzle 时，采用“主表分页 + 关系表补充聚合”以保证可维护性。

2. **数组字段条件**
   - `hasEvery/hasSome` 等 Prisma 语义在 Drizzle 下使用 PostgreSQL 数组操作符（`@>`、`&&`）表达。

3. **软删与硬删差异**
   - 按表结构保留策略：有 `deletedAt` 的表继续软删，无 `deletedAt` 的表采用硬删。

4. **控制层去 ORM 细节**
   - controller 不再依赖底层 ORM delegate 形态，改为调用 service 的语义化方法，降低后续迁移成本。

## 7. 后续建议

1. 建议补充 `libs/content` 的集成测试用例，覆盖：
   - 作品创建/更新关联重建；
   - 章节权限（ALL、LOGGED_IN、MEMBER、PURCHASE、INHERIT）；
   - 热门/推荐/最新分页与标签/作者过滤。

2. 建议为 `WorkService.attachWorkRelations` 增加复用层（可沉淀为通用 relation 聚合器），减少跨模块重复模式。

3. 建议在 `docs/audit` 持续维护“迁移完成清单 + 回归清单”，形成固定验收模板。

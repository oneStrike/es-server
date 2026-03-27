# buildPageQuery 拆分任务清单（2026-03-27）

## 0. 当前状态（2026-03-27 更新）

本清单对应的拆分工作已经完成，当前仓库状态如下：

- `DrizzleService.buildPageQuery()` 已移除
- `DrizzleService.buildPage()` / `buildOrderBy()` 已成为唯一公共入口
- 原 `7` 个直接业务调用文件已全部迁移
- `findPagination()` 已稳定组合纯分页 helper 与纯排序 helper
- 相关测试、`eslint` 与 `type-check` 已通过

后续若继续推进，应把这份清单视为“已完成记录 + 排序治理衔接说明”，而不是待办列表。

## 1. 目标

本轮目标不是继续扩展 `buildPageQuery()`，而是把它彻底拆回两个明确能力：

- `buildPage()`：只负责 `pageIndex` / `pageSize` / `limit` / `offset`
- `buildOrderBy()`：只负责 `orderBy` / `orderBySql`

同时保留现有低层 helper 的边界：

- `buildDrizzlePageQuery()` 已经是纯分页 helper，本轮不再让它重新承担排序职责
- `buildDrizzleOrderBy()` 继续负责排序解析、字段校验、稳定 `id` 补尾和双输出构造
- `findPagination()` 继续在 extension 层组合分页和排序

本轮完成后，`DrizzleService.buildPageQuery()` 应从仓库里移除，不再作为公共入口保留。

## 2. 全仓库盘点

### 2.1 直接调用 `buildPageQuery()` 的地方

全仓库共扫描到 `11` 处调用，分布在 `7` 个文件中：

- `libs/forum/src/search/search.service.ts`
- `libs/growth/src/badge/user-badge.service.ts`
- `libs/growth/src/task/task.service.ts`
- `libs/interaction/src/download/download.service.ts`
- `libs/interaction/src/purchase/purchase.service.ts`
- `libs/message/src/chat/chat.service.ts`
- `libs/message/src/inbox/inbox.service.ts`

其中可分为两类：

#### A. 仅使用分页结果

- `libs/forum/src/search/search.service.ts`
- `libs/interaction/src/download/download.service.ts`
- `libs/interaction/src/purchase/purchase.service.ts`
- `libs/message/src/chat/chat.service.ts`
- `libs/message/src/inbox/inbox.service.ts`

这些调用只消费 `pageIndex` / `pageSize` / `limit` / `offset`，迁移成本最低。

#### B. 同时依赖排序输出

- `libs/growth/src/task/task.service.ts`
  - 使用 `defaultOrderBy: { id: 'desc' }`
  - 消费 `pageQuery.orderBySql`
- `libs/growth/src/badge/user-badge.service.ts`
  - 使用 `defaultOrderBy: [{ createdAt: 'desc' }, { userId: 'asc' }]`
  - 消费 `pageQuery.orderBySql`

这两处是拆分后的关键验证点，需要改成显式组合 `buildPage()` + `buildOrderBy()`。

### 2.2 `findPagination()` 的使用面

全仓库共扫描到 `39` 个包含 `findPagination()` 的文件：

- `27` 个文件在调用点所在文件里显式声明了 `orderBy`
- `12` 个文件未显式声明 `orderBy`，依赖底层默认 `id desc`

这说明：

- `findPagination()` 仍是仓库主流分页入口，不能顺手改坏它的既有契约
- `buildPageQuery()` 拆分后，不应反向影响 `findPagination()` 的稳定行为

### 2.3 需要额外关注的排序写法

仓库内还存在几类和本轮拆分强相关、容易遗漏的调用模式：

#### 1. “有用户排序就不传默认值”的旧写法

- `libs/forum/src/section-group/forum-section-group.service.ts`
- `libs/interaction/src/emoji/emoji-asset.service.ts`

典型形式：

- `orderBy: dto.orderBy ? undefined : { sortOrder: '...' }`

这类写法语义正确，但可读性差，后续建议统一改成 `dto.orderBy ?? ...` 风格。

#### 2. 直接在 `findPagination()` 上传 JSON 字符串默认排序

- `libs/growth/src/point/point.service.ts`
- `libs/growth/src/experience/experience.service.ts`

典型形式：

- `orderBy: dto.orderBy ?? JSON.stringify([{ id: 'desc' }])`

这类写法继续能工作，但不值得保留为长期风格，后续建议统一改成对象或数组字面量。

#### 3. `sortOrder` 默认方向存在漂移

- `libs/content/src/category/category.service.ts`
- `libs/content/src/tag/tag.service.ts`
- `libs/forum/src/section-group/forum-section-group.service.ts`
- `libs/forum/src/tag/forum-tag.service.ts`
- `libs/config/src/dictionary/dictionary.service.ts`
- `libs/interaction/src/emoji/emoji-asset.service.ts`

目前仓库里同时存在：

- `sortOrder asc`
- `sortOrder desc`
- `sortOrder + id`
- 只有 `sortOrder`

这不是本轮拆分的阻塞项，但它决定了拆分后第二阶段的清理顺序。

### 2.4 文档漂移

`docs/` 下至少有 `9` 处对 `buildDrizzlePageQuery()` / `buildPageQuery()` 的旧描述，当前最明确的一份是：

- `docs/sort-order-governance-2026-03-27.md`

其中仍有“`buildDrizzlePageQuery()` 处理排序”这类过时表述，本轮落地后必须同步修正。

## 3. 目标状态

本轮完成后的目标状态如下：

### 3.1 公共 API

- 保留 `DrizzleService.buildOrderBy()`
- 新增 `DrizzleService.buildPage()`
- 删除 `DrizzleService.buildPageQuery()`

### 3.2 低层 helper

- 保留 `buildDrizzlePageQuery()` 作为纯分页 helper
- 保留 `buildDrizzleOrderBy()` 作为纯排序 helper
- `findPagination()` 继续组合两者，不再受 `DrizzleService.buildPageQuery()` 是否存在影响

### 3.3 调用方式

纯分页：

```ts
const page = this.drizzle.buildPage(dto, {
  maxPageSize: 100,
})
```

分页 + 手写查询排序：

```ts
const page = this.drizzle.buildPage(dto)
const order = this.drizzle.buildOrderBy(dto.orderBy, {
  table: this.userBadgeAssignment,
  fallbackOrderBy: [{ createdAt: 'desc' }, { userId: 'asc' }],
})
```

然后分别使用：

- `page.limit` / `page.offset`
- `order.orderBySql`

RQB `findFirst` / `findMany` 场景则继续消费：

- `order.orderBy`

## 4. 分阶段任务清单

### 阶段 1：拆出正式分页入口

目标：在不改业务行为的前提下，把 `DrizzleService` 的分页和排序入口彻底拆开。

- [ ] 在 `db/core/drizzle.service.ts` 新增 `buildPage()`
- [ ] `buildPage()` 只包装 `buildDrizzlePageQuery()` 和仓库级 `queryConfig`
- [ ] 保留 `buildOrderBy()` 现有能力与签名
- [ ] `buildPageQuery()` 只作为同一轮迁移中的临时兼容入口保留，不再新增新调用
- [ ] 更新 `db/core/index.ts` 对外导出后的可用 API 说明注释

验收：

- [ ] `buildPage()` 可直接替换现有纯分页调用
- [ ] 仓库内不再新增任何新的 `this.drizzle.buildPageQuery(...)`

### 阶段 2：迁移 7 个真实调用文件

目标：先完成所有直接依赖 `DrizzleService.buildPageQuery()` 的地方，保证拆分不留尾巴。

#### 2.1 先迁移“纯分页”调用

- [ ] `libs/forum/src/search/search.service.ts`
  - 3 处 `buildPageQuery()` 全部改成 `buildPage()`
  - 不引入 `buildOrderBy()`，因为这里排序不是通过 `pageQuery` 提供
- [ ] `libs/interaction/src/download/download.service.ts`
  - 2 处改成 `buildPage()`
  - 保持原生 SQL `ORDER BY` 不变
- [ ] `libs/interaction/src/purchase/purchase.service.ts`
  - 2 处改成 `buildPage()`
  - 保持原生 SQL `ORDER BY` 不变
- [ ] `libs/message/src/chat/chat.service.ts`
  - 1 处改成 `buildPage()`
  - 保留 `maxPageSize: 100`
- [ ] `libs/message/src/inbox/inbox.service.ts`
  - 1 处改成 `buildPage()`
  - 保留 `maxPageSize: 100`

#### 2.2 再迁移“分页 + 排序组合”调用

- [ ] `libs/growth/src/task/task.service.ts`
  - `buildPageQuery()` 改成 `buildPage()`
  - `defaultOrderBy` 改成显式 `buildOrderBy(..., { fallbackOrderBy })`
  - 保持当前 `id desc` 默认行为不变
- [ ] `libs/growth/src/badge/user-badge.service.ts`
  - `buildPageQuery()` 改成 `buildPage()`
  - `defaultOrderBy` 改成显式 `buildOrderBy(..., { fallbackOrderBy })`
  - 保持当前 `createdAt desc, userId asc` 默认行为不变

验收：

- [ ] 全仓库不存在 `this.drizzle.buildPageQuery(...)`
- [ ] `buildOrderBy()` 至少有真实业务调用，不再只是被兼容层间接消费

### 阶段 3：删除兼容入口

目标：在所有调用点迁完后，真正删除 `DrizzleService.buildPageQuery()`，完成 API 收口。

- [ ] 从 `db/core/drizzle.service.ts` 删除 `buildPageQuery()`
- [ ] 复核 `db/core/index.ts` 导出面，确认只保留 `buildPage()` / `buildOrderBy()`
- [ ] 用 `rg -n "buildPageQuery\\(" -S apps libs db` 再次确认，业务层已无旧入口残留

### 阶段 4：排序默认值风格收口

目标：在拆分完成后，把几类最容易误读的旧写法统一掉，减少后续维护成本。

- [ ] 清理 `dto.orderBy ? undefined : ...` 风格
  - `libs/forum/src/section-group/forum-section-group.service.ts`
  - `libs/interaction/src/emoji/emoji-asset.service.ts`
- [ ] 清理 `JSON.stringify([{ id: 'desc' }])` 风格
  - `libs/growth/src/point/point.service.ts`
  - `libs/growth/src/experience/experience.service.ts`
- [ ] 复核 `sortOrder` 默认方向是否与治理文档一致
  - `libs/content/src/category/category.service.ts`
  - `libs/content/src/tag/tag.service.ts`
  - `libs/forum/src/tag/forum-tag.service.ts`
  - `libs/forum/src/section-group/forum-section-group.service.ts`
  - `libs/config/src/dictionary/dictionary.service.ts`
  - `libs/interaction/src/emoji/emoji-asset.service.ts`

说明：

- 这一阶段不要求“把所有排序都改成 helper”
- 只要求把最明显的漂移和历史写法收口

### 阶段 5：文档与测试对齐

目标：把这轮 API 拆分后的事实同步到测试和治理文档，避免再次漂移。

- [ ] 更新 `libs/platform/src/config/page-query.spec.ts`
  - 增加或调整 `DrizzleService.buildPage()` 对应测试
  - 保留 `buildDrizzlePageQuery()` / `buildDrizzleOrderBy()` 的低层单测
- [ ] 更新 `docs/sort-order-governance-2026-03-27.md`
  - 修正 `buildDrizzlePageQuery()` 的职责描述
  - 去掉“`buildPageQuery()` 仍是组合入口”的旧表述
- [ ] 复核 `docs/drizzle-findPagination-where-builder-review-2026-03-25.md`
  - 如继续保留，应补充“该文档基于旧 API”的提示或同步修订

## 5. 建议执行顺序

建议按下面顺序做，不要反过来：

1. 先改 `DrizzleService` 公共入口
2. 立刻迁移 7 个 `buildPageQuery()` 调用文件
3. 确认仓库里已无 `buildPageQuery()` 业务调用后再删除兼容入口
4. 再做排序默认值风格收口
5. 最后修文档和补测试

这样能避免出现：

- 新 API 和旧调用长期并存
- 排序重构和分页拆分交叉进行，导致 review 难度上升
- 文档先改、代码后补，产生新的漂移

## 6. 回归检查清单

### 6.1 必跑

- [ ] `pnpm eslint db/core/query/order-by.ts db/core/query/page-query.ts db/core/drizzle.service.ts db/extensions/findPagination.ts`
- [ ] `pnpm eslint` 覆盖本轮迁移到的业务文件
- [ ] `pnpm jest libs/platform/src/config/page-query.spec.ts`
- [ ] `pnpm type-check`

### 6.2 重点人工回归

- [ ] 论坛搜索混合分页：`libs/forum/src/search/search.service.ts`
- [ ] 用户徽章分页：`libs/growth/src/badge/user-badge.service.ts`
- [ ] 任务分配分页：`libs/growth/src/task/task.service.ts`
- [ ] 消息收件箱时间线：`libs/message/src/inbox/inbox.service.ts`
- [ ] 私聊会话列表：`libs/message/src/chat/chat.service.ts`
- [ ] 已购/已下载列表分页：`libs/interaction/src/purchase/purchase.service.ts`、`libs/interaction/src/download/download.service.ts`

## 7. 风险与注意事项

- `buildPageQuery()` 当前虽然只剩 `7` 个文件在用，但它位于 `DrizzleService` 公共入口上，删除必须和调用点迁移在同一轮完成。
- `findPagination()` 的默认 `id desc` 行为本轮不应变化，否则会误伤那 `12` 个未显式传 `orderBy` 的文件。
- `buildOrderBy()` 迁入真实业务调用后，要特别注意：
  - `fallbackOrderBy` 继续保持对象/数组字面量，不要退回 JSON 字符串
  - `orderBySql` 只用于 `select().orderBy(...)`
  - `orderBy` 只用于 `db.query.findFirst/findMany`
- `docs/sort-order-governance-2026-03-27.md` 已经存在旧表述，本轮若不一起修文档，后续 review 很容易再被误导。

## 8. 本轮建议结论

建议把本轮拆分定义为“一次性完成的 API 收口”，不要再保留 `buildPageQuery()` 作为长期兼容层。

原因有三个：

- 全仓库直接调用点已经盘清，规模可控
- `buildOrderBy()` 目前还没有真实业务调用，继续拖会让抽象长期悬空
- `buildDrizzlePageQuery()` 和 `findPagination()` 的底层边界已经稳定，没有必要在迁移完成后继续让 `DrizzleService` 保留一个重新耦合分页和排序的历史入口

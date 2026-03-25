# Drizzle `findPagination` / `where-builder` 审查报告

- 生成时间：2026-03-25
- 仓库：`D:\code\es\es-server`
- 审查范围：
  - `db/extensions/findPagination.ts`
  - `db/core/query/page-query.ts`
  - `db/core/query/where-builder.ts`
  - `db/core/drizzle.type.ts`
  - `libs/platform/src/dto/page.dto.ts`
  - `libs/platform/src/decorators/api-doc.decorator.ts`
  - 若干实际调用点
- 产出目标：
  - 结合 Drizzle 官方文档、社区讨论、公开开源样例与本仓库现状，确认 `findPagination` 与 `where-builder` 是否存在问题
  - 重点验证“前端传入 `pageIndex` 从 1 开始”时是否正确

## 1. 结论摘要

结论很明确：当前实现存在真实问题，而且不是“风格问题”，而是会影响实际查询结果的行为问题。

### 1.1 `findPagination` / `buildPageQuery` 的核心问题

如果前端传入的 `pageIndex` 是从 1 开始，那么当前分页逻辑从第二页开始就会错页。

- 当前实现位于 `db/core/query/page-query.ts:77-91`
- 关键逻辑：
  - `pageIndex <= 0` 时返回 `0`
  - `pageIndex === 1` 时也返回 `0`
  - `pageIndex > 1` 时原样返回
- 随后 `offset = pageIndex * pageSize`，位于 `db/core/query/page-query.ts:176-188`

这意味着：

| 前端传入 `pageIndex` | 当前归一化结果 | `pageSize=10` 时 offset | 实际语义 |
| --- | --- | --- | --- |
| `1` | `0` | `0` | 第一页 |
| `2` | `2` | `20` | 实际拿到第三页 |
| `3` | `3` | `30` | 实际拿到第四页 |

也就是说，当前逻辑不是“兼容 1-based”，而是“只把 1 特判成第一页，其余继续按 0-based 处理”。

### 1.2 “同时兼容 0-based 与 1-based pageIndex” 这个说法本身有问题

这是一个重要结论。

只看一个 `pageIndex` 数字，在 `pageIndex > 1` 时，无法判断：

- `2` 是“1-based 的第二页”
- 还是“0-based 的第三页”

所以，“无额外信号地同时兼容 0-based 和 1-based”在数学上无法成立，最多只能在第一页附近做模糊兼容。当前实现正是这种“第一页看起来能用，后面全部歪掉”的状态。

这部分属于基于页码语义的推断，不依赖 Drizzle 版本，结论稳定。

### 1.3 `where-builder` 存在两个已确认缺陷

`where-builder` 当前不是一个完整的 Drizzle 条件组合抽象，它更像一个受限 DSL，而且这个 DSL 已经和仓库里的实际写法发生了冲突。

已确认的两个问题：

1. 根节点同时存在 `and` 与 `or` 时，只会处理 `and`，`or` 会被直接忽略。
2. `or: [ilike(...)]` 这类原生 Drizzle `SQL` 表达式数组并不受支持，最终会被编译成 `undefined` 或被上层 `and` 吃掉。

这会导致若干页面的“名称模糊搜索条件”实际没有生效。

## 2. 外部资料调研结论

## 2.1 Drizzle 官方文档对分页的推荐

Drizzle 官方文档在 `Select -> Advanced pagination` 中给出的 offset 分页示例，明确使用：

- `page = 1`
- `offset = (page - 1) * pageSize`

官方示例要点：

- `orm.drizzle.team/docs/select` 中 `getUsers(page = 1, pageSize = 3)` 示例使用 `offset: (page - 1) * pageSize`
- `Answer Overflow` 中 Drizzle Team 社区回答也引用了同样的官方 helper：
  - `function withPagination(qb, page = 1, pageSize = 10) { return qb.limit(pageSize).offset((page - 1) * pageSize) }`

也就是说，从 Drizzle 资料体系来看：

- 对外暴露“页码”时，社区/示例非常常见的是 1-based `page`
- 数据库层始终自己换算成 offset

当前仓库的 `normalizePageIndex()` 不符合这条常见路径。

## 2.2 Drizzle 官方文档对动态条件的推荐

Drizzle 官方文档在 `Select -> Advanced filters` 里，明确推荐两种模式：

1. 直接传单个条件：`where(term ? ilike(posts.title, term) : undefined)`
2. 收集 `SQL[]` 后用 `and(...filters)` 组合

官方示例核心点：

- `where()` 可以直接接收 Drizzle 的原生 `SQL` 表达式
- 动态条件推荐用 `SQL[]` 累积再 `and(...filters)`
- `and()` / `or()` 是标准逻辑组合方式

这意味着一个项目内的 helper 如果声称是在“构建 Drizzle where”，那么至少要和这些能力兼容，尤其不能把原生 `SQL` 条件吃掉。

## 2.3 Drizzle 社区讨论中的常见最佳实践

公开社区讨论里，Drizzle Team 成员给出的动态过滤建议同样是：

- 先把条件放进数组
- 最后 `.where(and(...filters))`

这和官方文档是同一路数。

结论：

- 社区最佳实践不是“自造一个只能理解字段 DSL、不能处理原生 `SQL` 的 helper”
- 而是“保留 Drizzle 原生表达式能力，用 helper 做薄封装”

## 2.4 公开样例 / 开源样例观察

我额外抽样了几个公开样例：

1. `axmad386` 的 `Fully Typed Drizzle ORM Dynamic Pagination Query`
   - 直接使用 `page`
   - 核心换算是 `offset((page - 1) * limit)`

2. `cayter` 的 `Drizzle ORM Type-Safe Repository With PgTable`
   - `paginateByOffset()` 默认 `page = 1`
   - 核心换算是 `offset: (page - 1) * perPage`

3. `jacksonkasi1/tnks-data-table`
   - 文档明确写明服务端分页参数：
     - `page`: Current page number (1-based)
     - `limit`: Number of items per page

这些公开样例虽然实现细节不同，但有一个共同点：

- 对外统一一个明确分页契约
- 在数据库层按这个契约一次性换算 offset
- 不做“既想兼容 0-based，又想兼容 1-based”的隐式猜测

## 3. 本仓库代码审查结果

## 3.1 `findPagination` 只是壳，真正决定分页语义的是 `buildDrizzlePageQuery`

`db/extensions/findPagination.ts:46-90` 本身没有复杂页码逻辑，它只是：

1. 把 `pageIndex` / `pageSize` / `orderBy` 传给 `buildDrizzlePageQuery()`
2. 用返回的 `limit` / `offset` 执行列表查询
3. 用 `db.$count(table, where)` 查询总数

因此分页正确性主要由：

- `db/core/query/page-query.ts`

决定。

## 3.2 当前分页实现与仓库声明存在冲突

仓库里当前有三套说法：

1. `AGENTS.md:81`
   - 声明 `findPagination` 当前兼容 `pageIndex` 0-based 与 1-based 输入

2. `.trae/rules/drizzle-guidelines.md:20-22`
   - 继续要求业务层直接沿用 `PageDto` / `findPagination` 的页码语义

3. `libs/platform/src/dto/page.dto.ts:39-46`
   - 明确写的是“当前页码（从0开始）”

再加上 `libs/platform/src/decorators/api-doc.decorator.ts:145-149` 的分页响应描述，也是“从 0 开始”。

但是实际运行逻辑并不满足“兼容 0-based 与 1-based”，只满足：

- `0` 和 `1` 都会落到第一页
- `2+` 都按 0-based 解释

所以这里存在非常明确的“规范 / 注释 / 实现”冲突。

## 3.3 本地最小复现实验

我做了本地最小复现实验，直接调用当前源码中的 `buildDrizzlePageQuery()` 与 `buildDrizzleWhere()`，结果如下。

### 3.3.1 分页归一化实验结果

实验输出：

```text
pageIndex input=undefined => normalized=0 offset=0
pageIndex input=0 => normalized=0 offset=0
pageIndex input=1 => normalized=0 offset=0
pageIndex input=2 => normalized=2 offset=20
pageIndex input=3 => normalized=3 offset=30
```

这已经足够证明：

- 如果前端传 1-based，第一页看起来正常
- 第二页开始实际会取错页

### 3.3.2 `where-builder` 组合实验结果

实验输出摘要：

```text
onlyAnd         => "forum_tag"."isEnabled" = $1
andWithRawOr    => "forum_tag"."isEnabled" = $1
andWithObjectOr => "forum_tag"."isEnabled" = $1
pureObjectOr    => "forum_tag"."name" ilike $1
pureRawOr       => undefined
```

这说明：

1. 根节点同时传 `and` 和 `or` 时，`or` 被忽略
2. `or: [ilike(...)]` 这种写法本身不受支持
3. 只有“单独的对象式 `or`”才可以工作

## 3.4 `where-builder` 的根本设计问题

### 3.4.1 类型层面已经把原生 `SQL` 排除掉了

见 `db/core/drizzle.type.ts:86-107`：

- `DrizzleWhereNode<TTable>` 只允许：
  - `DrizzleWhereCondition`
  - `DrizzleWhereAndNode`
  - `DrizzleWhereOrNode`
  - `DrizzleWhereNotNode`

没有把 Drizzle 原生 `SQL` 纳入联合类型。

这意味着：

- 这个 helper 天生不兼容官方文档推荐的 `SQL[] + and(...filters)` 组合模式
- 也不兼容直接把 `ilike(...)`、`eq(...)`、`and(...)` 这样的原生表达式放进逻辑数组

### 3.4.2 运行时只处理一个逻辑分支

见 `db/core/query/where-builder.ts:42-67`。

`compileWhereNode()` 的逻辑是：

1. 如果有 `and`，直接返回 `and(...)`
2. 否则如果有 `or`，返回 `or(...)`
3. 否则如果有 `not`，返回 `not(...)`
4. 否则按单条件处理

这意味着根节点如果同时有：

- `and` 和 `or`
- `and` 和 `not`
- `or` 和 `not`

后面的逻辑节点都会被直接忽略。

这不是 Drizzle 的问题，是本地 helper 的递归编译逻辑有损。

### 3.4.3 逻辑数组不支持原生 SQL 表达式

见 `db/core/query/where-builder.ts:52-59` 与 `70-78`。

当 `or: [ilike(...)]` 进入 `compileWhereNode()` 时：

- `ilike(...)` 是 Drizzle 原生 `SQL`
- 但 `compileWhereCondition()` 期待的是 `{ field, op, value }`
- 于是 `condition.field` 为 `undefined`
- `column` 取不到
- 最终返回 `undefined`

所以即使未来修掉“根节点只看 `and`”的问题，`or: [ilike(...)]` 这种仓库里已经出现的写法依然不会正常工作，除非一起补上原生 `SQL` 支持。

## 4. 已确认受影响的调用点

目前已经确认至少 4 处调用会因为 `and + or` 同层组合而丢失模糊搜索条件：

1. `libs/forum/src/tag/forum-tag.service.ts:110-115`
2. `libs/forum/src/profile/profile.service.ts:108-114`
3. `libs/forum/src/section-group/forum-section-group.service.ts:63-69`
4. `libs/forum/src/section/forum-section.service.ts:359-366`

这些地方的共同模式都是：

```ts
this.drizzle.buildWhere(table, {
  and: { ...exactFilters },
  ...(keyword ? { or: [ilike(table.xxx, `%${keyword}%`)] } : {}),
})
```

在当前 `where-builder` 下，`or` 这部分不会生效。

换句话说：

- 论坛标签名称搜索
- 论坛用户昵称搜索
- 板块分组名称搜索
- 板块名称搜索

目前大概率都只执行了 `and` 精确过滤，没有执行模糊搜索。

## 5. 影响范围评估

基于仓库搜索结果：

- `findPagination` / `.findPagination(` 共有 `49` 处引用
- `buildPageQuery(` 共有 `11` 处引用
- `buildWhere` / `.buildWhere(` 共有 `51` 处引用

因此：

### 5.1 分页问题的影响范围

分页问题不只影响 `drizzle.ext.findPagination()`，还会影响所有直接调用 `drizzle.buildPageQuery()` 的地方。

也就是说，如果前端确实统一按 1-based 传页码，那么：

- `findPagination` 调用点会错页
- 手工分页但复用 `buildPageQuery()` 的调用点也会错页

### 5.2 `where-builder` 问题的影响范围

当前已确认的实错主要集中在“同层 `and + or`”和“原生 SQL 数组”两类模式。

这类问题的危险点在于：

- 它不会报错
- 它会静默丢条件
- 丢条件后查询结果会被放宽

这种问题比直接抛异常更难排查。

## 6. 次要观察与设计偏差

以下内容不是本次最核心的已确认 defect，但值得记录：

### 6.1 `like` 操作名和实际语义不一致

见 `db/core/query/where-builder.ts:112-128`。

当前 DSL 中：

- `like`
- `startsWith`
- `endsWith`

底层全部调用的是 `ilike()`，也就是大小写不敏感匹配。

而 Drizzle 官方文档区分得很清楚：

- `like` = case sensitive
- `ilike` = case insensitive

因此当前 DSL 的命名语义与 Drizzle 官方术语不一致，容易让后续维护者误判。

### 6.2 自定义排序没有自动补稳定次序

`db/core/query/page-query.ts:191-200` 只有在完全没有 `orderBy` 时才会回退到 `{ id: 'desc' }`。

如果业务层传了：

- `{ createdAt: 'desc' }`

则不会自动补 `id` 作为二级排序。

这不一定立刻出 bug，但在 offset 分页下：

- 非唯一排序键
- 并发新增 / 删除
- 同时间戳数据较多

时，页间稳定性会更差。

Drizzle 官方在 cursor pagination 指南里专门强调了：

- 顺序应可稳定比较
- 非唯一排序键要补多列排序

对 offset 分页来说，这条建议同样有参考价值。

## 7. 建议修复方向

这里不直接改源码，只给出建议路径。

## 7.1 先统一分页契约，再改实现

必须先在“API 对外契约”层面做选择：

### 方案 A：统一改成 1-based

如果前端已经是 1-based，而且希望继续保持：

1. 把 `PageDto` / `ApiPageDoc` 文档同步改为从 1 开始
2. 把 `normalizePageIndex()` 明确改成 1-based 逻辑
3. 返回值中的 `pageIndex` 也统一回传 1-based
4. 全仓库审计手工使用 `buildPageQuery()` 的地方
5. 补单测覆盖 `pageIndex=1/2/3`

### 方案 B：统一保持 0-based

如果后端契约必须保持 0-based：

1. 删除 `AGENTS.md` 中“兼容 0-based 与 1-based”的说法
2. 删除任何暗示“兼容 1-based”的实现或注释
3. 让前端在边界层统一转换
4. 维持 `PageDto` / Swagger 现有说明

### 不建议继续保留的方案

不建议继续保留“隐式兼容 0-based 与 1-based”的策略。

原因很简单：

- 它在 `pageIndex > 1` 时没有可靠判定依据
- 只能制造隐藏 bug

## 7.2 `where-builder` 需要明确选型

### 方案 A：做成真正兼容 Drizzle 原生表达式的 helper

建议支持：

1. 根节点多个逻辑键共存
2. 逻辑数组接受原生 `SQL`
3. 对象式 DSL 与原生 `SQL` 混用

这样才能与官方文档、社区最佳实践一致。

### 方案 B：继续保留受限 DSL，但必须严格收口

如果项目想保留纯对象 DSL，也可以，但需要同时做这几件事：

1. 类型层面禁止传原生 `SQL`
2. 运行时遇到非法节点直接抛错，而不是静默忽略
3. 修正所有现有 `or: [ilike(...)]` 的调用
4. 明确规定根节点只能有一个逻辑键

否则现在这种“表面能写、运行时静默丢条件”的状态最危险。

我个人更倾向方案 A，因为它更贴近 Drizzle 原生能力，也更符合仓库规范里“`SQL[] + and(...)` 或 `drizzle.buildWhere(...)` 二选一”的原意。

## 7.3 必须补测试

当前没有搜到与这两块直接对应的测试。

建议至少补以下测试：

### 分页测试

1. `pageIndex=0/1/2/3` 的 offset 断言
2. 0-based 模式断言
3. 1-based 模式断言
4. 自定义 `orderBy` 与默认 `orderBy` 断言

### where-builder 测试

1. 纯 `and`
2. 纯 `or`
3. `and + or` 同层组合
4. `or: [ilike(...)]`
5. 对象 DSL 与原生 `SQL` 混用
6. 非法节点是否抛错

## 8. 这次审查的最终判断

最终判断如下：

1. 如果前端传 `pageIndex` 从 1 开始，那么当前 `findPagination` / `buildPageQuery` 存在真实 bug，第二页开始会错页。
2. 当前仓库关于分页语义的“规范、Swagger、实现、调用注释”已经出现冲突。
3. 当前 `where-builder` 存在真实 bug，至少 4 处论坛相关列表查询的模糊搜索条件会被静默忽略。
4. 当前 `where-builder` 的抽象层级低于 Drizzle 官方推荐能力，和仓库规范中“支持 `SQL[] + and(...)`”的方向也不一致。

## 9. 本次未做的事情

这次只做审查、验证与文档落地，没有直接修改业务源码。

原因：

- 分页语义涉及 API 契约，改动前必须先决定到底统一 0-based 还是 1-based
- `where-builder` 修复涉及类型、运行时行为与调用点收敛，适合单独提交

## 10. 参考资料

### 官方文档

1. Drizzle ORM `Select`
   - https://orm.drizzle.team/docs/select
   - 重点参考：
     - `where()` 支持原生 `SQL`
     - 动态过滤推荐 `SQL[] + and(...filters)`
     - 高级分页示例使用 `page = 1` 与 `offset = (page - 1) * pageSize`

2. Drizzle ORM `Operators`
   - https://orm.drizzle.team/docs/operators
   - 重点参考：
     - `like` / `ilike`
     - `and` / `or`
     - `between` / `inArray` / `isNull`

3. Drizzle ORM `Cursor-based pagination`
   - https://orm.drizzle.team/docs/guides/cursor-based-pagination
   - 重点参考：
     - 排序需要稳定可比较
     - 非唯一排序键应补多列
     - cursor pagination 能避免 skipped / duplicated rows

### 社区讨论

4. Drizzle Team on Answer Overflow: `Option filter parameters`
   - https://www.answeroverflow.com/m/1110996231565619260
   - 重点参考：
     - Drizzle Team 推荐 `.where(and(...filters))`

5. Drizzle Team on Answer Overflow: `Is there any easy way to query both total count and pagination result?`
   - https://www.answeroverflow.com/m/1354303506751946752
   - 重点参考：
     - 社区引用的分页 helper 仍然使用 `page = 1`

### 公开样例 / 开源样例

6. `axmad386` gist: `Fully Typed Drizzle ORM Dynamic Pagination Query`
   - https://gist.github.com/axmad386/73bf037609e13b9af2e3d20b6e1b7cd4

7. `cayter` gist: `Drizzle ORM Type-Safe Repository With PgTable`
   - https://gist.github.com/cayter/49d5c256a885d90c399ca6c1eca19f51

8. `jacksonkasi1/tnks-data-table`
   - https://github.com/jacksonkasi1/tnks-data-table
   - 文档中明确写了 `page` 是 `1-based`

## 11. 本地重点文件索引

- `db/extensions/findPagination.ts`
- `db/core/query/page-query.ts`
- `db/core/query/where-builder.ts`
- `db/core/drizzle.type.ts`
- `libs/platform/src/dto/page.dto.ts`
- `libs/platform/src/decorators/api-doc.decorator.ts`
- `libs/forum/src/tag/forum-tag.service.ts`
- `libs/forum/src/profile/profile.service.ts`
- `libs/forum/src/section-group/forum-section-group.service.ts`
- `libs/forum/src/section/forum-section.service.ts`
- `AGENTS.md`
- `.trae/rules/drizzle-guidelines.md`

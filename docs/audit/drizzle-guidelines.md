# Drizzle 使用规范（项目级）

适用范围：本仓库所有 NestJS 服务层、Resolver、Worker 中对 Drizzle 的使用。
本规范整合 `docs/audit` 下的迁移与审查结果，目标是统一风格、减少回归、提升可维护性。
更新日期：2026-03-17

## 1. 关键入口与术语

- `DrizzleService`：统一数据库入口，提供 `db/schema/ext/buildWhere/withErrorHandling/assertAffectedRows`。
- `db`：`drizzle.db`，执行查询与事务。
- `schema`：`drizzle.schema`，表对象唯一来源。
- `ext`：`drizzle.ext`，项目级扩展（`findPagination/exists/existsActive/applyCountDelta/softDelete/...`）。
- `tx`：Drizzle 事务对象类型（`Db` 或模块内 `Tx` 别名）。

## 2. 强制规则（Must）

1. 仅使用 `DrizzleService` 作为数据库入口：`drizzle.db` + `drizzle.schema` + `drizzle.ext`。
2. 禁止出现 `this.prisma`、`extends PlatformService`、Prisma 类型透出或 Prisma 事务类型。
3. 所有写操作必须包裹 `drizzle.withErrorHandling(() => ...)`。
4. update/delete 后必须调用 `drizzle.assertAffectedRows(result, '资源不存在')`。
5. 分页统一使用 `drizzle.ext.findPagination(...)`。
6. 动态条件使用 `SQL[]` + `and(...)` 或 `drizzle.buildWhere(...)`，无条件时 `where: undefined`。
7. 表对象必须来自 `drizzle.schema`，禁止在服务内重新声明表结构。
8. 事务使用 `db.transaction(async (tx) => ...)`，并在调用链中传递 tx；禁止 `tx: any` 与 `void tx`。
9. 存在性校验优先 `drizzle.ext.exists/existsActive`，避免“先查再判”。
10. 计数/余额增减优先 `drizzle.ext.applyCountDelta` 或 `update ... returning`，必须在同一事务内完成。
11. 原生 SQL 仅允许使用 `sql\`...\`` 与 `db.execute`，禁止字符串拼接 SQL；复杂 SQL 必须收敛到 `db/core/query` helper，禁止 `(result as any).rows` 手工解包。
12. 业务校验失败抛 `BadRequestException`，资源不存在抛 `NotFoundException`；禁止 `throw new Error`。
13. 对“允许失败”的流程必须记录结构化日志，不能静默吞错。
14. 分页语义统一 1-based（`pageIndex` 从 1 开始）。
15. 删除策略：表含 `deletedAt` 字段则走软删（`ext.softDelete` 或 `update deletedAt`），否则硬删。

## 3. 推荐规则（Should）

1. 在 service 中提供 `private get db()`、`private get table()` 访问器。
2. 复用条件抽成私有方法（例如 `buildSearchConditions`）。
3. 能用 `returning()` 的更新/插入，避免“update + findFirst”二次查询。
4. 复杂列表查询采用“主表分页 + 关系补充”模式，避免深层 join 嵌套。
5. Resolver 列表详情统一 `batchGetDetails`，先去重 ID，再批量查询最小字段集。
6. 业务幂等键 `bizKey` 必须稳定可复用，不使用时间戳默认值。
7. 结果结构尽量强类型化，减少 `any`/`as any`。
8. 异常日志统一包含：`bizKey`、`ruleType`、`targetType`、`targetId`、`errorCode`、`costMs`。

## 4. 禁止行为（Don’t）

1. 不要在新代码中引入 Prisma 依赖或平台 Prisma 基类。
2. 不要绕过 `withErrorHandling/assertAffectedRows`。
3. 不要新增 `tx: any`、`void tx`、`(result as any).rows` 这类类型逃逸写法。

## 5. 常用模板

```ts
// 读
async findById(id: number) {
  const data = await this.db.query.someTable.findFirst({ where: eq(this.someTable.id, id) })
  if (!data) throw new NotFoundException('资源不存在')
  return data
}

// 写（更新）
async update(dto: UpdateDto) {
  const { id, ...data } = dto
  const result = await this.drizzle.withErrorHandling(() =>
    this.db.update(this.someTable).set(data).where(eq(this.someTable.id, id)),
  )
  this.drizzle.assertAffectedRows(result, '资源不存在')
  return true
}

// 分页
async list(query: QueryDto) {
  const conditions: SQL[] = []
  if (query.name) conditions.push(like(this.someTable.name, `%${query.name}%`))
  return this.drizzle.ext.findPagination(this.someTable, {
    where: conditions.length > 0 ? and(...conditions) : undefined,
    ...query,
  })
}

// 事务 + returning
async create(input: CreateDto) {
  return this.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(this.someTable)
      .values(input)
      .returning({ id: this.someTable.id })
    return row
  })
}
```

## 6. Resolver 规范

- Resolver 不继承 PlatformService，统一注入 DrizzleService 或上层服务。
- 列表类 resolver 必须批量拉取详情（`batchGetDetails`），禁止逐条 resolver 查询。
- 传入 `tx` 必须沿链路传递并实际使用，禁止忽略事务。
- 详情聚合失败需要结构化日志，不得静默吞错。
- 跨模块 resolver 契约需统一命名与最小字段集（content/forum/interaction/growth）。

## 7. 原生 SQL 使用约定

- 允许场景：复杂聚合、窗口函数、无法表达的多表统计。
- 要求：统一放入 `db/core/query` helper，输出强类型结果。
- 禁止：业务服务中直接拼接 SQL 字符串或解包 rows。

## 8. 验收清单

1. 代码中无 `this.prisma`、`extends PlatformService`、Prisma 类型透出。
2. 写操作已统一 `withErrorHandling` + `assertAffectedRows`。
3. 分页统一 `ext.findPagination`，`pageIndex` 1-based。
4. 事务类型无 `any`，且未出现 `void tx`。
5. 原生 SQL 已下沉到 `db/core/query`，业务层无手工 rows 解包。
6. `pnpm type-check` 与 `pnpm lint` 通过。

## 9. 资料来源（docs/audit 全量文件）

- `CONTENT_PRISMA_TO_DRIZZLE_逐文件迁移报告_2026-03-17.md`
- `FORUM_PRISMA_TO_DRIZZLE_逐文件排查_2026-03-17.md`
- `INTERACTION_GROWTH_全量模块审查报告_2026-03-17.md`
- `INTERACTION_GROWTH_Drizzle逐文件审查_2026-03-17.md`
- `INTERACTION_GROWTH_PRISMA_TO_DRIZZLE_EXEC_PLAN.md`
- `LIBS_PRISMA_TO_DRIZZLE_全模块逐文件排查报告_2026-03-17.md`
- `RESOLVER_优化优先级清单_2026-03-17.md`
- `drizzle-guidelines.md`（本文件历史版本）

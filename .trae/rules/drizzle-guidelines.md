# Drizzle 使用规范（项目级）

适用范围：本仓库所有 NestJS Service、Resolver、Worker 中对 Drizzle 的使用。
本文件是仓库内默认 Drizzle 规范来源。若规范条文与当前可运行抽象、既有接口返回契约、重试语义或基础设施入口冲突，以当前实现为准，并在变更说明中明确记录冲突点，而不是为了“形式合规”改坏现有行为。

## 1. 关键入口与术语

- `DrizzleService`：统一数据库入口，提供 `db`、`schema`、`ext`、`buildWhere`、`withErrorHandling`、`assertAffectedRows`。
- `db`：`drizzle.db`，执行查询与事务。
- `schema`：`drizzle.schema`，表对象唯一来源。
- `ext`：`drizzle.ext`，项目级扩展，如 `findPagination`、`exists`、`existsActive`、`applyCountDelta`、`softDelete`。
- `tx`：Drizzle 事务对象类型（`Db` 或模块内定义的事务别名）。

## 2. 强制规则（Must）

1. 仅使用 `DrizzleService` 作为数据库入口：`drizzle.db`、`drizzle.schema`、`drizzle.ext`。
2. 禁止新增 Prisma 依赖、`this.prisma`、`extends PlatformService`、Prisma 事务类型或 Prisma 风格访问习惯。
3. 所有写操作必须包裹 `drizzle.withErrorHandling(() => ...)`，或使用等价事务封装；但调用方如果依赖原始 PostgreSQL 错误码做重试、幂等去重或冲突分支，不要在该事务层使用会吞掉原始错误类型的通用包装。
4. update/delete 在语义上必须保证资源存在时，必须调用 `drizzle.assertAffectedRows(result, '资源不存在')`；幂等删除等允许 0 行变更的场景除外。
5. 常规单表、单源分页统一使用 `drizzle.ext.findPagination(...)`；业务代码不得在这类场景重复实现 `offset/limit` 与页码语义。跨来源合并排序、时间线、混合搜索等复合分页允许使用专用 helper 或手工分页，但必须保持现有结果语义，并复用统一的分页入参/返回结构约定。
6. 分页入参与索引语义沿用 `PageDto` 与 `findPagination` 的当前实现，禁止在业务层额外做 0/1-based 手工换算。
7. 动态条件统一使用 `SQL[] + and(...)` 或 `drizzle.buildWhere(...)`；无条件时传 `where: undefined`。
8. 表对象必须来自 `drizzle.schema`，禁止在服务内重新声明表结构。
9. 事务统一使用 `db.transaction(async (tx) => ...)` 或 `drizzle.withTransaction(...)`，并在调用链中显式传递 tx；禁止 `tx: any` 与忽略传入事务。若外层逻辑需要基于原始数据库错误做重试或分支判断，优先直接保留 `db.transaction(...)`，并在外层显式处理错误。
10. 存在性校验优先使用 `drizzle.ext.exists/existsActive`，避免“先查再判”的重复查询。
11. 计数、余额、库存等增减优先使用 `drizzle.ext.applyCountDelta` 或 `update ... returning`，且必须在同一事务中完成。
12. 原生 SQL 仅允许使用 `sql\`...\``与`db.execute`；禁止字符串拼接 SQL；复杂 SQL 必须下沉到业务模块内的 query helper 或私有查询方法。
13. `sql.raw()` 只能注入白名单受信任常量，禁止拼接任何用户输入。
14. 查询 API 统一使用 `db.query`、`select/from/where` 等 Drizzle 正式接口；禁止新增 `db._query` 风格写法。
15. Drizzle relations 命名必须区分“目标实体集合”和“中间表记录集合”：直接实体集合优先使用实体复数名，或比实体复数更贴切的领域名称；中间表记录集合必须显式带上 `Relations`、`Assignments`、`Members` 等关联语义，禁止在已存在直接实体集合时继续占用裸实体名。示例：`authors` / `authorRelations`、`badges` / `badgeAssignments`、`participants` / `conversationMembers`。
16. 业务校验失败抛 `BadRequestException`，资源不存在抛 `NotFoundException`；禁止 `throw new Error` 直接暴露通用异常。
17. 对允许失败的流程必须记录结构化日志，不能静默吞错。
18. 删除策略遵循表结构：存在 `deletedAt` 字段时走软删，否则走硬删。
19. 不得为了满足规范而改变既有 service/controller 的返回结构、异常语义、分页结果语义或幂等/重试语义；若规范与现状冲突，应先补充例外条款或调整规范。

## 3. 推荐规则（Should）

1. 在 service 中提供 `private get db()`、`private get table()` 访问器，提高一致性。
2. 复用查询条件应抽成私有方法，例如 `buildSearchConditions`。
3. 能用 `returning()` 的插入或更新，优先避免“先写后再查”。
4. 复杂列表查询优先采用“主表分页 + 关系补充”模式，避免深层联表嵌套；若列表本质上是复合结果集，应显式下沉到专用 query helper，而不是勉强套进单表分页抽象。
5. Resolver 列表详情统一 `batchGetDetails` 思路：先去重 ID，再批量查询最小字段集。
6. 业务幂等键 `bizKey` 必须稳定可复用，不使用时间戳作为默认值。
7. 结果结构尽量保持强类型，减少 `any` 或 `as any`。
8. 异常日志统一包含 `bizKey`、`ruleType`、`targetType`、`targetId`、`errorCode`、`costMs` 等关键字段。
9. 高频重复查询按需使用 `prepare()` 与 `sql.placeholder()`。
10. 高并发关键写路径按需显式指定事务隔离级别。
11. 多值查询参数先标准化为数组并完成空值过滤，再进入查询构建。
12. 状态筛选使用 `xxx !== undefined` 判断是否追加条件，避免把 `false` 当成未传。
13. 排序字段显式通过 `orderBy` 声明，禁止依赖隐式顺序。
14. 可用 ORM 主体表达的单表或常规聚合查询，优先 `select/from/where` 配合少量 `sql\`\``表达式，而不是整段`db.execute`。
15. 收敛旧代码时优先替换数据库入口、条件构建、存在性校验和常规分页，不要顺手调整对外返回契约；接口语义变更必须单独评估。

## 4. 禁止行为（Don’t）

1. 不要在新代码中引入 Prisma 依赖或平台 Prisma 基类。
2. 不要绕过 `withErrorHandling` 与 `assertAffectedRows`；但需要保留原始数据库错误参与重试/幂等判断的事务路径除外。
3. 不要新增 `tx: any`、忽略传入事务、`(result as any).rows` 这类类型逃逸写法。
4. 不要把用户输入传给 `sql.raw()`。
5. 不要复制旧版 `db._query` 示例到新代码。
6. 不要为了贴规范而把复合分页强行改成单表分页，也不要为了贴规范随意修改既有返回结构。

## 5. 常用模板

```ts
// 读
async findById(id: number) {
  const data = await this.db.query.someTable.findFirst({
    where: eq(this.someTable.id, id),
  })
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

// 常规分页
async list(query: QueryDto) {
  return this.drizzle.ext.findPagination(this.someTable, {
    where: this.drizzle.buildWhere(this.someTable, {
      and: {
        name: query.name ? { like: query.name } : undefined,
      },
    }),
    ...query,
  })
}

// 事务 + returning
async create(input: CreateInput) {
  return this.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(this.someTable)
      .values(input)
      .returning({ id: this.someTable.id })
    return row
  })
}

// 依赖原始数据库错误重试的事务路径
async createWithRetry(input: CreateInput) {
  return this.withTransactionConflictRetry(() =>
    this.db.transaction(async (tx) => {
      // ...
    }),
  )
}
```

## 6. Resolver 规范

- Resolver 不继承平台 Prisma 基类，统一注入 `DrizzleService` 或上层 Service。
- 列表型 Resolver 必须批量拉取详情，禁止逐条触发数据库查询。
- 传入 `tx` 必须沿调用链实际使用，禁止接收后忽略。
- 详情聚合失败需要输出结构化日志，不得静默吞错。
- 跨模块 Resolver 契约保持统一命名与最小字段集。

## 7. 原生 SQL 使用约定

- 允许场景：复杂聚合、窗口函数、ORM 难以表达的统计查询、基础设施探活。
- 优先方式：`sql\`...\`` 参数化 + 业务模块内私有 query helper。
- 输出要求：返回值保持明确类型，避免手工解包 `rows`。
- 例外说明：基础设施探活查询（如 `SELECT 1`）可直接使用 `db.execute`。

## 8. 验收清单

1. 代码中不存在 `this.prisma`、`extends PlatformService`、Prisma 类型透出。
2. 写操作统一经过 `withErrorHandling` 或等价事务封装；必须保证资源存在的更新/删除使用了 `assertAffectedRows`。
3. 常规分页走 `ext.findPagination`；复合分页已明确下沉到专用 helper，且没有改动既有结果语义。
4. 事务类型无 `any`，没有忽略传入事务的写法；依赖原始数据库错误的路径没有被通用包装吞掉错误码。
5. 原生 SQL 已下沉到业务模块内 helper/私有方法，业务层没有手工 `rows` 解包。
6. 代码中未新增 `db._query`，且不存在将用户输入传给 `sql.raw()` 的写法。
7. Drizzle relations 中不存在“中间表记录却使用裸实体复数名”的歧义命名。
8. 对外返回结构、异常语义与主要查询排序语义未因“规范收敛”被顺手修改。
9. 类型检查通过，并且相关模块的主要查询/写入路径已完成自测。

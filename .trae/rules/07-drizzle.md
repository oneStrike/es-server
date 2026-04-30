# Drizzle 使用规范

适用范围：`libs/*` 与 `apps/*` 中使用 Drizzle ORM 的数据库操作，以及对应的 schema / migration 联动。

## 仓库约定

- 本仓库统一通过注入的 `DrizzleService` 使用 `drizzle.db`、`drizzle.schema`、`drizzle.ext`；不在业务层自行创建新的 Drizzle 实例。
- 闭集状态 / 类型 / 模式 / 角色字段默认使用 `smallint` / `smallint[]`，并同步补 `check(...)` 约束。
- 开放业务键继续保持字符串，不为了“统一 smallint”而强行数字化；典型例外包括 `eventKey`、`categoryKey`、`projectionKey`、`domain`、`packageMimeType`、模板键、路由键等。
- DTO、常量 / 枚举、`db/schema` 中同一闭集值域必须同轮对齐；不能一层改成数字枚举，另一层仍保留旧字符串或不一致的数值范围。
- `db/schema/**/*.ts` 中导出的 Drizzle 推导类型统一使用 `XxxSelect = typeof table.$inferSelect`、`XxxInsert = typeof table.$inferInsert`；不要额外导出 `Xxx = typeof table.$inferSelect` 这类无意义中间别名。

## 默认动作

- 查询表、关系表、扩展能力时，默认从 `this.drizzle.schema`、`this.drizzle.ext` 取用。
- 事务默认通过 `db.transaction(async (tx) => ...)` 或 `drizzle.withTransaction(async (tx) => ...)` 启动，并沿调用链显式透传 `tx`。
- 常规分页默认使用 `drizzle.ext.findPagination(...)`。
- 分页统一采用 1-based `pageIndex`。
- 动态查询条件默认使用 `SQL[]` 收集，再通过 `and(...)` / `or(...)` 组合。
- Drizzle relational query 的对象式 `where` 存在多分支时，必须先用命名的基础条件和作用域条件配合 `if / else if` 线性构造；不要把多套条件对象塞进嵌套三元表达式。
- 排序字段必须显式声明；禁止依赖数据库返回“自然顺序”。

## 查询与写路径

- `count`、余额、库存、计数器、乐观锁版本号等增减，必须使用原子更新并与事实写入位于同一事务。
- 0 行 update / delete 若业务语义是“目标不存在”，应通过 `assertAffectedRows(...)` 或 `withErrorHandling(..., { notFound: ... })` 收口。
- 需要复用的分页、排序、存在性判断、最大序号、交换字段等公共模式，优先复用 `drizzle.ext` 中已有能力，不要在业务层重复造轮子。
- 读路径需要补记浏览、日志、统计时，优先与主业务分离，并确保附带写入可降级。

## 原生 SQL

- 原生 SQL 仅允许通过 `` sql`...` `` 和 `db.execute(...)` 编写。
- 禁止字符串拼接 SQL。
- 使用原生 SQL 时必须说明原因，例如 Drizzle 表达能力不足、需要数据库原子表达式、需要复杂聚合或批量更新。
- 原生 SQL 中的分页、排序、where 条件、数组处理、JSON 处理仍要遵守本仓库的统一契约，不得各写一套。

## Schema 与 migration 联动

- 常规 schema 差异默认通过 `pnpm db:generate` 生成 migration。
- 若生成过程中出现交互，必须停止并由用户亲自执行；不要替用户继续回答交互提示。
- migration 只允许新建，不允许在已存在、已提交或已执行的 migration 文件中继续追加新 DDL。
- 无法自动生成的 DDL 可手写补充，但必须说明原因、范围与风险。
- 字段改类型、改值域、改数组元素、改 JSON 内部枚举、改约束时，migration 必须同步处理历史数据；不能依赖清库、丢字段、跳过旧值或要求人工补数据。
- 修改 schema 注释后，必须同步刷新 `db/comments/generated.sql`，并确保生成结果 `Warnings: 0`。
- `db/schema`、migration、`db/comments/generated.sql` 三者必须同轮一致，不能只改其中一层。

## 破坏性更新

- 当任务明确声明“破坏性更新 / 不做兼容层”时，`db/schema`、相关常量 / 枚举、DTO、service / resolver / controller、破坏性更新文档必须同轮改完。
- 禁止只改表、不改接口合同。
- 禁止只改 DTO / 常量、不改底层持久化值域。
- 禁止保留临时双读、旧值 fallback、旧字符串兼容映射，除非任务明确要求兼容期。

## 禁止项

- 禁止在业务层直接 new Drizzle 或绕开 `DrizzleService` 访问数据库。
- 禁止隐式事务；事务上下文必须显式透传。
- 禁止分页不写排序字段。
- 禁止在 Drizzle 查询参数中用嵌套三元表达式构造 `where`、`orderBy` 或字段投影；多分支条件必须改成命名变量、`if / else if`、`SQL[]` 条件数组或已有扩展能力。
- 禁止把闭集业务值域留在 `varchar` / `integer[]` 中继续漂移。
- 禁止用原生 SQL 字符串拼接代替 `sql` 模板。
- 禁止 schema、DTO、常量 / 枚举、migration 四层脱节。
- 禁止在 `db/schema` 中为 `inferSelect` / `inferInsert` 再套一层仅做改名的别名链，例如 `Foo = typeof foo.$inferSelect` 后再导出 `FooSelect = Foo`。

## 正反例

- 允许：`return this.drizzle.ext.findPagination(this.workTable, { pageIndex, pageSize, orderBy })`
- 允许：`await this.drizzle.withTransaction(async (tx) => { ... })`
- 允许：`viewCount: sql\`${this.table.viewCount} + 1\``
- 允许：闭集状态字段使用 `smallint().default(1).notNull()` 并补 `check(...)`
- 禁止：在 service 内自行创建新的数据库连接或 Drizzle 实例。
- 禁止：`db.execute('UPDATE ... ' + userInput)`
- 禁止：`where: flag ? { ...base, a } : other ? { ...base, b } : { ...base }`
- 禁止：schema 已改为数字枚举，但 DTO / 常量仍保留旧字符串值域。

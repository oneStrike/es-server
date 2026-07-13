# Drizzle 使用规范

适用范围：`libs/*` 与 `apps/*` 中使用 Drizzle ORM 的数据库操作，以及对应的 schema / migration 联动。

## TL;DR

- 何时看：改 Drizzle 查询、schema、migration、seed、bootstrap、分页 / 排序 / 原子更新时先看本篇。
- 必做：统一通过 `DrizzleService` 使用数据库能力；schema、DTO、常量/枚举、migration、RQB v2、relations 与 comments 同轮收敛；常规 migration append-only。
- 不要：使用 `drizzle-kit push`，不要把 seed 当 bootstrap，不要省略显式排序、新增数据库外键，或改写已有 migration。
- 最低验证：`pnpm type-check`、目标 DB integration，以及附录中的 migration/comments 检查入口。

本篇只定义 Drizzle 规则本身；命令入口与操作顺序统一收敛到 [07-drizzle-operations.md](./07-drizzle-operations.md)。

## 仓库约定

- 数据库能力统一通过注入的 `DrizzleService` 使用；不在业务层自行创建新的 Drizzle 实例。
- 版本精确固定为 `drizzle-orm@1.0.0-rc.4` 与 `drizzle-kit@1.0.0-rc.3`；不得以范围版本、未验证 Kit RC4 能力或旧 RQB API 代替当前 contract。
- canonical relations 唯一 owner 是 `db/core/drizzle-relations.ts`：`baseRelations` 必须最先展开，随后每个 domain relation part 恰好一次。所有 schema table 与 `db.query` key 必须一一对应。
- Node PostgreSQL client 使用 `drizzle({ client: pool, relations, jit: true })`。不得传入旧 `schema:` option、构造模块局部 relation 聚合或为 seed/script 另建不一致的 relations contract。
- `drizzle.db`、`drizzle.schema`、`buildPage(...)`、`buildOrderBy(...)`、`withTransaction(...)`、`withErrorHandling(...)` 等基础能力都属于这一入口。
- 闭集状态 / 类型 / 模式 / 角色字段默认使用 `smallint` / `smallint[]`，并同步补 `check(...)` 约束。
- 开放业务键继续保持字符串；不要为了“统一 smallint”而强行数字化。
- 常见例外包括 `eventKey`、`categoryKey`、`projectionKey`、`domain`、`packageMimeType`、模板键、路由键。
- DTO、常量 / 枚举、`db/schema` 中同一闭集值域必须同轮对齐；不能一层改成数字枚举，另一层仍保留旧字符串或不一致的数值范围。
- `db/schema/**/*.ts` 中导出的 Drizzle 推导类型统一使用 `XxxSelect = typeof table.$inferSelect`、`XxxInsert = typeof table.$inferInsert`。
- 不要额外导出 `Xxx = typeof table.$inferSelect` 这类无意义中间别名。

## 默认动作

- 查询表和关系表时，默认从 `this.drizzle.schema` 取用；查询语句在业务 owner 中显式使用 Drizzle query builder 表达。
- 事务默认通过 `db.transaction(async (tx) => ...)` 或 `drizzle.withTransaction({ execute: async (tx) => ... })` 启动，并沿调用链显式透传 `tx`。
- 常规分页默认在业务 service 中显式写出 `select`、`where`、`orderBy`、`limit`、`offset` 和 `$count`。
- 分页返回统一用 `toPageResult(...)` 组装。
- 分页统一采用 1-based `pageIndex`。
- 动态查询条件默认使用 `SQL[]` 收集，再通过 `and(...)` / `or(...)` 组合。
- Drizzle relational query 的对象式 `where` 存在多分支时，必须先用命名的基础条件和作用域条件配合 `if / else if` 线性构造；不要把多套条件对象塞进嵌套三元表达式。
- RQBv2 查询入口、`where`、`with` 与嵌套 relation options 必须保持 AST 可静态分析：禁止通过别名 options、简写属性、动态键或 spread 隐藏旧形状；`orderBy` 依照当前 RC 合同允许对象或回调，两者都不是 RQBv1 判据。
- RQB v2 仅负责 nested relation materialization。平面 read model、aggregate/window/CTE、lock、批量写与需要单 PostgreSQL statement 的分页 ID narrowing 使用 Core Query Builder 或参数化 `sql`；禁止因“统一 ORM”而把这些能力塞入 RQB。
- 排序字段必须显式声明；禁止依赖数据库返回“自然顺序”。

## select 字段投影

- 当查询需要表的**全部字段**时，使用 `db.select().from(table)` 简写；Drizzle 会自动展开为显式列名，类型安全不受影响。
- 当查询需要表的**大部分字段**（保留字段数 > 排除字段数）时，使用 `getColumns(table)` + 解构排除 + spread 透传，而非逐字段列举。
- 当查询只需要表的**少部分字段**（保留字段数 ≤ 排除字段数），或涉及跨表 join 需要精细选择不同表字段时，保持显式 `select({ ... })` 列举。
- 解构排除时，必须用注释说明排除原因分组（如“正文大字段”“审核管理字段”“内部控制字段”），方便后续维护者判断排除意图。
- 组装返回对象时，若源对象的字段与目标字段 1:1 同名透传，使用 spread（`...obj`）而非逐字段复制；仅对需要变换/覆盖/新增的字段显式写出。
- 同一表在同一 service 中被多处查询且字段投影相同时，将投影抽为 `buildXxxSelect()` 方法复用，避免重复列举。

## 查询与写路径

- `count`、余额、库存、计数器、乐观锁版本号等增减，必须使用原子更新并与事实写入位于同一事务。
- 0 行 update / delete 若业务语义是“目标不存在”，通过 `assertAffectedRows(...)` 或 `withErrorHandling(..., { notFound: ... })` 收口。
- 分页结果组装只允许复用薄的 `toPageResult(...)`。
- 分页查询、存在性判断、最大序号、交换字段、计数器增减等业务语义必须在 owner service 或领域方法中显式表达；不要再用通用 table/field helper 隐藏。
- 读路径需要补记浏览、日志、统计时，优先与主业务分离，并确保附带写入可降级。

## 原生 SQL

- 原生 SQL 仅允许通过 `` sql`...` `` 和 `db.execute(...)` 编写。
- 禁止字符串拼接 SQL。
- 使用原生 SQL 时必须说明原因，例如 Drizzle 表达能力不足、需要数据库原子表达式、需要复杂聚合或批量更新。
- 原生 SQL 中的分页、排序、where 条件、数组处理、JSON 处理仍要遵守本仓库的统一契约，不得各写一套。

## Schema 与 migration 联动

- 常规 schema 差异必须先生成 migration，再通过受控 check / migrate 入口执行；具体命令见 [07-drizzle-operations.md](./07-drizzle-operations.md)。`db:migrate` 要求显式 `mode active` 与 target，不存在无参数或 production 别名入口。
- 若生成过程中出现交互，必须停止并由用户亲自执行；不要替用户继续回答交互提示。
- 常规 migration 采用 append-only：只允许新建，不允许修改、删除或在已存在、已提交、已执行的 migration 文件中追加 DDL。
- 无法自动生成的 DDL 可手写补充，但必须说明原因、范围与风险。
- 字段改类型、改值域、改数组元素、改 JSON 内部枚举、改约束时，migration 必须同步处理历史数据；不能依赖清库、丢字段、跳过旧值或要求人工补数据。
- 修改 schema 注释后，必须同步刷新 `db/comments/generated.sql`，并通过受控注释检查入口确认生成结果 `Warnings: 0`。
- `db/schema`、migration、`db/comments/generated.sql` 三者必须同轮一致，不能只改其中一层。
- 本仓库数据库层禁止使用数据库外键。
- `db/schema` 与手写 migration 都不得新增 `references(...)`、`foreign key` 或 `alter table ... add constraint ... foreign key`。
- Drizzle relations 只用于查询组织与类型推导，不代表数据库约束。
- 禁止使用 `drizzle-kit push`、`drizzle-kit push --force` 或重新引入 `db:push` 作为迁移路径；所有结构变更必须落为可审计 migration。
- 生产迁移脚本只负责 migration 与注释同步，不得在全新数据库上自动执行 seed。

## Seed 与 bootstrap

- `db/seed` 是本地 demo/联调用的破坏性数据脚本，包含清理演示数据、固定演示账号、演示 token 等行为；只能通过附录列出的受控 demo seed 入口显式执行。
- 执行 demo seed 前必须先通过环境检查，并显式设置 `ALLOW_DB_SEED=true`；`NODE_ENV=production/prod` 或目标库名、主机名、用户名命中生产危险关键字时必须失败。
- 生产或准生产初始化只允许使用附录列出的 bootstrap 入口；bootstrap 不得复用 demo seed，不得创建固定 token，不得内置固定生产密码。
- 初始化管理员账号时必须由操作员提供 `BOOTSTRAP_ADMIN_USERNAME` 与 `BOOTSTRAP_ADMIN_PASSWORD`。
- bootstrap 只能创建缺失账号，不得静默重置已有账号密码。

## Canonical contract 与破坏性更新

- 破坏性更新必须让 `db/schema`、relations、comments、相关常量/枚举、DTO、service/resolver/controller、OpenAPI 与验证同轮收敛。
- 禁止只改表、不改接口合同。
- 禁止只改 DTO / 常量、不改底层持久化值域。
- 禁止保留临时双读、双写、旧值 fallback、旧字符串映射、旧 ORM API 或旧 migration-log 解释器。
- 未被有效决策覆盖的 schema 破坏性变化必须先形成新的显式决策。

## 禁止项

- 禁止在业务层直接 new Drizzle 或绕开 `DrizzleService` 访问数据库。
- 禁止重新引入 RQB v1 callback/filter shape、`schema:` 初始化、局部 relations 聚合、旧 Drizzle extension/shim，或为迁移期保留任何 ORM API fallback。
- 禁止隐式事务；事务上下文必须显式透传。
- 禁止分页不写排序字段。
- 禁止新增或继续使用 `drizzle.ext`、`@db/extensions`、通用 table/field 字符串 helper、shim 或 deprecated ext 入口。
- 禁止在 Drizzle 查询参数中用嵌套三元表达式构造 `where`、`orderBy` 或字段投影；多分支条件必须改成命名变量、`if / else if`、`SQL[]` 条件数组或已有扩展能力。
- 禁止把闭集业务值域留在 `varchar` / `integer[]` 中继续漂移。
- 禁止用原生 SQL 字符串拼接代替 `sql` 模板。
- 禁止 schema、DTO、常量 / 枚举、migration 四层脱节。
- 禁止新增数据库外键或把 Drizzle relations 误写成数据库 FK 约束。
- 禁止绕过 `db:migration:check` 直接迁移。
- 禁止删除、改写或移动已存在、已提交或已执行的 migration。
- 禁止 `--ignore-conflicts`、旧 migration fallback、reconcile/rollback helper 或普通 `pnpm check` 隐式触发写入。
- 禁止在生产迁移中自动 seed 或执行 demo 数据清理。
- 禁止在 `db/schema` 中为 `inferSelect` / `inferInsert` 再套一层仅做改名的别名链。
- 禁止在 select 或返回对象组装中逐字段列举全部同名字段；应使用 spread 或 `getColumns` + 解构排除。
- 禁止在 spread 之后重复写出已在 spread 中包含的同名字段（如 `...item, geoCountry: item.geoCountry`）。

## 正反例

- 允许：分页查询显式写 `where`、`orderBy`、`limit`、`offset` 和 `$count`，最后用 `toPageResult(...)` 组装返回。
- 允许：`await this.drizzle.withTransaction({ execute: async (tx) => { ... } })`
- 允许：`viewCount: sql\`${this.table.viewCount} + 1\``
- 允许：闭集状态字段使用 `smallint().default(1).notNull()` 并补 `check(...)`
- 允许：`db.select().from(table)` — 查询全表字段时使用简写
- 允许：`const { html, content, body, ...rest } = getColumns(table); db.select({ ...rest }).from(table)` — 排除少量字段时用 getColumns 解构
- 允许：`return { ...topic, liked: map.get(topic.id) ?? false }` — 同名字段 spread 透传 + 仅写出变换字段
- 禁止：在 service 内自行创建新的数据库连接或 Drizzle 实例。
- 禁止：`db.execute('UPDATE ... ' + userInput)`
- 禁止：`where: flag ? { ...base, a } : other ? { ...base, b } : { ...base }`
- 禁止：schema 已改为数字枚举，但 DTO / 常量仍保留旧字符串值域。

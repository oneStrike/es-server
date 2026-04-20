# Drizzle 使用规范

适用范围：`libs/*` 与 `apps/*` 中使用 Drizzle ORM 的数据库操作。

## 核心原则

- 统一通过 `DrizzleService` 使用 `drizzle.db`、`drizzle.schema`、`drizzle.ext`。
- 事务通过 `db.transaction(async (tx) => ...)` 并沿链路显式透传。
- 闭集状态 / 类型 / 模式字段默认使用 `smallint` / `smallint[]`，并同步补 `check(...)` 约束。
- 若 DTO / 常量层已经收敛为数字枚举，但 `db/schema` 仍使用 `integer`、`varchar` 或 `integer[]`，视为规范违例，应在同轮改造中统一。
- 开放业务键继续保持字符串，不为"统一 smallint"而强行数字化；典型例外包括 `eventKey`、`categoryKey`、`projectionKey`、`domain`、`packageMimeType`、弹窗位置等。

## 查询与分页

- 常规分页使用 `drizzle.ext.findPagination(...)`。
- 分页统一 1-based `pageIndex`。
- 动态条件使用 `SQL[] + and(...)`。
- 排序字段必须显式声明。

## 写路径与原生 SQL

- 计数、余额、库存等增减使用原子更新并与事实写入同事务。
- 原生 SQL 仅允许 `sql\`...\``与`db.execute`，禁止字符串拼接。

## Migration 规范

- 常规 schema 差异默认使用 `pnpm db:generate` 生成。
- 若生成过程中出现交互，必须停止并由用户亲自执行。
- migration 只允许新建，不允许在已存在、已提交或已执行的 migration 文件中继续追加新 DDL；发现迁移范围变化时，必须新建后续增量 migration。
- 无法生成的 DDL 可手写补充，但必须说明原因、范围与风险。
- 当任务明确要求手写 migration 时，不应再把 `pnpm db:generate` 当作默认路径；交付说明中必须写清手写 migration 的映射关系、破坏性范围与风险。
- migration 必须显式处理历史数据：字段改类型、改值域、改约束、改数组元素、改 JSON 内部枚举时，都要在 migration 中完成历史数据刷值，不允许依赖丢弃历史数据、清空字段、跳过旧值或要求人工自行清库。
- 即使业务代码按"破坏性更新 / 无兼容层"执行，migration 仍必须保证历史数据可被迁移到新结构；"不做兼容层"不等于"允许丢历史数据"。
- 修改 schema 注释后，必须同步刷新 `db/comments/generated.sql`，并确保生成结果 `Warnings: 0`。
- `db/schema`、手写 / 生成 migration、`db/comments/generated.sql` 三者必须同轮一致，不能只改其中一层。

## 破坏性更新联动规范

- 当任务明确声明"破坏性更新 / 不做兼容层"时，`db/schema`、相关常量 / 枚举、DTO、service / resolver / controller、前端破坏性更新文档必须同轮改完。
- 禁止只改表、不改接口合同。
- 禁止只改 DTO、不改底层持久化值域。
- 禁止保留临时双读、旧值 fallback、旧字符串兼容映射，除非任务明确要求兼容期。
- 若改动同时影响 `admin` 和 `app` 前端，破坏性更新说明应拆成两份独立文档，避免一份文档混合承载两类客户端影响。

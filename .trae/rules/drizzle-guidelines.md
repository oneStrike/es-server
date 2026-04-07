# Drizzle 使用规范（项目级）

适用范围：本仓库所有 Service、Resolver、Worker 中对 Drizzle 的使用。

## 1. 核心原则

- 统一通过 `DrizzleService` 使用 `drizzle.db`、`drizzle.schema`、`drizzle.ext`，不新增 Prisma 风格入口。
- 若规范与当前稳定返回契约、异常语义、分页语义或重试语义冲突，以当前实现为准，并在交付说明中记录冲突点。

## 2. 数据库入口与事务

- 表对象必须来自 `drizzle.schema`，禁止在 service 内重新声明表结构。
- 写操作统一通过 `drizzle.withErrorHandling(...)` 或等价事务封装；依赖原始 PostgreSQL 错误码做重试、幂等或冲突分支的路径除外。
- 非事务写路径若语义上必须保证资源存在的 update/delete，优先使用 `drizzle.withErrorHandling(..., { notFound: '...' })` 一次性收口异常语义；幂等删除等允许 0 行变更的场景除外。
- 事务内、计数器 helper、或其他不直接经过 `withErrorHandling(...)` 的写路径，继续在写后调用 `drizzle.assertAffectedRows(...)`。
- 事务统一使用 `db.transaction(async (tx) => ...)` 或等价封装，并沿调用链显式透传；禁止 `tx: any` 和接收事务后仍偷偷使用默认 `db`。

## 3. 查询与分页

- 常规单表、单源分页统一使用 `drizzle.ext.findPagination(...)`；复合分页使用专用 helper，但不得改动既有结果语义。
- 分页统一沿用 1-based `pageIndex` 语义，禁止在业务层再次换算。
- 动态条件统一使用 `SQL[] + and(...)`；无条件时传 `where: undefined`。
- 存在性校验优先使用 `drizzle.ext.exists/existsActive`，避免重复查询。
- 排序字段必须显式声明；非法排序字段或方向直接报错，不静默降级。
- 同一列表查询的 `select` 投影、`count` 策略、关系联表和排序策略应优先收敛到命名清晰的 helper；不要在多个分支里复制近似 SQL 片段。
- 当 query builder 分支已经包含多行 `select/from/join/where/orderBy` 逻辑时，不再使用长三元表达式承载分支语义，改为私有查询方法或显式 helper。
- `count` 查询只在过滤条件或结果语义确实依赖关联表时才联表，避免为了与列表查询保持“形似”而做无效 join。

## 4. 写路径与原生 SQL

- 计数、余额、库存等增减使用原子更新，并与事实写入保持在同一事务中。
- 原生 SQL 仅允许 `sql\`...\`` 与 `db.execute`；禁止字符串拼接 SQL。
- `sql.raw()` 只能注入白名单常量，禁止拼接任何用户输入。
- 复杂 SQL 必须下沉到业务模块内的 query helper 或私有查询方法。
- ORM 能表达的单表或常规聚合查询，优先使用 `db.query`、`select/from/where` 等正式接口。

## 5. Resolver 与异常

- Resolver 统一注入 `DrizzleService` 或上层 Service，不继承 Prisma 基类。
- 列表型 Resolver 必须批量拉取详情，禁止逐条触发数据库查询。
- 业务校验失败抛 Nest 明确异常，禁止 `throw new Error` 直接暴露通用异常。
- 允许失败的流程必须记录结构化日志，不能静默吞错。

## 6. 命名与收敛

- relations 命名必须区分“目标实体集合”和“中间表记录集合”，避免裸复数名歧义。
- 收敛旧代码时优先替换数据库入口、事务透传、存在性校验、常规分页和 SQL 安全问题，不顺手改动对外契约。
- 共享投影、状态映射和回写字段集合应使用命名明确的 helper 收口，避免同一业务语义散落在多个对象字面量或条件分支中。
- 需要模板或常见写法时，查看 `../references/DRIZZLE_RECIPES.md`。

## 7. Schema 注释规范

- 表定义文件中，每个字段必须有注释，且描述应包含业务语义，不得只写“字段名同义重复”。
- 字段注释应尽量补齐：取值范围/枚举含义、单位、默认值语义、可空语义、是否软删除或内部字段。
- 派生缓存字段（如解析 token、冗余计数快照）必须在注释中明确：
  - 源字段或来源流程；
  - 是否可重建；
  - `null` 与空值的语义差异。
- 新增或变更字段时，必须同步更新对应 DTO/类型文档注释，避免“表语义与接口语义”漂移。

## 8. Migration 规范

- 所有迁移文件必须只通过 `pnpm db:generate` 生成，禁止手动创建、手动补写或手动修改 migration 文件内容。
- 如果 `pnpm db:generate` 过程中出现任何交互式确认、重命名选择或冲突选择，必须立即停止任务，并由用户亲自在终端执行该命令并完成交互。
- 禁止使用 `drizzle-kit generate --custom`、空白 migration 骨架后手写 SQL、或任何绕过 `pnpm db:generate` 的方式生成迁移。
- 若当前任务因迁移生成交互而阻塞，交付说明中必须明确说明阻塞点，并等待用户执行生成命令后再继续后续步骤。

## 9. 验收清单

- [ ] 代码中不存在 Prisma 风格入口、`tx: any` 或忽略传入事务的写法。
- [ ] 写操作统一经过 `withErrorHandling` 或等价事务封装；必须保证资源存在的非事务写路径优先使用 `withErrorHandling(..., { notFound })`，其余路径使用 `assertAffectedRows`。
- [ ] 常规分页走 `ext.findPagination`，复合分页没有顺手改坏既有语义。
- [ ] 原生 SQL 已参数化并下沉到 helper/私有方法，没有用户输入进入 `sql.raw()`。
- [ ] 计数或其他增减写路径使用原子更新，并和事实写入保持事务一致。
- [ ] 涉及 `db/schema` 的改动中，所有新增/变更字段都已补充完整注释。
- [ ] 派生缓存字段注释已声明来源、可重建性与空值语义。
- [ ] 迁移文件仅通过 `pnpm db:generate` 生成；若出现交互，已由用户亲自执行并完成。
- [ ] 相关改动已通过 `eslint` 与 `type-check`。

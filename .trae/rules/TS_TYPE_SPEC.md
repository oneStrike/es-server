# 项目 TypeScript 类型定义规范

适用范围：本仓库所有非 DTO 的 TypeScript 类型定义，包括 `db/schema` 推导类型、`db/core` 类型工具与 `libs/*/*.type.ts` 内部领域类型。

## 1. 核心原则

- 实体字段名、字段类型、可空性以 `db/schema` 与 `$inferSelect/$inferInsert` 为准。
- 业务场景契约优先复用 `libs/*` DTO；Service 公开方法入参与出参与 DTO 保持 1:1。
- 与 DTO 同构的 `Input/View` 类型不重复定义，直接使用 DTO。
- `*.type.ts` 仅承载内部领域结构（非 HTTP 契约），包括 Service 内部聚合结果、快照、上下文与数据库投影。
- 纯类型依赖统一使用 `import type`。

## 2. 放置规范

- `db/schema`：表对象旁统一导出 `Xxx` 与 `XxxInsert`，并通过 `@db/schema` 聚合导出。
- `db/core`：数据库入口、事务别名、类型工具与泛型约束；禁止 `tx: any`。
- `libs/*`：场景 DTO 与内部领域类型并存。
- `apps/*`：不重复定义同构查询/请求/响应类型，仅消费 `libs/*` 契约。
- 新增 Service 内部业务类型文件默认使用 `*.type.ts`；历史 `*.types.ts` 不要求批量迁移。

## 3. 命名规范

- 数据库读模型：`Xxx`；插入模型：`XxxInsert`。
- 内部领域类型：`XxxContext`、`XxxPayload`、`XxxSnapshot`、`XxxAggregation`、`XxxRow`、`XxxResult`。
- 业务类型不使用 `I` 前缀或 `Interface` 后缀（历史公共契约除外）。

## 4. 构建规则

- Service 公开方法签名与 DTO 1:1，不维护平行镜像 interface。
- Query 方法签名与 Query DTO 1:1，禁止“DTO 多字段、方法少字段”或反向偏差。
- 仅当结构不属于 HTTP 契约时，才在 `*.type.ts` 新增对象类型；Service 内部非 DTO 结构统一在 `*.type.ts` 收敛。
- 禁止为基础类型、平台基础类型或仅换名不增义的类型新增别名，例如 `type XxxDate = string`、`type XxxOrderBy = QueryOrderByInput`；直接使用原类型。
- 字段来源明确时优先复用 `Entity['field']`、`Pick<Entity, ...>`、`Omit<Entity, ...>`、`Partial<...>`。
- `Create/Update` 内部类型不要暴露只读字段、审计字段、统计字段。
- 分页查询统一沿用 `pageIndex`、`pageSize`、`orderBy`，其中 `pageIndex` 为 1-based。
- SQL 投影、聚合结果、原生 SQL 结果必须有显式类型，不用裸 `Record<string, unknown>` 描述稳定结构。
- 弱结构 JSON 使用 `unknown` 或 `Record<string, unknown>`；禁止 `any`、`as any`、`tx: any`。
- 方法返回类型默认依赖 TypeScript 推导，仅在公共契约稳定或推导不准确时显式标注。

## 5. 导入与注释

- 优先使用 `@db/schema`、`@db/core`、`@libs/*` 等路径别名。
- 避免从深层 service 文件反向导出类型，优先从模块类型文件或 schema barrel 导出。
- 类型文件避免引入运行时循环依赖。
- 导出的公共内部类型应补充一句用途说明。

## 6. 现状例外

- 历史 `*.types.ts`、`AppConfigInterface`、`JwtUserInfoInterface` 可继续沿用。
- 迁移窗口内允许短期保留镜像类型，但必须在同一迭代回收。

## 7. 验收清单

- [ ] `db/schema` 推导类型与表对象放在同一文件维护。
- [ ] Service 公开方法签名与 DTO 契约 1:1。
- [ ] Query 方法签名与 Query DTO 1:1。
- [ ] 未新增与 DTO 同构的重复 `Input/View` 类型，直接使用 DTO。
- [ ] 未新增对基础类型、平台基础类型或仅换名不增义类型的语义空转别名。
- [ ] 新增 Service 内部业务类型优先使用 `*.type.ts`。
- [ ] 字段类型优先复用实体字段类型或既有类型组合。
- [ ] 查询类型沿用 `pageIndex/pageSize/orderBy` 约定。
- [ ] SQL/聚合结果有显式类型，未新增 `any`、`tx: any` 等类型逃逸。

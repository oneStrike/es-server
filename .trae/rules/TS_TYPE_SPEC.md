# 项目 TypeScript 类型定义规范

适用范围：本仓库所有非 DTO 的 TypeScript 类型定义，包括 `db/schema` 推导类型、`db/core` 类型工具、`libs/*` 领域类型和 `apps/*` 应用侧 `*.type.ts`。

## 1. 核心原则

- 实体字段名、字段类型、可空性优先以 `db/schema` 表定义及其 `$inferSelect`、`$inferInsert` 为准。
- Controller 接收 DTO；Service、Resolver、Worker 使用 Drizzle 推导类型或模块内 `*.type.ts`，不直接下沉 apps 层 DTO。
- 优先使用 `Pick`、`Omit`、`Partial`、索引访问类型复用字段，避免手写同构结构。
- 纯类型依赖统一使用 `import type`。
- 若规范与当前稳定抽象冲突，以当前实现为准，并在交付说明中记录冲突点。

## 2. 放置规范

- `db/schema`：表对象旁统一导出 `Xxx` 与 `XxxInsert`，并通过 `@db/schema` 聚合导出。
- `db/core`：数据库入口、事务别名、类型工具与泛型约束；禁止 `tx: any`。
- `libs/*`：可复用领域输入、输出、视图、上下文、查询条件与聚合结果，优先放在模块自己的 `*.type.ts`。
- `apps/*`：仅供当前应用编排层使用的场景类型，不反向下沉为通用领域契约。
- 新增业务领域类型文件默认使用 `*.type.ts`；既有平台层或基础设施 `*.types.ts` 不要求批量重命名。

## 3. 命名规范

- 数据库读模型：`Xxx`；插入模型：`XxxInsert`。
- 领域输入：`CreateXxxInput`、`UpdateXxxInput`、`DeleteXxxInput`、`QueryXxxInput`、`QueryXxxPageInput`、`XxxIdInput`、`XxxContext`、`XxxTx`。
- 输出与聚合结果：`XxxView`、`XxxRow`、`XxxResult`、`XxxPayload`。
- 业务类型不使用 `I` 前缀或 `Interface` 后缀；既有公共基础契约例外。

## 4. 构建规则

- Service 方法签名不直接使用 apps 层 DTO。
- 字段来源明确时优先复用 `Entity['field']`、`Pick<Entity, ...>`、`Omit<Entity, ...>`、`Partial<...>`。
- `Create/Update` 输入不要暴露只读字段、审计字段、统计字段。
- 分页查询统一沿用 `pageIndex`、`pageSize`、`orderBy`，其中 `pageIndex` 为 1-based。
- 方法返回类型遵循“非必要不显式声明”原则，优先依赖 TypeScript 类型推导；仅在公共契约稳定、跨模块可读性或推导不准确时再显式标注返回类型。
- SQL 投影、聚合结果、原生 SQL 结果必须有显式类型，不用裸 `Record<string, unknown>` 描述稳定结构。
- 弱结构 JSON 使用 `unknown` 或 `Record<string, unknown>`；禁止 `any`、`as any`、`tx: any`。
- 时间字段仅在确有跨层转换需求时放宽为 `string | Date`。
- 组合、联合、别名优先使用 `type`；稳定对象契约优先使用 `interface`。

## 5. 导入与注释

- 优先使用 `@db/schema`、`@db/core`、`@libs/*` 等路径别名。
- 避免从深层 service 文件反向导出类型，优先从模块类型文件或 schema barrel 导出。
- 类型文件避免引入运行时循环依赖。
- 导出的公共类型应补充一句用途说明。

## 6. 现状例外

- 既有 `*.types.ts`、`AppConfigInterface`、`JwtUserInfoInterface` 等历史命名继续沿用，不要求批量迁移。
- 历史宽泛中间类型只在当前路径被修改且不改变行为时再逐步收敛。

## 7. 验收清单

- [ ] `db/schema` 的推导类型与表对象放在同一文件维护。
- [ ] Service 方法签名未直接依赖 apps 层 DTO。
- [ ] 新增业务领域类型文件优先使用 `*.type.ts`。
- [ ] 字段类型优先复用实体字段类型或现有领域类型。
- [ ] 创建/更新类型未复制整份实体字段，已优先使用 `Pick/Omit/Partial` 组合。
- [ ] 查询类型沿用 `pageIndex/pageSize/orderBy` 约定。
- [ ] 方法返回类型默认依赖 TypeScript 推导，仅在必要场景显式标注。
- [ ] SQL/聚合结果有显式类型，未新增 `any`、`tx: any` 等类型逃逸。

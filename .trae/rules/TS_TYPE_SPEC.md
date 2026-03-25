# 项目 TypeScript 类型定义规范

适用范围：本仓库所有非 DTO 的 TypeScript 类型定义，包括 `db/schema` 的 Drizzle 推导类型、`db/core` 类型工具、`libs/*` 领域类型文件、`apps/*` 应用侧 `*.type.ts`，以及少量既有 `*.types.ts` 基础设施文件。

说明：

- DTO、校验器、Swagger 输出模型仍以 `.trae/rules/DTO_SPEC.md` 为准。
- 本文件关注“领域类型、查询类型、事务类型、聚合结果类型、基础设施契约”的定义方式，不替代 DTO 规范。

## 1. 目标与原则

- **单一事实源**：实体字段名、字段类型、可空性优先以 `db/schema` 的 Drizzle Table 与其 `$inferSelect/$inferInsert` 为准。
- **分层隔离**：Controller 接收 DTO，Service 与领域逻辑使用 Drizzle 推导类型或模块内 `*.type.ts` 类型，不直接下沉 apps 层 DTO。
- **最小表达**：优先通过 `Pick`、`Omit`、`Partial`、索引访问类型复用现有类型，避免重新手写同构对象。
- **语义清晰**：类型名称要直接表达用途，例如 `CreateXxxInput`、`QueryXxxInput`、`XxxView`、`XxxRow`。
- **类型和值分离**：纯类型依赖统一使用 `import type`，避免把运行时代码和类型依赖混在一起。
- **现状优先**：若规范与仓库现有可运行抽象冲突，以当前实现和稳定调用链为准，并在变更说明中明确记录冲突点。

## 2. 范围与边界

### 2.1 覆盖范围

- `db/schema/**/*.ts` 中表对象旁的推导类型。
- `db/core/**/*.type.ts`、`db/extensions/**/*.ts` 中的数据库类型工具与泛型约束。
- `libs/**/src/**/*.type.ts` 中的领域输入、输出、上下文、查询条件与聚合结果类型。
- `apps/**/src/**/*.type.ts` 中仅供当前应用编排层使用的场景类型。
- `libs/platform`、基础设施模块中已存在的 `*.types.ts` 契约文件。

### 2.2 非目标

- 不在类型文件中编写校验器、Swagger 装饰器或 class DTO。
- 不在类型文件中承载业务流程、数据库查询或运行时转换逻辑。
- 不为了“类型统一”把已有稳定 DTO、Service 返回结构或数据库契约改坏。

## 3. 分层放置规范

### 3.1 `db/schema`：表对象与推导类型的唯一来源

- 每个 schema 文件在导出表对象后，统一导出：
  - `export type Xxx = typeof xxx.$inferSelect`
  - `export type XxxInsert = typeof xxx.$inferInsert`
- `Xxx` 表示数据库读模型，`XxxInsert` 表示插入模型。
- 推导类型必须和表定义放在同一文件中维护，不额外复制到 `libs/*` 或 `apps/*`。
- `db/schema/index.ts` 统一聚合导出，业务层优先从 `@db/schema` 引用。

### 3.2 `db/core`：数据库抽象与类型工具层

- 数据库入口、事务别名、where 树、泛型约束等基础设施类型放在 `db/core/*.type.ts` 或相邻基础设施文件中维护。
- 此层类型可以直接依赖 Drizzle 官方类型，例如 `SQL`、`PgTable`、`NodePgDatabase`。
- 事务类型必须有明确别名，例如 `Db`、`InteractionTx`，禁止使用 `tx: any`。

### 3.3 `libs/*`：可复用领域类型层

- 领域服务稳定复用的输入、输出、视图、上下文、查询条件，统一放在模块自己的 `*.type.ts` 中。
- 领域类型文件应靠近使用它的 service、resolver、worker，避免跨域建立“公共大类型仓库”。
- 同一模块出现多处稳定类型时，优先集中到一个 `xxx.type.ts` 文件，避免散落在多个 service 文件中。

### 3.4 `apps/*`：应用编排层场景类型

- admin/app 专属的筛选条件、编排入参、复用下层服务输入的应用侧类型，可放在模块自己的 `*.type.ts`。
- apps 层类型只服务当前应用边界，不反向下沉到 `libs/*` 成为通用领域契约。
- apps 层若只是“对下层类型删掉一个字段再补一个字段”，优先使用 `Omit`、`Pick`、继承等方式复用。

### 3.5 `*.type.ts` 与 `*.types.ts` 的使用边界

- 新增业务领域类型文件默认使用单数命名：`xxx.type.ts`。
- `*.types.ts` 仅用于以下场景：
  - 平台层、基础设施层、配置层已经形成既有命名。
  - 单文件内承载多个底层契约，且该文件不是单一业务模块入口。
  - 历史文件已广泛被引用，当前任务不涉及重命名。
- 不为了形式统一而批量重命名现有 `*.types.ts` 文件。

## 4. 命名规范

### 4.1 数据库推导类型

- 读模型：`Work`、`AppUser`、`ForumTopic`
- 写模型：`WorkInsert`、`AppUserInsert`

### 4.2 领域输入类型

- 创建：`CreateXxxInput`
- 更新：`UpdateXxxInput`
- 删除/主键定位：`DeleteXxxInput`、`XxxIdInput`
- 状态变更：`UpdateXxxStatusInput`、`UpdateXxxEnabledInput`
- 查询：`QueryXxxInput`、`QueryXxxPageInput`
- 选项：`XxxOptions`
- 上下文：`XxxContext`
- 事务：`XxxTx`

### 4.3 领域输出与聚合结果类型

- 视图对象：`XxxView`
- SQL/聚合结果行：`XxxRow`、`XxxTotalRow`
- 结果对象：`XxxResult`
- 载荷：`XxxPayload`
- 作用域/路由键：`XxxScope`、`XxxRouteKey`

### 4.4 接口命名约束

- 业务模块中的类型命名不使用 `I` 前缀。
- 业务领域类型一般不使用 `Interface` 后缀。
- 仅在平台配置、公共基础契约或已有稳定命名中，沿用 `AppConfigInterface`、`JwtUserInfoInterface` 这类 `Interface` 后缀。

## 5. 类型构建规则

### 5.1 优先复用实体字段类型

- 当字段来源明确时，优先使用索引访问类型，例如：
  - `nickname?: AppUser['nickname']`
  - `status: ForumTopic['auditStatus']`
- 当一组字段与实体字段完全一致时，优先使用：
  - `Pick<Entity, 'a' | 'b'>`
  - `Partial<Pick<Entity, 'a' | 'b'>>`
  - `Pick<Entity, 'id'> & Partial<...>`

### 5.2 `Create` / `Update` 的推荐形态

- 创建入参优先由“必填字段 Pick + 可选字段 Partial<Pick<...>>”组成。
- 更新入参优先写成“主键 Pick + 可写字段 Partial<Pick/Omit<...>>”。
- 如果创建和更新之间高度相似，可让更新类型复用创建类型，例如：

```ts
export type UpdateXxxInput = Pick<Xxx, 'id'> &
  Partial<Omit<CreateXxxInput, 'immutableField'>>
```

- 不要把数据库只读字段、审计字段、统计字段直接暴露进 `Create/Update` 输入。

### 5.3 查询类型

- 常规查询类型使用 `QueryXxxInput` 或 `QueryXxxPageInput` 命名。
- 分页参数统一沿用 `pageIndex`、`pageSize`、`orderBy`，语义与 `PageDto`、`findPagination` 保持一致，其中 `pageIndex` 统一为 1-based。
- 不在业务类型里自造 `page`、`limit`、`offset`、`sortField` 这一套新命名，除非对接外部协议且无法改动。
- 当某个查询只是对公共分页查询删掉内部字段时，优先使用 `Omit<...>` 复用。

### 5.4 聚合结果与 SQL 结果

- 原生 SQL、`select` 投影、聚合统计结果必须定义明确类型，例如 `PurchasedWorkRow`、`PurchasedWorkTotalRow`。
- 保持返回值和数据库真实结果一致：
  - `COUNT(*)::bigint` 对应 `bigint`
  - 明确转成 `::int` 时可定义为 `number`
- 不使用裸 `Record<string, unknown>` 描述稳定的查询结果结构。

### 5.5 JSON、开放载荷与弱结构字段

- 结构未知但确实需要透传时使用 `unknown`。
- JSON 对象且字段不稳定时使用 `Record<string, unknown>` 或 `Record<string, unknown> | null`。
- 禁止为了省事直接使用 `any`。

### 5.6 日期时间字段

- 完全跟随数据库实体时，直接复用实体字段类型。
- 跨层输入需要同时接受 controller 传入字符串和 service 内部 `Date` 时，可使用 `Date | string | null` 或 `Date | string`。
- 仅在确有跨层转换需求时才放宽为 `string | Date`，不要默认所有时间字段都写成联合类型。

### 5.7 字符串字面量联合

- 小范围、稳定、与业务语义强绑定的值域，优先用字符串字面量联合，例如：
  - `type AdminAppUserDeletedScope = 'active' | 'deleted' | 'all'`
- 枚举已在常量层稳定存在时，优先复用枚举类型而不是重复写联合字面量。

## 6. `interface` 与 `type` 的选择规范

### 6.1 优先使用 `type` 的场景

- 需要 `Pick`、`Omit`、`Partial`、交叉类型、联合类型、索引访问类型组合时。
- 只是某个已有类型的别名时。
- 事务别名、路由键、作用域、主键输入、状态输入等轻量类型时。

### 6.2 优先使用 `interface` 的场景

- 需要表达一个独立、稳定、可直接阅读的对象结构时。
- 需要 `extends` 复用已有对象契约时。
- 结果对象、视图对象、配置对象、上下文对象、Options 对象等结构性契约时。

### 6.3 一致性要求

- 同一文件内如无明显收益，不要对同一类语义在 `interface` 和 `type` 之间来回切换。
- “组合型别名用 `type`，稳定对象契约用 `interface`”是本仓库默认口径。

## 7. 导入导出规范

- 纯类型引用统一使用 `import type`。
- 仓库内优先使用路径别名：
  - `@db/schema`
  - `@db/core`
  - `@libs/*`
- 避免从深层 service 文件反向导出类型，优先从模块类型文件或 schema barrel 导出。
- 类型文件不要因为复用方便而引入运行时循环依赖。

## 8. 注释与可读性规范

- `*.type.ts`、`*.types.ts` 中每个导出的公共类型都应补充简短注释。
- 注释至少说明：
  - 该类型服务的场景
  - 关键字段语义或与上游/下游的关系
- 推荐格式：

```ts
/**
 * APP 用户资料更新入参。
 * 用于管理端资料维护，只暴露允许修改的字段。
 */
export interface UpdateAdminAppUserProfileInput {
  // ...
}
```

- 注释应简洁，不重复字段名本身已经表达清楚的信息。

## 9. 禁止与不推荐写法

- 禁止在 Service 方法签名中直接使用 apps 层 DTO。
- 禁止在 `*.type.ts` 中加入 class、装饰器、校验逻辑、数据库查询逻辑。
- 禁止把可从实体类型推导出的字段重新手写成宽泛原始类型，例如把 `AppUser['status']` 改写成裸 `number`。
- 禁止新增 `any`、`as any`、`tx: any` 这类类型逃逸。
- 不推荐复制一整份实体字段来定义 `Create/Update`，优先通过组合构造。
- 不推荐在业务领域中新增含糊命名，例如 `Data`、`Params`、`Info`；优先用 `Input`、`View`、`Row`、`Result` 等语义化后缀。

## 10. 现状例外与冲突处理

### 10.1 `*.types.ts` 既有文件

当前仓库已存在一批 `*.types.ts` 文件，主要分布在：

- `libs/platform/src/**/*`
- `libs/growth/src/growth-ledger/growth-ledger.types.ts`
- `libs/content/src/permission/content-permission.types.ts`
- `libs/message/src/notification/notification-websocket.types.ts`
- `libs/moderation/sensitive-word/src/sensitive-word.types.ts`
- `apps/admin-api/src/common/decorators/audit.types.ts`

这些文件反映的是当前实现现状，不要求为了满足本规范而批量改名。

### 10.2 `Interface` 后缀的既有公共契约

- `libs/platform/src/types/index.ts` 中已有 `AppConfigInterface`、`JwtUserInfoInterface`、`AuthConfigInterface`。
- 这类基础设施/公共配置契约继续沿用既有命名，不强制迁移为 `type` 或移除 `Interface` 后缀。

### 10.3 历史服务中的宽泛中间结构

- 个别旧 service 仍会使用 `Record<string, unknown>` 组装 update payload。
- 若当前任务只是业务修复，不要求顺手重构全部中间结构；只有在修改该路径且不会改变行为时，才逐步收敛为更精确的局部类型。

## 11. 设计与实现流程

1. 先定位类型属于哪一层：`db/schema`、`db/core`、`libs/*`、`apps/*`。
2. 找到对应实体、现有 `*.type.ts`、相邻 service 和 DTO 的既有模式。
3. 优先从 Drizzle 推导类型与现有领域类型复用字段。
4. 只在现有类型无法准确表达语义时新增类型。
5. 补齐类型注释，并检查是否应使用 `import type`。
6. 复查命名是否直接表达场景，而不是留下含糊缩写。

## 12. 验收清单

- [ ] `db/schema` 中的推导类型与表对象放在同一文件维护。
- [ ] Service 方法签名未直接依赖 apps 层 DTO。
- [ ] 新增业务领域类型文件优先使用 `*.type.ts`。
- [ ] 字段类型已优先复用 `@db/schema` 实体字段或已有领域类型。
- [ ] 创建/更新类型未复制整份实体字段，已优先使用 `Pick/Omit/Partial` 组合。
- [ ] 查询类型的分页字段沿用 `pageIndex/pageSize/orderBy` 约定。
- [ ] SQL/聚合结果已使用显式 `XxxRow/XxxTotalRow` 等类型表达。
- [ ] 纯类型依赖已使用 `import type`。
- [ ] 未新增 `any`、`tx: any`、无意义的宽泛类型逃逸。
- [ ] 每个公共导出类型已补充用途说明。

# 项目 DTO 规范

## 1. 目标与原则

- **高复用**：字段优先通过继承与映射类型复用，避免重复定义。
- **低耦合**：DTO 只负责数据传输、输入校验与文档描述，Service 不直接依赖 apps 层 DTO。
- **单一事实源**：实体字段与物理约束以 Drizzle Table 为准。
- **契约优先**：DTO 是应用边界和 OpenAPI 契约，不机械等同于数据库表结构。
- **类型安全**：领域层优先使用 Drizzle 推导类型与稳定的领域输入类型。

## 2. 范围与边界

### 2.1 覆盖范围

- `libs/*` 中的领域基类 DTO。
- `apps/admin-api`、`apps/app-api` 中的请求 DTO、查询 DTO、响应 DTO。

### 2.2 非目标

- 不在 DTO 层修改数据库 Schema。
- 不在 DTO 层承载复杂业务流程编排。
- 不在 Service 中引入 apps 暴露层 DTO 作为核心领域类型。

## 3. 分层与职责

### 3.1 `libs/platform`：基础 DTO 复用层

- 优先复用 `libs/platform/src/dto` 中的 `BaseDto`、`IdDto`、`IdsDto`、`PageDto` 等基础类。
- 基础类负责分页、主键、通用时间字段等横切能力。

### 3.2 `libs/*`：实体基类 DTO（`BaseXxxDto`）

- `BaseXxxDto` 是实体相关 API 模型的共享复用起点，优先承载跨场景稳定且可对外暴露的公共字段与物理约束。
- `BaseXxxDto` 中凡是直接映射自 Drizzle Table 的字段，字段名、类型、可空性、长度、枚举、默认语义必须与对应 Drizzle Table 保持一致。
- 不要求为了“贴表”把仅服务存储、软删除、内部审计、内部统计或中间流程的字段机械暴露到所有 `BaseXxxDto`。
- 当某些持久化字段只适合特定响应场景暴露时，优先放到专用 `ResponseDto` 或领域类型中，而不是反向膨胀 `BaseXxxDto`。
- 基类 DTO 只承载物理约束类校验与基础 Swagger 描述，不承载业务差异规则。
- 日期时间字段的 Swagger `example` 统一使用 ISO 8601，例如 `2024-01-01T00:00:00.000Z`。

### 3.3 `apps/*`：场景 DTO（`Create/Update/Query/Response`）

- apps 层 DTO 必须基于基础 DTO 或 `BaseXxxDto` 组合，优先使用 `PickType`、`OmitType`、`PartialType`、`IntersectionType`。
- 仅当场景需要更严格或不同的校验/文档描述时，才在 apps DTO 中重新声明字段。
- 不得手动重复定义 `id`、`createdAt`、`updatedAt` 等通用字段。
- 嵌套响应模型优先从已有领域 DTO 中通过裁剪复用，避免重新逐字段书写。
- 当某个返回结构不应直接暴露 `BaseXxxDto` 中的全部共享字段时，优先补充专用响应 DTO，而不是为了复用把不合适字段抬升进基类 DTO。

### 3.4 Service：领域逻辑层

- Service 方法签名不直接引用 apps 层 DTO 类型。
- 入参与返回优先使用 Drizzle 推导类型或基于其派生的领域类型。
- Service 内部临时结构优先通过 `Pick`、`Omit`、交叉类型等方式从 Drizzle 类型构建，避免重复声明字段。
- Drizzle 推导类型必须定义并导出在对应 `db/schema` 表定义文件附近，保持 Schema 与 Type 同步。
- 当模块内存在多处稳定的自定义领域类型时，使用 `*.type.ts` 集中维护，并通过 `import type` 引用。
- `*.type.ts` 中每个导出类型都应补充用途说明，至少说明该类型服务的场景与关键字段语义。

## 4. 命名规范

- **基类（共享）**：`BaseXxxDto`
- **请求**：`CreateXxxDto`、`UpdateXxxDto`、`QueryXxxDto`、`XxxTargetDto`
- **响应**：`XxxResponseDto`、`XxxItemDto`、`XxxBriefDto`
- **领域类型文件**：`xxx.type.ts`

## 5. 复用与覆盖规则

### 5.1 复用优先级

1. `libs/platform` 基础 DTO
2. `libs/*` 中的 `BaseXxxDto`
3. `apps/*` 中的场景组合 DTO

### 5.2 覆盖方式

- 当 apps 层需要差异化校验或文档描述时，只重写必要字段。
- 未变化字段继续通过继承或映射类型复用，禁止复制整类字段定义。

### 5.3 响应模型复用

- 列表项、简要信息、嵌套对象优先从既有领域 DTO 通过 `PickType` 或 `OmitType` 派生。
- 只有现有基类无法表达目标语义时，才允许局部补充字段。
- 补充字段时保持最小化新增，避免形成第二套实体定义。
- 对仅服务内部存储、软删、审计或特定管理端场景的字段，优先放在专用 DTO / 领域类型中，不要为了“全量复用”抬升进所有场景共享的 `BaseXxxDto`。
- 禁止新增纯别名 DTO，例如 `export class XxxDto extends YyyDto {}` 这类空壳继承。
- 需要复用现有 DTO 时直接使用原 DTO；仅为避免命名冲突时，使用 `import { YyyDto as XxxSourceDto }` 这类导入别名，而不是再声明一个 class。

## 6. 放置例外

- 若某实体只被单个应用使用，可将该实体的共享基类 DTO 放在该应用模块目录中维护。
- 即使放在应用目录中，仍必须遵守本规范中的字段一致性、复用方式与命名要求。

## 7. 设计与实现流程

1. 先定位对应 Drizzle Table、现有基础 DTO 与模块内 DTO。
2. 以 Drizzle Table 为准校准 `BaseXxxDto` 中需要对外复用的共享字段与物理约束，并显式判断哪些字段应留在领域类型或专用响应 DTO 中。
3. 用映射类型组合出 `Create/Update/Query/Response` 场景 DTO。
4. 将 Service 方法签名与内部结构收敛为 Drizzle 推导类型或稳定领域类型。
5. 复核 Swagger、校验器与 DTO 继承链，确保字段描述、可选性与示例值一致。

## 8. 验收清单

- [ ] DTO 优先复用 `libs/platform/src/dto` 中的基础类。
- [ ] 不存在重复定义的 `id`、`createdAt`、`updatedAt` 等通用字段。
- [ ] `BaseXxxDto` 中直接映射自 Table 的共享字段与对应 Drizzle Table 的字段、类型、可空性、枚举、长度一致；未暴露字段有明确的 API 契约理由。
- [ ] 日期字段 Swagger 示例统一为 ISO 8601。
- [ ] apps 层嵌套响应优先通过 `PickType/OmitType` 复用领域 DTO。
- [ ] 不存在 `export class XxxDto extends YyyDto {}` 这类无新增字段、无新增语义的空壳别名 DTO。
- [ ] Service 方法签名不直接引用 apps 层 DTO。
- [ ] Service 内部临时结构已优先基于 Drizzle 类型构建。
- [ ] 稳定领域类型已拆分到 `*.type.ts` 并补充清晰注释。
- [ ] Drizzle 推导类型在对应 `db/schema` 表定义文件附近定义并导出。

# 项目 DTO 规范

## 1. 目标与原则

- **高复用**：字段优先通过继承、映射类型与字段片段复用，避免重复定义。
- **低耦合**：DTO 只负责应用边界的数据传输、输入校验与文档描述；Service 不直接依赖 apps 层 DTO。
- **单一事实源**：实体字段与物理约束以 Drizzle Table 为准。
- **契约优先**：DTO 是 API 契约，不机械等同于数据库表结构。
- **边界分离**：共享 HTTP 模型、字段片段 DTO 与领域输入输出类型分别治理，不把所有复用都压进 `BaseXxxDto`。
- **类型安全**：领域层优先使用 Drizzle 推导类型与稳定的领域输入输出类型。

## 2. 范围与边界

### 2.1 覆盖范围

- `libs/platform` 中的基础 DTO。
- `libs/*` 中的实体基类 DTO、共享字段片段 DTO、跨场景共享 DTO。
- `apps/admin-api`、`apps/app-api` 中的请求 DTO、查询 DTO、响应 DTO。
- 与 DTO 分层直接相关的 `libs/*/*.type.ts` 领域输入输出放置原则。

### 2.2 非目标

- 不在 DTO 层修改数据库 Schema。
- 不在 DTO 层承载复杂业务流程编排。
- 不把 apps 暴露层 DTO 直接作为 Service 的核心领域类型。
- 不为了消除少量重复，把 admin/app 已分叉的 HTTP 契约强行下沉到 `libs/*`。

## 3. 分层与职责

### 3.1 `libs/platform`：基础 DTO 复用层

- 优先复用 `libs/platform/src/dto` 中的 `BaseDto`、`IdDto`、`IdsDto`、`PageDto` 等基础类。
- 基础类负责分页、主键、通用时间字段等横切能力。

### 3.2 `libs/*`：实体基类 DTO（`BaseXxxDto`）

- `BaseXxxDto` 是实体相关 API 模型的共享复用起点，只承载跨场景稳定、可公开暴露、且确实值得复用的字段。
- `BaseXxxDto` 中凡是直接映射自 Drizzle Table 的字段，字段名、类型、可空性、长度、枚举、默认语义必须与对应 Drizzle Table 保持一致。
- `BaseXxxDto` 不是“表的完整镜像”，不要求为了贴表把仅服务内部存储、软删除、内部审计、内部统计或中间流程字段机械暴露出来。
- 当某些持久化字段只适合特定响应场景暴露时，优先放到专用 `ResponseDto`、共享 `Item/Detail/BriefDto` 或领域类型中，而不是反向膨胀 `BaseXxxDto`。
- 基类 DTO 只承载物理约束类校验与基础 Swagger 描述，不承载业务差异规则。
- 日期时间字段的 Swagger `example` 统一使用 ISO 8601，例如 `2024-01-01T00:00:00.000Z`。
- 若某个 `Create/Update` DTO 需要长期从 `BaseXxxDto` 中 `Omit` 大量字段，优先反查并收缩 `BaseXxxDto` 边界。

### 3.3 `libs/*`：共享字段片段 DTO 与共享 API 模型 DTO

- 对于跨 admin/app 复用、但不适合作为整实体基类承载的字段集合，可在 `libs/*` 中定义字段片段 DTO，例如 `XxxWritableFieldsDto`、`XxxStatusFieldsDto`、`XxxBriefDto`。
- 对于多个入口都完全复用、且字段语义与暴露范围一致的响应模型，可在 `libs/*` 中定义共享 DTO，例如 `XxxItemDto`、`XxxBriefDto`、`XxxDetailDto`。
- 只有在字段集合、暴露范围、校验语义和 Swagger 描述都一致时，才将响应 DTO 下沉到 `libs/*`。
- 若 admin/app 仅字段相近但契约边界不同，应保留各自 apps DTO，仅下沉共享字段片段。
- 禁止新增纯别名 DTO，例如 `export class XxxDto extends YyyDto {}` 这类空壳继承。
- 需要复用现有 DTO 时直接使用原 DTO；仅为避免命名冲突时，使用导入别名，而不是再声明一个 class。

### 3.4 `libs/*/*.type.ts`：领域输入输出类型

- Service、Resolver、Worker 的方法签名优先使用 `libs/*/*.type.ts` 中维护的领域输入输出类型，例如 `CreateXxxInput`、`UpdateXxxInput`、`QueryXxxInput`、`XxxView`、`XxxDetailView`。
- 领域输入输出类型基于 `@db/schema` 推导类型与稳定业务语义构建，不直接依赖 apps 层 DTO。
- 当 admin/app 共享相同的业务输入输出语义，但 HTTP 校验、必填性或文档描述存在差异时，优先共享 `*.type.ts`，各应用分别定义 DTO。
- `*.type.ts` 的详细规则以 `TS_TYPE_SPEC.md` 为准；本规范只约束其与 DTO 的边界关系。

### 3.5 `apps/*`：场景 DTO（`Create/Update/Query/Response`）

- apps 层 DTO 必须基于基础 DTO、`BaseXxxDto`、共享字段片段 DTO 组合，优先使用 `PickType`、`OmitType`、`PartialType`、`IntersectionType`。
- 所有仅面向应用入口的场景 DTO（`Create/Update/Query/Response`）必须定义在 `apps/admin-api` 或 `apps/app-api`，不得新增到 `libs/*`。
- 仅当场景需要更严格或不同的校验、可选性或文档描述时，才在 apps DTO 中重新声明字段。
- 不得手动重复定义 `id`、`createdAt`、`updatedAt` 等通用字段。
- 嵌套响应模型优先从已有领域 DTO 或共享 DTO 中通过裁剪复用，避免重新逐字段书写。
- 当某个返回结构不应直接暴露 `BaseXxxDto` 中的全部共享字段时，优先补充专用响应 DTO，而不是直接继承完整 `BaseXxxDto`。
- app 侧公开响应默认按最小暴露面设计；对审核、软删、内部统计、内部审计等字段必须显式判断是否应出现在契约中。

### 3.6 Service：领域逻辑层

- Service 方法签名不直接引用 apps 层 DTO 类型。
- 入参与返回优先使用 Drizzle 推导类型或基于其派生的领域类型。
- Service 内部临时结构优先通过 `Pick`、`Partial`、`Omit`、交叉类型等方式从 `@db/schema` 实体推导类型构建，避免重复声明字段。
- 从 `@db/schema` 引入实体类型时必须使用 `import type`，避免引入运行时代码依赖。
- Drizzle 推导类型必须定义并导出在对应 `db/schema` 表定义文件附近，保持 Schema 与 Type 同步。
- 当模块内存在多处稳定的自定义领域类型时，使用 `*.type.ts` 集中维护，并通过 `import type` 引用。
- `*.type.ts` 中每个导出类型都应补充用途说明，至少说明该类型服务的场景与关键字段语义。

## 4. 命名规范

- **实体基类 DTO**：`BaseXxxDto`
- **共享字段片段 DTO**：`XxxWritableFieldsDto`、`XxxStatusFieldsDto`、`XxxMetaDto`
- **请求 DTO**：`CreateXxxDto`、`UpdateXxxDto`、`QueryXxxDto`、`XxxTargetDto`
- **响应 DTO**：`XxxResponseDto`、`XxxItemDto`、`XxxBriefDto`、`XxxDetailDto`
- **领域类型文件**：`xxx.type.ts`
- **领域输入输出类型**：`CreateXxxInput`、`UpdateXxxInput`、`QueryXxxInput`、`XxxView`、`XxxDetailView`

## 5. 复用与下沉规则

### 5.1 复用优先级

1. `libs/platform` 基础 DTO
2. `libs/*` 中的 `BaseXxxDto`
3. `libs/*` 中的共享字段片段 DTO
4. `libs/*/*.type.ts` 中的共享领域输入输出类型
5. `apps/*` 中的场景组合 DTO

### 5.2 字段覆盖方式

- 当 apps 层需要差异化校验、可选性或文档描述时，只重写必要字段。
- 未变化字段继续通过继承或映射类型复用，禁止复制整类字段定义。

### 5.3 何时下沉到 `libs/*`

- 若某结构会被多个应用入口复用，且字段集合、暴露范围、校验规则与文档语义都一致，可下沉为共享 DTO。
- 若多个应用入口共享相同业务语义，但 HTTP 必填性、校验器或文档描述不同，优先下沉为 `*.type.ts` 领域类型，apps 各自保留 DTO。
- 若结构只在单个应用、单个 controller 或单个场景使用，应保留在 `apps/*`。
- 若某结构主要服务于 Service 方法签名、数据库查询结果或聚合返回，应优先定义为 `type/interface`，而不是 DTO class。

### 5.4 响应模型复用

- 列表项、简要信息、嵌套对象优先从既有领域 DTO 或共享 DTO 通过 `PickType`、`OmitType` 派生。
- 只有现有基类或共享字段片段无法表达目标语义时，才允许局部补充字段。
- 补充字段时保持最小化新增，避免形成第二套实体定义。
- 对仅服务内部存储、软删、审计或特定管理端场景的字段，优先放在专用 DTO / 领域类型中，不要为了“全量复用”抬升进所有场景共享的 `BaseXxxDto`。
- app 侧公开详情或公开列表 DTO，默认不直接继承完整 `BaseXxxDto`；若必须整体复用，需先确认不会额外暴露不应公开的字段。

### 5.5 数组枚举字段规范

- 枚举数组字段统一使用 `ArrayProperty`，并显式传入 `itemEnum`，禁止仅用 `itemType: 'number'` 表达语义。
- 枚举数组字段的 TypeScript 类型必须写为 `XxxEnum[]`，不得写成裸 `number[]`。
- 仅当存在额外业务规则时，才补充 `itemValidator`；基础值域校验由 `itemEnum` 负责。
- `example/default` 优先复用常量，避免重复散落字面量。

## 6. 放置例外

- 若某实体只被单个应用使用，可将该实体的共享基类 DTO 或共享字段片段 DTO 放在对应应用模块目录中维护。
- 即使放在应用目录中，仍必须遵守本规范中的字段一致性、复用方式与命名要求。

## 7. 设计与实现流程

1. 先定位对应 Drizzle Table、现有基础 DTO、共享字段片段 DTO 与模块内 `*.type.ts`。
2. 以 Drizzle Table 为准校准 `BaseXxxDto` 中真正需要对外复用的共享字段与物理约束，并显式判断哪些字段应留在专用 DTO 或领域类型中。
3. 判断复用目标是“共享字段片段 DTO”“共享 HTTP DTO”还是“领域输入输出类型”，避免默认都塞进 `BaseXxxDto`。
4. 用映射类型组合出 `Create/Update/Query/Response` 场景 DTO。
5. 将 Service 方法签名与内部结构收敛为 Drizzle 推导类型或稳定领域类型。
6. 复核 Swagger、校验器与 DTO 继承链，确保字段描述、可选性与示例值一致。

## 8. 验收清单

- [ ] DTO 优先复用 `libs/platform/src/dto` 中的基础类。
- [ ] `libs/*` 中未新增仅 admin/app 场景使用的 `Create/Update/Query/Response` DTO。
- [ ] `apps/*` 场景 DTO 均定义在应用层目录，未误下沉到 `libs/*`。
- [ ] 不存在重复定义的 `id`、`createdAt`、`updatedAt` 等通用字段。
- [ ] `BaseXxxDto` 中直接映射自 Table 的共享字段与对应 Drizzle Table 的字段、类型、可空性、枚举、长度一致；未暴露字段有明确的 API 契约理由。
- [ ] `BaseXxxDto` 未承载仅内部使用、仅特定端使用、或会导致公开接口误暴露的字段。
- [ ] 对于 admin/app 共享但 HTTP 语义不同的结构，已优先下沉到 `*.type.ts` 或共享字段片段，而不是强行共享同一个场景 DTO。
- [ ] 日期字段 Swagger 示例统一为 ISO 8601。
- [ ] apps 层嵌套响应优先通过 `PickType/OmitType` 复用领域 DTO 或共享 DTO。
- [ ] 不存在 `export class XxxDto extends YyyDto {}` 这类无新增字段、无新增语义的空壳别名 DTO。
- [ ] Service 方法签名不直接引用 apps 层 DTO。
- [ ] Service 内部临时结构已优先基于 `@db/schema` 类型并通过 `Pick/Partial/Omit` 构建。
- [ ] `@db/schema` 类型导入使用 `import type`。
- [ ] 稳定领域类型已拆分到 `*.type.ts` 并补充清晰注释。
- [ ] Drizzle 推导类型在对应 `db/schema` 表定义文件附近定义并导出。
- [ ] 枚举数组字段使用 `ArrayProperty + itemEnum`，字段类型为 `XxxEnum[]`。
- [ ] 若某 `Create/Update` DTO 长期依赖对基类执行大规模 `Omit`，已回查并优化基类边界。
- [ ] 相关改动已通过 `eslint` 与 `type-check`。

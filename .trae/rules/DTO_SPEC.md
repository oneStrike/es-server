# 项目 DTO 规范

## 1. 目标与原则

- **高复用**：字段不重复定义，优先通过继承与映射类型复用。
- **低耦合**：Service 层零 DTO 依赖，DTO 仅承载数据传输与输入校验/文档描述。
- **单一事实源**：实体字段与物理约束以数据库 Schema（Drizzle Table）为准。
- **类型安全**：Service 层尽量使用 Drizzle-ORM 推导类型降低维护成本。

## 2. 范围与边界

### 2.1 覆盖范围

- 全项目 DTO（优先规范化并重构 `admin-user`, `app-user`, `like`, `favorite` 等核心模块）。

### 2.2 非目标

- 不改动底层数据库 Schema。
- 不修改现有业务逻辑，仅调整数据传输层与类型/校验/文档组织方式。

## 3. 分层与职责

### 3.1 libs/platform：基础 DTO 复用层

- 充分利用 `libs/platform` 中的 `BaseDto`, `IdDto`, `PageDto` 等基础类。
- 这些基础类用于抽象通用字段/分页等通用能力，供项目各模块复用。

### 3.2 libs：实体基类 DTO（BaseXxxDto）

- **定义内容**：`BaseXxxDto` 包含该实体的**全量字段**（单一事实源的 DTO 表达）。
- **强制约束**：调整/新增基类 DTO 时必须严格对照 Drizzle Table 定义，确保字段名、类型、可空性、长度、枚举等与数据库定义 **100% 一致**。
- **校验边界**：基类 DTO 只包含物理约束类校验（如 `maxLength`, `enum`, `type` 等），不承载业务差异规则。
- **Swagger 示例**：日期时间 `example` 统一使用 ISO 8601（如 `2024-01-01T00:00:00.000Z`）。

### 3.3 apps：应用侧 DTO（Create/Update/Query/Response）

- **继承与组合**：应用侧 DTO 必须继承或组合 `BaseXxxDto`，优先使用 `PickType`, `OmitType`, `PartialType`, `IntersectionType` 进行裁剪与组合。
- **差异化校验**：如需业务差异校验（例如强密码、跨字段逻辑），在 apps 层 DTO 中通过重新声明属性覆盖校验与文档描述。
- **避免重复**：不得手动重复定义 `id`, `createdAt`, `updatedAt` 等通用字段；统一从基类/基础类复用。

### 3.4 Service：领域逻辑层（零 DTO 依赖）

- Service 方法签名不直接引用 apps 侧 DTO 类型。
- 入参与返回优先使用 Drizzle-ORM 推导类型或其变体（如 `Pick<T, Keys>`）。
- **内部接口**：Service 内部的临时数据结构（如 Payload）应优先基于 Drizzle 类型通过 `Pick` 或 `Omit` 构建，禁止重复定义字段。
- **强制要求**：推导类型（如 `type User = typeof users.$inferSelect`）必须在对应 `db/schema` 的表定义文件中定义并导出，确保 Schema 与 Type 同步。
- **类型文件拆分**：当 Service 内部存在多处自定义类型（入参、查询、聚合结果等）时，必须新建同模块的 `*.type.ts` 文件集中维护，Service 通过 `import type` 引用，避免在 Service 文件内堆叠大量类型定义。
- **注释要求**：`*.type.ts` 中每个导出类型必须有清晰注释，至少说明用途与关键字段语义（如“分页查询条件”“聚合后的返回项”）。

## 4. 命名规范

- **基类（全量）**：`BaseXxxDto`
- **请求**：`CreateXxxDto`, `UpdateXxxDto`, `QueryXxxDto`, `XxxTargetDto`
- **响应**：`XxxResponseDto`, `XxxItemDto`（列表项）, `XxxBriefDto`（简要）
- **类型文件**：`xxx.type.ts`（与模块同目录）

## 5. 复用与覆盖规则

### 5.1 复用优先级

1. `libs/platform` 基础 DTO（通用能力与通用字段抽象）
2. `libs` 层 `BaseXxxDto`（实体全量字段与物理约束）
3. `apps` 层组合 DTO（请求/响应场景差异化）

### 5.2 覆盖方式

- 当 apps 层需要对某个字段施加更严格或不同的校验/文档描述时：
  - 在 apps DTO 中重新声明该属性，并添加对应的校验与 Swagger 装饰器；
  - 其余字段保持从基类继承/组合，避免复制粘贴。

### 5.3 响应模型复用

- 对于 apps 层响应中的嵌套对象（如 `XxxInfoDto`, `XxxBriefDto`），优先从已有领域基类 DTO 通过 `PickType`/`OmitType` 复用字段（例如 `BaseWorkDto`, `BaseWorkChapterDto`）。
- 当目标字段可由现有基类完整覆盖时，禁止在 apps DTO 中手动逐字段重复定义。
- 仅当现有基类无法表达目标语义（字段缺失、可空性冲突、文档语义明显不符）时，允许局部补充字段，并在同一 DTO 内保持最小化新增。

## 6. 例外情况

- 若某实体仅被单个应用使用（例如目前仅在 `admin-api` 中出现），允许将该实体的“全量基类 DTO”放在该应用模块目录下维护（例如 `apps/admin-api/src/modules/admin-user/dto/admin-user.dto.ts`），但仍需遵守本规范的字段一致性、复用与命名规则。

## 7. 重构执行指引（推荐流程）

1. 选定一个模块作为示范（优先 `admin-user`）。
2. 以 Drizzle Table 为准创建/校准 `BaseXxxDto`（全量字段 + 物理约束）。
3. 将 apps 中的 Create/Update/Query/Response DTO 改为继承/组合基类，并移除重复字段定义。
4. 将 Service 方法签名从 DTO 类型迁移为 Drizzle 推导类型或更稳定的领域输入类型。
5. 复核 Swagger 文档与校验：字段描述不丢失、继承后校验生效、日期示例统一。
6. 推广到其它模块并按同一规范收敛。

## 8. 验收清单

- [ ] 所有 DTO 均基于 `libs/platform/dto` 的基础类进行复用。
- [ ] 移除手动重复定义的 `id`, `createdAt`, `updatedAt` 等字段。
- [ ] 基类 DTO 字段与 Drizzle Table 定义一致（字段/类型/可空/枚举/长度）。
- [ ] Swagger 文档中的日期示例值统一为 ISO 8601。
- [ ] apps 响应嵌套对象优先通过 `PickType/OmitType` 复用领域基类 DTO，避免手动重复定义字段。
- [ ] Service 层方法签名不直接引用 apps 侧 DTO，且优先通过 `Pick<DrizzleType, Keys>` 复用实体类型。
- [ ] Service 内部临时接口（如 Payload）已全部基于 Drizzle 类型构建，无重复字段定义。
- [ ] 自定义类型较多的 Service 已拆分 `*.type.ts`，并在类型文件中补全清晰注释。
- [ ] Drizzle 推导类型在对应 `db/schema` 表定义文件中定义并导出。


# 项目 DTO 规范

## 1. 目标与原则

- **单一契约源**：业务场景 DTO（`XxxDto`）统一定义在 `libs/*`，不在 `apps/*` 重复定义同构 DTO。
- **一比一契约**：Controller 与 Service 的公开方法入参、出参与 DTO 保持 1:1（字段、可选性、类型一致）。
- **低耦合**：`apps/*` 负责入口编排与路由，不维护第二套 DTO 契约。
- **单一事实源**：实体字段与物理约束以 Drizzle Table 为准。
- **契约优先**：DTO 是 API 契约，不机械等同数据库表结构。
- **类型最小化**：与 DTO 同构的 `Input/View` 类型应删除；若保留语义名，只允许类型别名。

## 2. 范围与边界

### 2.1 覆盖范围

- `libs/platform` 中的基础 DTO。
- `libs/*` 中的实体基类 DTO、共享字段片段 DTO、场景 DTO（`Create/Update/Query/Response`）。
- 与 DTO 配套的 `libs/*/*.type.ts` 内部领域类型（仅非 DTO 同构结构）。
- `apps/admin-api`、`apps/app-api` 中对 DTO 的消费方式与入口约束。

### 2.2 非目标

- 不在 DTO 层修改数据库 Schema。
- 不在 DTO 层承载复杂业务流程编排。
- 不在 `apps/*` 复制或改写 `libs/*` 已存在的同构 DTO。
- 不长期维护“DTO 一份 + 等价 interface/type 一份”的镜像定义。

## 3. 分层与职责

### 3.1 `libs/platform`：基础 DTO 复用层

- 优先复用 `BaseDto`、`IdDto`、`IdsDto`、`PageDto` 等基础类。
- 基础类负责分页、主键、通用时间字段等横切能力。

### 3.2 `libs/*`：实体基类 DTO（`BaseXxxDto`）

- `BaseXxxDto` 是实体相关模型的共享复用起点，只承载跨场景稳定字段。
- 直接映射自 Drizzle Table 的字段，字段名、类型、可空性、长度、枚举、默认语义必须一致。
- `BaseXxxDto` 不是表的完整镜像；仅内部字段（软删、内部审计、中间态）不强制外露。
- 日期时间字段的 Swagger `example` 统一使用 ISO 8601（例如 `2024-01-01T00:00:00.000Z`）。

### 3.3 `libs/*`：场景 DTO（`Create/Update/Query/Response`）

- 业务场景 DTO 统一定义在 `libs/*`，由 admin/app 入口共同复用。
- 优先通过 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 组合，避免字段复制。
- 同一业务语义只维护一份 DTO；禁止按平台复制两份同构 DTO。
- 出现语义分叉时，按业务语义拆分 DTO 与方法（例如 `QueryXxxAuditDto`、`QueryXxxPublicDto`），而不是在同一 DTO 中堆叠平台特化字段。
- 禁止新增纯别名 DTO（`export class XxxDto extends YyyDto {}`）。

### 3.4 `libs/*/*.type.ts`：内部领域类型

- `*.type.ts` 只用于 DTO 难以表达或不应暴露到 HTTP 的内部结构。
- 典型场景：聚合结果、快照结构、事务上下文、数据库投影、事件载荷、通用泛型工具。
- 若结构与 DTO 同构，优先直接使用 DTO；若必须保留语义名，仅允许 `type XxxInput = XxxDto` 形式别名。

### 3.5 `apps/*`：入口装配层

- `apps/*` 不新增同构场景 DTO，统一导入 `libs/*` DTO。
- Controller 负责参数接收、上下文装配、权限与审计装饰器、调用 service。
- 仅在迁移窗口允许临时 DTO；必须标注迁移说明与清理计划。

### 3.6 Service：领域逻辑层

- Service 公开方法入参、出参与 `libs/*` DTO 保持 1:1。
- 查询方法与 Query DTO 必须 1:1；禁止“DTO 超集 / 方法子集”。
- 返回语义稳定时，优先使用响应 DTO 或基础类型；内部临时结构使用 `*.type.ts` 或 Drizzle 推导类型。
- 从 `@db/schema` 引入实体类型必须使用 `import type`。

## 4. 命名规范

- **实体基类 DTO**：`BaseXxxDto`
- **共享字段片段 DTO**：`XxxWritableFieldsDto`、`XxxStatusFieldsDto`、`XxxMetaDto`
- **场景 DTO**：`CreateXxxDto`、`UpdateXxxDto`、`QueryXxxDto`、`XxxResponseDto`、`XxxItemDto`、`XxxDetailDto`
- **领域类型文件**：`xxx.type.ts`
- **内部类型别名（可选）**：`type QueryXxxInput = QueryXxxDto`

## 5. 复用与收敛规则

### 5.1 复用优先级

1. `libs/platform` 基础 DTO
2. `libs/*` 中的 `BaseXxxDto`
3. `libs/*` 中的场景 DTO（`Create/Update/Query/Response`）
4. `libs/*/*.type.ts` 中的内部领域类型（仅在必要时）

### 5.2 字段覆盖方式

- 仅在校验、可选性、文档语义确有差异时覆盖字段。
- 未变化字段必须复用，禁止复制整类字段定义。

### 5.3 何时使用 `type/interface` 而不是 DTO

- 该结构不属于 HTTP 契约。
- 该结构是数据库投影、聚合中间态或事务上下文。
- 该结构是消息队列、事件总线、调度任务等非 Controller 边界载荷。
- 该结构是通用泛型工具，不面向 Swagger。

### 5.4 响应模型复用

- 列表项、简要信息、嵌套对象优先从既有 DTO 裁剪复用。
- 只在现有 DTO 无法表达目标语义时补充字段。
- app 侧公开响应默认最小暴露面，不泄露内部审计或运营内部字段。

### 5.5 数组枚举字段规范

- 枚举数组字段统一使用 `ArrayProperty`，并显式传入 `itemEnum`。
- 枚举数组字段 TypeScript 类型必须为 `XxxEnum[]`，不得写成裸 `number[]`。
- `example/default` 优先复用常量，避免散落字面量。

## 6. 放置例外

- 若某业务域当前仅有单入口，也应优先放在 `libs/*`，避免后续迁移成本。
- 临时例外必须在 PR 说明中写明原因、影响面与回收计划。

## 7. 设计与实现流程

1. 先定位对应 Drizzle Table、已有 DTO 与 `*.type.ts`。
2. 判断目标结构是否属于 HTTP 契约；属于则在 `libs/*` 定义或复用 DTO。
3. 对齐 Controller/Service 公开方法签名，确保与 DTO 1:1。
4. 仅在 DTO 不适用时补充 `*.type.ts` 内部类型。
5. 复核 Swagger、校验器、可选性与示例值一致性。

## 8. 验收清单

- [ ] 场景 DTO（`Create/Update/Query/Response`）定义在 `libs/*`，`apps/*` 无同构重复定义。
- [ ] Service 公开方法入参与出参与 DTO 1:1（字段、可选性、类型一致）。
- [ ] Query DTO 与查询方法签名 1:1，无平台分叉同构 DTO。
- [ ] 与 DTO 同构的 `Input/View` 类型已删除或收敛为类型别名。
- [ ] `BaseXxxDto` 中映射字段与 Drizzle Table 一致。
- [ ] 无手动重复定义通用字段（`id`、`createdAt`、`updatedAt` 等）。
- [ ] 非 HTTP 结构使用 `*.type.ts`，未错误 DTO 化。
- [ ] `@db/schema` 类型导入使用 `import type`。
- [ ] 日期字段 Swagger 示例为 ISO 8601。
- [ ] 相关改动已通过 `eslint` 与 `type-check`。

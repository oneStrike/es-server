# 项目 DTO 规范

## 1. 目标与原则

- **单一契约源**：业务场景 DTO（`XxxDto`）统一定义在 `libs/*`，不在 `apps/*` 重复定义同构 DTO。
- **一比一契约**：Controller 与 Service 的公开方法入参、出参与 DTO 保持 1:1（字段、可选性、类型一致）。
- **低耦合**：`apps/*` 负责入口编排与路由，不维护第二套 DTO 契约。
- **单一事实源**：实体字段与物理约束以 Drizzle Table 为准。
- **按表拆文件**：实体基类 DTO 按 Drizzle Table 拆分，一个 schema 表对应一个 DTO 文件，不把多个表的基类 DTO 混放在同一个文件里。
- **文件维度收口**：DTO 文件维度默认按 schema / table 收口，不新增 `*.public.dto.ts` 这类仅按前端暴露面拆出的文件。
- **契约优先**：DTO 是 API 契约，不机械等同数据库表结构。
- **类型最小化**：与 DTO 同构的 `Input/View` 类型应删除，直接使用 DTO。

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
- 一个 Drizzle Table 对应一个 DTO 文件；文件名与表语义一一对应，例如 `check-in-plan.dto.ts`、`check-in-record.dto.ts`。
- 单个 DTO 文件只放同一张表的基类 DTO、该表直接关联的字段片段 DTO，以及确有必要的少量 helper；禁止把多张表的 `BaseXxxDto` 聚合到一个“大 DTO 文件”中。
- 只要仍属于同一张表的契约收敛，场景 DTO 也优先并回对应 `xxx.dto.ts` 文件；不要额外拆成 `xxx-public.dto.ts`、`xxx-app.dto.ts` 这类文件。
- `BaseXxxDto` 不是表的完整镜像；仅内部字段（软删、内部审计、中间态）不强制外露。
- 日期时间字段的 Swagger `example` 统一使用 ISO 8601（例如 `2024-01-01T00:00:00.000Z`）。

### 3.3 `libs/*`：场景 DTO（`Create/Update/Query/Response`）

- 业务场景 DTO 统一定义在 `libs/*`，由 admin/app 入口共同复用。
- 优先通过 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 组合，避免字段复制。
- 同一业务语义只维护一份 DTO；禁止按平台复制两份同构 DTO。
- 场景 DTO 命名与拆分尽量向 Service 公开用例靠拢，不以 `Admin` / `App` 前缀区分客户端。
- 出现语义分叉时，按业务语义拆分 DTO 与方法（例如 `QueryXxxAuditDto`、`QueryXxxPublicDto`），而不是在同一 DTO 中堆叠平台特化字段。
- 场景 DTO 默认放在对应 schema 的 `xxx.dto.ts` 文件内；禁止为了公开暴露面单独新增 `*.public.dto.ts` 文件。
- 禁止新增纯别名 DTO（`export class XxxDto extends YyyDto {}`）。

### 3.4 `libs/*/*.type.ts`：内部领域类型

- `*.type.ts` 只用于 DTO 难以表达或不应暴露到 HTTP 的内部结构。
- 典型场景：聚合结果、快照结构、事务上下文、数据库投影、事件载荷、通用泛型工具。
- 若结构与 DTO 同构，直接使用 DTO；不要再新增或保留 `type XxxInput = XxxDto`、`type XxxView = XxxDto` 这类镜像别名。

### 3.5 `apps/*`：入口装配层

- `apps/*` 不新增同构场景 DTO，统一导入 `libs/*` DTO。
- Controller 负责参数接收、上下文装配、权限与审计装饰器、调用 service。

### 3.6 Service：领域逻辑层

- Service 公开方法入参、出参与 `libs/*` DTO 保持 1:1。
- 查询方法与 Query DTO 必须 1:1；禁止“DTO 超集 / 方法子集”。
- 返回语义稳定时，优先使用响应 DTO 或基础类型；内部临时结构使用 `*.type.ts` 或 Drizzle 推导类型。
- 从 `@db/schema` 引入实体类型必须使用 `import type`。

## 4. 命名规范

- **实体基类 DTO**：`BaseXxxDto`
- **共享字段片段 DTO**：`XxxWritableFieldsDto`、`XxxStatusFieldsDto`、`XxxMetaDto`
- **场景 DTO**：`CreateXxxDto`、`UpdateXxxDto`、`QueryXxxDto`、`XxxResponseDto`、`XxxItemDto`、`XxxDetailDto`
- **实体基类 DTO 文件**：`xxx.dto.ts`，并与对应 schema 表一一对应
- **场景 DTO 文件放置**：默认与对应 schema 的 `xxx.dto.ts` 同文件维护，不新增 `xxx-public.dto.ts`、`xxx-app.dto.ts` 等端侧命名文件
- **领域类型文件**：`xxx.type.ts`
- **内部领域类型**：仅在非 HTTP 结构下定义 `XxxContext`、`XxxPayload`、`XxxSnapshot`、`XxxAggregation`、`XxxRow`、`XxxResult`
- 禁止新增 `AdminXxxDto`、`AppXxxDto` 这类客户端前缀命名；若出现语义差异，直接体现在业务语义名上。

## 5. 复用与收敛规则

### 5.1 复用优先级

1. `libs/platform` 基础 DTO
2. `libs/*` 中的 `BaseXxxDto`
3. `libs/*` 中的场景 DTO（`Create/Update/Query/Response`）
4. `libs/*/*.type.ts` 中的内部领域类型（仅在必要时）

### 5.2 字段覆盖方式

- 仅在校验、可选性、文档语义确有差异时覆盖字段。
- 未变化字段必须复用，禁止复制整类字段定义。
- 优先从 `BaseXxxDto`、已有场景 DTO 或共享字段片段 DTO 中 `Pick/Omit/Partial/Intersection`，尽量不要重新手写同一批字段。
- `PickType` 与 `OmitType` 二选一时，默认统计需要显式列出的字段数量，哪个字段更少就使用哪个；避免为了“正向表达”而罗列大段字段名。
- 若 `PickType` 与 `OmitType` 需要列出的字段数相同，可选择语义更清晰的一侧；若实际没有裁剪字段，就不要再额外包一层 `PickType/OmitType` helper。
- 同一业务域内，只要同名字段或同一组字段在两个及以上 DTO 中出现，就应优先抽成共享字段片段 DTO，或直接复用已有 DTO 字段；不允许在多个场景 DTO 文件里各自维护一份本地 helper class。
- 请求 DTO 与响应 DTO 之间只要字段语义一致，也视为可复用字段；不能因为一个用于入参、一个用于出参，就重新手写同样的字段定义。
- 只有在字段名不同、校验规则不同、可选性不同且无法通过 mapped types 表达时，才允许重新声明；重新声明时需要在代码评审中说明原因。
- 同一个 mapped helper 只要在两个及以上文件重复出现，例如 `OmitType(PageDto, ...)`、`PartialType(XxxIdDto)` 这类组合，也应提取为共享字段片段 DTO，而不是在每个场景文件里重复声明。
- `IntersectionType` 支持传递多个参数；组合三个及以上 DTO 时，必须写成 `IntersectionType(A, B, C)` 这类单层调用，不允许通过嵌套 `IntersectionType(IntersectionType(A, B), C)` 叠加。
- 多层嵌套会增加阅读和 Swagger 元数据调试成本；若交叉组合已经难以理解，应优先提取具名中间 DTO，而不是继续嵌套 type helper。

### 5.3 何时使用 `type/interface` 而不是 DTO

- 该结构不属于 HTTP 契约。
- 该结构是数据库投影、聚合中间态或事务上下文。
- 该结构是消息队列、事件总线、调度任务等非 Controller 边界载荷。
- 该结构是通用泛型工具，不面向 Swagger。

### 5.4 响应模型复用

- 列表项、简要信息、嵌套对象优先从既有 DTO 裁剪复用。
- 只在现有 DTO 无法表达目标语义时补充字段。
- app 侧公开响应默认最小暴露面，不泄露内部审计或运营内部字段。
- 所有自定义校验装饰器均支持 `contract: false`；字段若明确不应进入前端 Swagger / 请求契约，默认优先通过字段级 `contract: false` 排除，而不是新增一份公开 DTO 文件。
- `bizKey`、`deletedAt` 以及同类内部幂等/软删字段若仍需保留在 DTO 中，必须显式标记 `contract: false`，避免进入对外 Swagger / 请求契约。
- 若字段需要在后台场景保留、但不能暴露给 app/public 场景，优先在同一个 schema DTO 文件内通过具名场景 DTO 或 service 显式映射收敛暴露面；不要新增独立 `*.public.dto.ts` 文件。
- `bizKey`、`deletedAt` 以及同类内部幂等/软删字段默认不得返回给前端；若极少数后台场景确需返回，必须在 PR 中说明原因。

### 5.5 数组枚举字段规范

- 枚举数组字段统一使用 `ArrayProperty`，并显式传入 `itemEnum`。
- 枚举数组字段 TypeScript 类型必须为 `XxxEnum[]`，不得写成裸 `number[]`。
- `example/default` 优先复用常量，避免散落字面量。

### 5.6 枚举文档规范

- 所有枚举字段的 `description` 需要写清楚该字段表达的业务语义，并使用“实际枚举值=业务含义”作为描述符。
- 描述符左侧必须是接口真实接收/返回的数据值，例如 `0=草稿；1=已发布`、`weekly=按周切分签到周期`；不使用 `DRAFT`、`PUBLISHED` 这类枚举成员名作为描述符。
- 不允许只写“状态”“类型”这类空泛描述；至少要补足枚举值含义、边界和使用场景。
- 推荐格式为“字段语义（值A=含义A；值B=含义B）”；若某个值有额外约束，可直接跟在该值说明后。

## 6. 放置例外

- 若某业务域当前仅有单入口，也应优先放在 `libs/*`，避免后续迁移成本。
- 临时例外必须在 PR 说明中写明原因、影响面与回收计划。

## 7. 设计与实现流程

1. 先定位对应 Drizzle Table、已有 DTO 与 `*.type.ts`。
2. 先判断该结构应落在哪个 schema 对应的 DTO 文件中；默认并回该 `xxx.dto.ts` 文件，不单独新建 `*.public.dto.ts`。
3. 若字段只是内部字段不应进入前端契约，优先判断是否可直接使用 `contract: false` 排除。
4. 判断目标结构是否属于 HTTP 契约；属于则在 `libs/*` 定义或复用 DTO。
5. 对齐 Controller/Service 公开方法签名，确保与 DTO 1:1，且命名与 Service 用例语义一致。
6. 仅在 DTO 不适用时补充 `*.type.ts` 内部类型。
7. 复核 Swagger、校验器、可选性、示例值、枚举说明与前端暴露面一致性。

## 8. 验收清单

- [ ] 场景 DTO（`Create/Update/Query/Response`）定义在 `libs/*`，`apps/*` 无同构重复定义。
- [ ] Service 公开方法入参与出参与 DTO 1:1（字段、可选性、类型一致）。
- [ ] Query DTO 与查询方法签名 1:1，无平台分叉同构 DTO。
- [ ] 与 DTO 同构的 `Input/View` 类型已删除，并直接使用 DTO。
- [ ] `BaseXxxDto` 中映射字段与 Drizzle Table 一致。
- [ ] 每张 schema 表的基类 DTO 单独放在对应 DTO 文件中，未把多张表 DTO 混放在同一文件。
- [ ] 未新增 `*.public.dto.ts`、`*.app.dto.ts` 等按端侧暴露面拆出的 DTO 文件；同表场景 DTO 已收敛在对应 `xxx.dto.ts` 内。
- [ ] 无手动重复定义通用字段（`id`、`createdAt`、`updatedAt` 等）。
- [ ] 场景 DTO 未使用 `Admin` / `App` 前缀做人为客户端拆分，而是按业务语义或 Service 用例命名。
- [ ] 响应 DTO 已尽量通过字段复用收敛，未大段重新定义已有字段。
- [ ] `PickType` / `OmitType` 已按“显式列出字段更少”的原则选型，未为了表达习惯罗列大段字段名。
- [ ] 跨场景重复字段已抽为共享字段片段 DTO，未在多个场景 DTO 文件中重复定义本地 helper class。
- [ ] `IntersectionType` 组合为单层调用，未出现可展开为多参数的嵌套 `IntersectionType`。
- [ ] 非 HTTP 结构使用 `*.type.ts`，未错误 DTO 化。
- [ ] `@db/schema` 类型导入使用 `import type`。
- [ ] 枚举字段 `description` 已写清业务语义，并使用实际枚举值作为描述符说明各枚举值含义。
- [ ] 明确不应进入前端契约的字段，已优先评估并使用 `contract: false` 收口。
- [ ] `bizKey`、`deletedAt` 等内部字段若保留在 DTO 中，已显式标记 `contract: false`。
- [ ] app/public DTO 未复用会泄露后台内部字段的共享模型，必要时已在同文件场景 DTO 或 service 显式映射中收敛暴露面。
- [ ] 日期字段 Swagger 示例为 ISO 8601。
- [ ] 相关改动已通过 `eslint` 与 `type-check`。

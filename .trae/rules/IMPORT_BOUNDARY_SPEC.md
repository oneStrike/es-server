# 项目导入边界规范

适用范围：本仓库所有 `apps/*`、`libs/*`、`db/*`、`scripts/*` 下的 TypeScript / JavaScript 代码，重点约束 `libs/*` 内部模块之间的公共入口设计、跨域导入方式与运行时依赖边界。

## 1. 核心原则

- 公共 API 必须按职责分层，避免一个 root barrel 同时导出 DTO、Service、Module、Resolver、常量与接口，导致运行时依赖面失控。
- DTO 契约与运行时实现分离；DTO 文件只能依赖 cycle-safe 的契约入口，不能间接拉起 Service、Module 或其他运行时对象。
- Service、Resolver、Module 依赖运行时入口；跨域运行时协作不通过 DTO 聚合入口完成。
- 导入边界首先服务于可维护性，其次服务于避免 CommonJS / Webpack 初始化时序问题与运行时循环依赖。
- 禁止通过“调整导出顺序”掩盖循环依赖；应通过收敛出口职责或重构依赖方向解决根因。

## 2. 出口分层模型

### 2.1 推荐出口类型

- `@libs/<lib>/<domain>`：root 公共入口。仅供应用装配层、聚合模块或外部消费方使用，不作为域内默认入口。
- `@libs/<lib>/<domain>/contracts`：契约入口。承载 DTO、值对象、快照 DTO、纯类型友好的常量、不会触发运行时装配的公共契约。
- `@libs/<lib>/<domain>/core`：运行时入口。承载 Service、Resolver 接口、运行时常量、运行时 helper 与 domain 级编排能力。
- `@libs/<lib>/<domain>/module` 或 `@libs/<lib>/module`：Nest 模块聚合入口。用于 `imports` 装配，不承担 DTO 契约复用职责。
- `@libs/<lib>/contracts`、`@libs/<lib>/core`、`@libs/<lib>/module`：单域库的公共子入口。适用于库内没有再细分 `<domain>` 目录、直接以库根承载一个业务域的场景。

单域库与多域库只是在路径层级上不同，不在职责划分上例外。无论是 `@libs/<lib>/<domain>/core` 还是 `@libs/<lib>/core`，`core` 都只能承载运行时能力，不能混出 DTO 或 Module。

### 2.2 职责要求

- `contracts` 不导出 `Service`、`Module`、Nest provider、带副作用的初始化逻辑。
- `core` 不导出仅供 HTTP 契约复用的场景 DTO，避免 DTO 文件经由 `core` 反向触发运行时依赖。
- `module` 仅导出 Nest Module 或模块聚合入口，不混出 DTO、Service 常量与场景契约。
- root 入口可以按需聚合 `contracts` 与 `core`，但不得作为 `libs/*` 内部默认导入入口。
- 若某业务域当前规模较小，允许暂时只有 `contracts` 或 `core` 其中一种子入口；一旦 root 入口同时聚合契约与运行时对象，域内文件必须停止直接依赖 root 入口。
- 子入口名称不构成豁免条件。历史上命名为 `core`、`contract`、`module` 的入口，只要实际同时导出 DTO、Service、Module 等混合职责，仍视为不符合本规范，必须拆分。

### 2.3 导出项清单

#### `contracts`

`contracts` 只导出“接口契约的一部分”。满足以下任一条件的导出项，应优先进入 `contracts`：

- DTO 类：`BaseXxxDto`、`CreateXxxDto`、`UpdateXxxDto`、`QueryXxxDto`、`XxxItemDto`、`XxxDetailDto`
- 会出现在 DTO 字段、Controller 入参出参、Swagger 文档中的枚举、常量、值对象
- 对外稳定的快照 DTO、轻量视图 DTO、共享字段片段 DTO
- 少量确实属于公共契约的 `type` / `interface`，例如不会触发运行时装配、且用于跨库稳定交互的数据结构

`contracts` 不应导出：

- `Service`
- `Module`
- Resolver 实现类或运行时注册接口
- provider token、DI factory、Nest 动态模块配置
- 仅供 Service / Resolver 内部使用的 helper、上下文类型、数据库投影结果

#### `core`

`core` 只导出“运行时能力”。满足以下任一条件的导出项，应优先进入 `core`：

- `Service`
- 运行时协作接口，例如 Resolver 注册接口、Bridge 接口、Provider 约束接口
- 仅供运行时逻辑使用的常量、helper、token、support 类
- 会在 Service / Resolver / Hook / Worker 之间传递、但不属于 HTTP 契约的内部类型

`core` 不应导出：

- DTO
- 直接用于 Controller 入参出参或 Swagger 的契约枚举 / 契约常量
- `Module`

#### `module`

`module` 只导出 Nest 模块装配入口。满足以下条件的导出项，应进入 `module`：

- `XxxModule`
- 聚合同域多个 Nest Module 的模块入口

`module` 不应导出：

- DTO
- `Service`
- 常量、helper、type、interface

#### 判定规则

遇到边界不清的导出项时，按以下顺序判断：

1. 该导出项是否会出现在 Controller 入参出参、DTO 字段或 Swagger 文档中？
   - 是：放入 `contracts`
2. 该导出项是否仅服务于 Service / Resolver / Provider / Worker 的运行时协作？
   - 是：放入 `core`
3. 该导出项是否只用于 Nest `imports` 装配？
   - 是：放入 `module`

若某个枚举或常量同时被 DTO 和 Service 使用，默认归入 `contracts`，由 `core` 依赖 `contracts`；不要在 `core` 再复制一份等价导出。

#### 关于 `contract`

新代码统一使用 `contracts`，不新增 `contract` 入口。

历史遗留的 `contract.ts`、`purchase-contract.ts` 等命名不视为标准形式。若其职责属于契约入口，应在迁移时统一归并到 `contracts`；若其内容并非纯契约，也必须按职责拆分到 `contracts`、`core`、`module`。

## 3. 分层导入规则

### 3.1 DTO 文件

- `*.dto.ts` 只能导入以下来源：
  - 同域 DTO 文件或共享字段片段 DTO
  - `@libs/*/<domain>/contracts`
  - `@libs/platform/*`
  - `@db/schema` 的纯类型或稳定常量（确有需要时）
- `*.dto.ts` 禁止导入以下来源：
  - `@libs/*/<domain>` root 入口（当该入口同时导出运行时对象时）
  - `@libs/*/<domain>/core`
  - 任何 `*.service.ts`、`*.module.ts`、`*.resolver.ts`
- 使用 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 时，传入的基类必须来自 cycle-safe 的 DTO / contracts 入口。

### 3.2 Service / Resolver / Module 文件

- `*.service.ts`、`*.resolver.ts`、`*.module.ts` 优先导入：
  - 同域 `core`
  - 跨域 `core`
  - 必要的 `contracts`
- 运行时文件禁止依赖仅为 DTO 聚合而设计的出口。
- 运行时文件若仅需要接口、常量或 Service，不应从跨域 root 入口导入整个模块。

### 3.3 App 装配层

- `apps/*` 可以使用 root 入口消费稳定公共 API，但新增代码优先使用语义更清晰的 `contracts` / `core` 子入口。
- `apps/*` 中的模块装配优先使用 `module` 子入口；仅在确无模块子入口时，才使用 root 入口承接模块聚合。
- Controller 若只消费 DTO 契约，优先从 `contracts` 入口导入。
- 应用启动装配、模块 wiring、对外聚合导出可使用 root 入口，但不能把 root 入口再回流给 `libs/*` 内部实现。
- 对单域库同样适用以上规则；区别只在于路径为 `@libs/<lib>/contracts|core|module`，而不是 `@libs/<lib>/<domain>/...`。

## 4. 允许与禁止的路径形态

### 4.1 允许的公共子入口

- `@libs/<lib>/<domain>/contracts`
- `@libs/<lib>/<domain>/core`
- `@libs/<lib>/<domain>/module`
- `@libs/<lib>/contracts`
- `@libs/<lib>/core`
- `@libs/<lib>/module`
- 仓库中显式声明并在规范中登记的其他公共子入口

以上路径视为受支持的公共 API，不视为 deep import。

### 4.2 禁止的 deep import

- `@libs/<lib>/<domain>/dto/*.dto`
- `@libs/<lib>/<domain>/**/*.service`
- `@libs/<lib>/<domain>/**/*.module`
- `@libs/<lib>/<domain>/**/*.resolver`
- 未经登记的任意文件级路径

如确需临时使用文件级 deep import，必须在 PR 说明中注明原因、影响面与回收计划，并在后续迭代补齐公共子入口。

## 5. 循环依赖防线

### 5.1 典型高风险模式

- `DTO -> root barrel -> Service -> root barrel -> DTO`
- `contracts -> root barrel -> Module -> provider -> DTO`
- `Service A -> root barrel B -> DTO B -> root barrel A -> Service A`
- 通过 `export *` 聚合多个子域，导致只想拿 DTO 却顺带加载整个运行时实现

### 5.2 修复原则

- 优先拆分出口职责，而不是通过修改 `export *` 顺序规避异常。
- 优先减少 root barrel 的导出内容，而不是在消费方继续叠加兼容写法。
- 若 DTO 仅需若干稳定字段，优先复用 `contracts` 中的快照 DTO 或基类 DTO。
- 若运行时文件只需要 Service、接口、常量，优先导入 `core` 而非 root 入口。

## 6. 设计与落地流程

1. 新增业务域时，先决定该域是否需要 `contracts` 与 `core` 两层公共出口。
2. 新增 root 入口时，先检查该入口是否会同时导出 DTO 与运行时对象。
3. 编写 DTO 前，先确认基类 DTO 是否已通过 `contracts` 暴露。
4. 编写 Service / Resolver 前，先确认跨域依赖是否已有 `core` 入口可复用。
5. 发现循环依赖时，优先回到公共出口设计层处理，不在消费方做临时规避。
6. 引入 lint 限制前，先盘点现存违规导入，明确迁移顺序与例外清单。

## 7. 现状例外与迁移策略

- 本规范对新增文件与本次变更触达的文件立即生效。
- 存量模块不要求为了“满足规范”而立即全量改造；未触达模块可在后续业务改动、缺陷修复或依赖收敛时逐步迁移。
- 若某存量模块已造成启动失败、测试失败、打包异常、`PickType` / `OmitType` 运行时异常或明显循环依赖，应作为高优先级技术债优先修复。
- 在未开启全局强制 lint 前，允许保留历史 root import，但新增同类写法视为违规。
- 计划启用 `eslint no-restricted-imports` 或等价规则时，应先完成高频域与基础域的首轮迁移，再逐步收紧到全仓。
- 历史上名称已带有 `core`、`contract`、`module` 的入口，如实际导出内容仍为混合职责，不因命名符合约定而自动视为合规；迁移时仍需按职责重新拆分。

## 8. 验收清单

- [ ] DTO 文件未从同时导出运行时对象的 root 入口导入基类 DTO。
- [ ] Service、Resolver、Module 未为获取少量运行时对象而导入跨域 root 入口。
- [ ] 新增公共子入口职责单一，`contracts` 与 `core` 未混放不相干导出。
- [ ] 未新增文件级 deep import；若存在历史例外，已说明原因与回收计划。
- [ ] 映射类型（`PickType` / `OmitType` / `PartialType` / `IntersectionType`）的基类来源可安全参与运行时初始化。
- [ ] 新增或修改的代码未通过导出顺序规避循环依赖。
- [ ] 如计划启用 lint 限制，已明确迁移范围与分阶段落地策略。

# 项目导入边界规范

适用范围：本仓库所有 `apps/*`、`libs/*`、`db/*`、`scripts/*` 下的 TypeScript / JavaScript 代码，重点约束 `libs/*` 内部模块之间的跨域导入方式、循环依赖防线与文件归属边界。

## 1. 核心原则

- 全仓统一使用文件直连导入；业务域不再依赖 `index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts` 等聚合或转发入口。
- `libs/platform` 作为基础设施层，允许在目录级建立 public API：`libs/platform/src/**/index.ts` 可作为受控统一导出入口，但不允许恢复根级 `@libs/platform` 总出口，也不允许恢复 `@libs/platform/module` 这类历史兼容入口。
- DTO 契约与运行时实现仍然分层，但分层通过“文件归属”表达，不通过 barrel 表达。
- DTO 文件只能依赖 cycle-safe 的 DTO 文件、稳定常量或纯类型；不能间接拉起 Service、Module 或其他运行时对象。
- Service、Resolver、Module、Controller 直接依赖各自所需的具体文件，不通过中间入口“顺手带出”其他符号。
- 禁止通过“调整导出顺序”掩盖循环依赖；应通过收敛共享字段、拆分 DTO 文件或调整依赖方向解决根因。

## 2. 文件直连模型

### 2.1 默认导入形态

- DTO：直连 DTO 所在文件，例如 `@libs/content/work/core/dto/work.dto`
- Module：直连模块文件，例如 `@libs/interaction/comment/comment.module`
- Service：直连服务文件，例如 `@libs/user/user.service`、`@libs/content/work/core/work.service`
- Constant / type / helper：直连拥有该符号的具体文件

推荐约定：

- 同域内部优先使用相对路径
- 跨域导入优先使用 alias + 具体文件路径
- 同一批字段若需要跨多个 DTO 复用，应抽成具名 DTO 文件，而不是新增 barrel

### 2.2 明确禁止

- 禁止新增任何以“转发导出”为唯一职责的文件，例如：
  - `index.ts`
  - `dto/index.ts`
  - `core/index.ts`
  - `module/index.ts`
  - `module.ts`
  - `contracts.ts`
  - `base.ts`（若它只是转发多个 DTO）
- 禁止为了缩短路径而新增“公共出口文件”
- 唯一例外是 `libs/platform/src/**/index.ts` 形式的目录级 public API；它们只对 `platform` 生效，可以 re-export 同目录 owner 文件或更细一层的 `platform` 子目录 public API，但不能把业务域重新聚合成新的 mega barrel。
- 禁止跨域导入目录语义路径，必须直达具体文件

### 2.3 允许的共享抽象

若多个调用方都需要相同 DTO 基类或字段片段，允许：

- 新增真正承载定义的 DTO 文件，例如 `shared-user.dto.ts`
- 把共享字段移动到已有 owner DTO 文件

不允许：

- 通过 `dto/index.ts`
- 通过 `dto/base.ts`
- 通过任意“只 export *”的中转文件

## 3. 分层导入规则

### 3.1 DTO 文件

- `*.dto.ts` 只能导入以下来源：
  - 同域 DTO 文件或共享字段片段 DTO 文件
  - 跨域 DTO 具体文件
  - `@libs/platform/*` 下稳定装饰器、基础 DTO、常量
  - `@db/schema` 的纯类型或稳定常量（确有需要时）
- `*.dto.ts` 禁止导入以下来源：
  - 任何 `index.ts` barrel
  - 任何 `*.service.ts`、`*.module.ts`、`*.resolver.ts`
  - 任何只做转发的 `module.ts`、`base.ts`、`contracts.ts`
- 使用 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 时，传入的基类必须来自具体 DTO 文件。

### 3.2 Service / Resolver / Module / Controller 文件

- `*.service.ts`、`*.resolver.ts`、`*.module.ts`、`*.controller.ts` 统一直连具体文件。
- 若只需要 DTO 契约，直接导入 DTO 文件；不要再经由 DTO barrel。
- 若只需要 `Module`，直接导入 `*.module.ts`；不要再经由 `module/index.ts` 或 `module.ts`。
- 若只需要 `Service`、常量、helper、type，也必须导入具体拥有者文件。
- 若依赖 `platform` 基础设施能力，允许使用 `@libs/platform/<folder>`、`@libs/platform/<folder>/<subfolder>` 这类目录级 public API，例如 `@libs/platform/config`、`@libs/platform/decorators`、`@libs/platform/dto`、`@libs/platform/utils`、`@libs/platform/modules/auth`。
- `platform` 目录级导入遵循“越小越好”原则：优先 `@libs/platform/modules/auth`，其次才是 `@libs/platform/modules` 这类更宽的聚合入口。

### 3.3 App 装配层

- `apps/*` 不是例外，同样必须直连具体文件。
- 应用装配可以依赖真正的聚合模块本体，例如 `libs/forum/src/forum.module.ts`，但不能通过额外 barrel 转发到它。
- Controller 若同时依赖 DTO 与 Service，必须拆成多条直连 import，不允许从单一入口混合取值。

## 4. 路径形态规范

### 4.1 允许的路径

- 指向具体 owner 文件的 alias 路径
- 指向同域具体文件的相对路径

示例：

- `@libs/content/work/core/dto/work.dto`
- `@libs/interaction/comment/comment.module`
- `@libs/growth/point/point.service`
- `@libs/platform/config`
- `@libs/platform/constant`
- `@libs/platform/decorators`
- `@libs/platform/decorators/validate`
- `@libs/platform/dto`
- `@libs/platform/filters`
- `@libs/platform/modules/auth`
- `@libs/platform/types`
- `@libs/platform/utils`
- `../dto/forum-topic.dto`

### 4.2 禁止的路径

- 任何目录级导入，只要其目标依赖 barrel 解析，例如：
  - `@libs/content/work`
  - `@libs/content/work/dto`
  - `@libs/interaction/comment`
  - `@libs/interaction/comment/module`
  - `@libs/user`
  - `@libs/user/dto`
- 除 `libs/platform/src/**/index.ts` 对应的 `platform` 目录级 public API 外，其他 `@libs/platform/<dir>` 目录级入口若解析到转发文件，也一律禁止。
- `@libs/platform` 根级入口与 `@libs/platform/module` 历史兼容入口一律禁止。
- 任何文件级转发入口，例如：
  - `*/index`
  - `*/module`
  - `*/contracts`
  - `*/base`（如果它只是 re-export）

### 4.3 关于 deep import

- 本仓库不再把“文件级 deep import”视为例外；文件直连就是标准导入方式。
- 真正应被禁止的不是“deep import”，而是“导入转发入口而非 owner 文件”。

## 5. 循环依赖防线

### 5.1 典型高风险模式

- `DTO -> barrel -> runtime -> barrel -> DTO`
- `Module -> barrel -> DTO -> barrel -> Module`
- `Service A -> barrel B -> DTO B -> barrel A -> Service A`
- 通过 `export *` 聚合多个子域，导致只想拿一个类却把整条依赖链都执行了

### 5.2 修复原则

- 优先改成文件直连，而不是新增另一层中转入口。
- 优先把共享字段移到 owner DTO 文件，而不是新增 `dto/base.ts` 一类聚合文件。
- 若运行时文件只需要 `Module`、`Service`、常量，直接导入拥有者文件；不要再从 DTO 或聚合入口反向取值。
- 若 DTO 与运行时文件确实互相需要稳定结构，应把契约下沉到独立 DTO 文件，而不是让 DTO 触碰运行时文件。

## 6. 设计与落地流程

1. 新增业务域时，先确定 DTO owner 文件、Service owner 文件、Module owner 文件，而不是先建 barrel。
2. 编写 DTO 前，先确认基类 DTO 是否已经存在于某个具体 DTO 文件中；若没有，就新增 owner DTO 文件。
3. 编写 Service / Resolver / Module 前，先确认跨域依赖的具体文件归属，再直接导入该文件。
4. 发现循环依赖时，先删除中转入口和聚合依赖，再判断是否需要拆分共享 DTO 文件。
5. 引入 lint 限制前，先盘点仓库内现存 barrel 与转发文件，明确迁移顺序和例外清单。

## 7. 现状例外与迁移策略

- 本规范对新增文件与本次变更触达的文件立即生效。
- 存量 barrel 可以暂时存在于仓库中，但只作为待迁移技术债，不再作为新代码可用入口。
- 若某存量 barrel 已造成启动失败、测试失败、打包异常、`PickType` / `OmitType` 运行时异常或明显循环依赖，应作为高优先级技术债立即回收。
- 在未开启全局强制 lint 前，允许存量代码继续存在，但新增同类写法一律视为违规。
- 历史上名称已带有 `core`、`contract`、`contracts`、`module` 的入口，如实际承担转发职责，也不视为合规。

## 8. 验收清单

- [ ] DTO 文件未从任何 barrel 或转发文件导入基类 DTO。
- [ ] Service、Resolver、Module、Controller 已统一直连 owner 文件。
- [ ] 仓库中未新增未获批准的 `index.ts`、`module.ts`、`contracts.ts`、`base.ts` 这类转发文件；`libs/platform` 仅允许目录级 `index.ts` public API。
- [ ] 映射类型（`PickType` / `OmitType` / `PartialType` / `IntersectionType`）的基类来源可安全参与运行时初始化。
- [ ] 新增或修改的代码未通过导出顺序、额外转发层或目录级导入规避循环依赖。
- [ ] 如计划启用 lint 限制，已明确迁移范围与分阶段落地策略。

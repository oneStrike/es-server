# ES Server 规范总览（单一事实源）

本文件是仓库内**唯一**规范事实源，旧专项文件已移除，所有规范以本文件为准。

## 0. 决策顺序

1. 当前可运行的共享抽象、真实脚本与现有对外契约。
2. `AGENTS.md` 的项目级最小约束与验证基线。
3. 本文件。
4. 同一业务域相邻模块的稳定实现。

若规范与当前稳定运行的客户端契约、错误语义、迁移窗口或部署现实冲突，以兼容性优先，并在交付说明中记录冲突点与暂行决策。

## 1. 导入边界

### 1.1 核心原则

- 全仓统一使用文件直连导入；业务域不依赖 `index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts` 等转发入口。
- `libs/platform` 允许目录级 public API：`libs/platform/src/**/index.ts` 可作为受控统一导出入口，但不允许根级 `@libs/platform` 总出口，也不允许 `@libs/platform/modules` 等宽聚合入口。
- DTO 文件只依赖稳定 DTO/常量/类型；禁止通过 DTO 拉起运行时对象。
- Service、Resolver、Module、Controller 直接依赖 owner 文件，不通过中间入口“顺手带出”其他符号。
- 禁止通过“调整导出顺序”掩盖循环依赖；应通过收敛共享字段或调整依赖方向解决根因。

### 1.3 明确禁止

- 禁止新增转发入口：`index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts`、`base.ts`（仅转发时）
- 禁止为了缩短路径新增“公共出口文件”
- 唯一例外：`libs/platform/src/**/index.ts` 目录级 public API
- 禁止跨域导入目录语义路径，必须直达具体文件

### 1.4 分层导入规则

- DTO 文件仅可导入：同域 DTO、跨域 DTO 具体文件、`@libs/platform/*` 基础能力、必要的 `@db/schema` 类型或常量。
- DTO 文件禁止导入：任何 barrel、`*.service.ts`、`*.module.ts`、`*.resolver.ts`。
- Service / Resolver / Module / Controller 必须直连具体文件，不通过 DTO barrel。
- `apps/*` 也必须直连具体文件，不是例外。

## 2. Controller 规范

适用范围：`apps/admin-api`、`apps/app-api` 的 Controller、Module 与 Swagger 暴露层。

### 2.1 核心原则

- 接口继续采用 RPC over HTTP，不强制改成 REST。
- Controller 只负责入参接收、上下文装配、权限与审计装饰器、Swagger 注解、调用 service。
- Controller 入参 DTO 与响应 DTO 统一从 `libs/*` 复用；`apps/*` 不重复定义同构 DTO。
- Controller 不写数据库查询，不承载复杂业务编排，不保留第二套正式业务实现。
- breaking change 必须提供 versioning / compat 方案与下线计划。

### 2.2 路由规范

- `@Controller()` 路径统一写成 `admin/...` 或 `app/...`，不带前导斜杠，不重复写 `/api`。
- 路径 segment 统一使用 `kebab-case`。
- 通用动作名统一使用：`page`、`list`、`detail`、`create`、`update`、`delete`、`update-status`、`update-enabled`、`swap-sort-order`、`my/page`。
- 二级资源与动作型接口统一使用 `noun/action` 形式。

### 2.3 Swagger 规范

- 统一使用 `ApiDoc`、`ApiPageDoc`。
- 响应模型必须是输出 DTO 或基础类型；禁止把 `CreateXxxDto`、`UpdateXxxDto` 作为输出模型。
- `ApiPageDoc` 只用于真实返回分页结构的接口。
- `@ApiTags` 只用于文档分组，不驱动模块拆分。

### 2.4 返回语义

- 纯成功确认类接口优先 `boolean` 或 `204 No Content`。
- `create`、需要立即回显新状态的 `update`、需要返回快照的动作型接口，可返回 `id`、最小成功载荷或资源快照。

### 2.5 权限与审计

- admin-api 默认受保护，`@Public()` 只用于认证或明确公开能力。
- admin 侧变更类接口优先补齐审计装饰器。

### 2.6 兼容与维护

- 兼容入口必须复用同一 service 或共享编排逻辑，不复制第二套业务实现。
- 发现规范与当前稳定契约冲突时，优先记录例外，不静默改坏线上行为。

## 3. DTO 规范

### 3.1 目标与原则

- 业务场景 DTO 统一定义在 `libs/*`，`apps/*` 不重复定义同构 DTO。
- Controller 与 Service 的公开方法入参、出参与 DTO 保持 1:1。
- 实体字段与物理约束以 Drizzle Table 为准。
- DTO 文件默认按 schema / table 收口，不新增 `*.public.dto.ts`。
- 与 DTO 同构的 `Input/View` 类型应删除，直接使用 DTO。

### 3.2 分层与职责

- `libs/platform`：基础 DTO 复用层。
- `libs/*`：实体基类 DTO（`BaseXxxDto`）与场景 DTO（`Create/Update/Query/Response`）。
- `libs/*/*.type.ts`：仅承载非 HTTP 的内部领域结构。
- `apps/*`：入口装配层，仅消费 DTO。

### 3.3 复用与收敛

- 优先 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 组合，避免字段复制。
- 禁止新增纯别名 DTO 或 DTO barrel。
- `contract: false` 用于排除不对外字段。
- 枚举数组字段统一使用 `ArrayProperty` + `itemEnum`，类型为 `XxxEnum[]`。
- 枚举字段描述使用“实际枚举值=业务含义”。

## 4. TypeScript 类型规范

### 4.1 核心原则

- `db/schema` 推导类型是实体字段的单一事实源。
- 与 DTO 同构的 `Input/View` 类型不重复定义。
- `*.type.ts` 只承载非 HTTP 契约结构。
- 纯类型依赖统一使用 `import type`。

## 5. 注释规范

### 5.1 核心原则

- 注释解释原因、约束、语义和风险，不逐句翻译代码。
- 大型 Service/Helper 先整理结构，再补注释。
- 默认使用简体中文，专有名词保留英文。

### 5.2 必须写注释的场景

- Service/Resolver/Extension/Helper 的公共入口方法与关键私有方法。
- `*.type.ts` 中导出的稳定领域类型。
- 事务/幂等/重试/补偿/原生 SQL 等关键语义。

### 5.3 禁止写法

- 模板化空注释、逐行翻译、与实际行为不一致的历史描述。

## 6. 错误处理规范

### 6.1 总体原则

- 业务错误由业务层定性，全局层只兜底。
- 数据库错误在 Drizzle 边界分类，不在 controller 重复发明语义。
- 幂等优先数据库原生写法，不以异常驱动正常流程。
- 读接口附带写入必须可降级。

### 6.2 分层职责

- ValidationPipe：参数校验与转换，输出 `400`。
- Controller：入参接收与编排，不翻译数据库错误。
- Service/Resolver：抛明确的 Nest 异常并翻译业务语义。
- Drizzle：统一 `withErrorHandling`/`assertAffectedRows`。
- 全局过滤器：统一错误响应结构与结构化日志。

### 6.3 数据库错误处理

- PostgreSQL 默认错误码映射以 `db/core/error/postgres-error.ts` 为单一来源。
- 错误转换必须保留原始 `cause`，日志包含 `errorCode/Constraint/Table/Column/Detail`。

## 7. Drizzle 使用规范

### 7.1 核心原则

- 统一通过 `DrizzleService` 使用 `drizzle.db`、`drizzle.schema`、`drizzle.ext`。
- 事务通过 `db.transaction(async (tx) => ...)` 并沿链路显式透传。

### 7.2 查询与分页

- 常规分页使用 `drizzle.ext.findPagination(...)`。
- 分页统一 1-based `pageIndex`。
- 动态条件使用 `SQL[] + and(...)`。
- 排序字段必须显式声明。

### 7.3 写路径与原生 SQL

- 计数、余额、库存等增减使用原子更新并与事实写入同事务。
- 原生 SQL 仅允许 `sql\`...\``与`db.execute`，禁止字符串拼接。

### 7.4 Migration 规范

- 常规 schema 差异默认使用 `pnpm db:generate` 生成。
- 若生成过程中出现交互，必须停止并由用户亲自执行。
- 无法生成的 DDL 可手写补充，但必须说明原因、范围与风险。

## 8. 测试规范

### 8.1 目标与原则

- 行为优先，验证对外行为与错误语义。
- 分层验证，避免所有问题都堆到 E2E。
- 事务、分页、时间语义、幂等、快照冻结、计数器同步等高风险逻辑必须有测试。
- 任务完成后需要生成的测试文件，确保项目中不存在测试文件。完整且成熟度测试文件允许保留

### 8.2 默认验证命令

- `pnpm test -- --runInBand --runTestsByPath <spec-path-1> <spec-path-2>`
- `pnpm type-check`
- `pnpm test`
- `pnpm test:e2e` 仍指向缺失配置，不作为默认验证命令。

## 9. 数据库表命名规范

### 9.1 核心原则

- 表名使用 `snake_case` 单数。
- 命名优先表达“它是什么”，而不是“它做什么”。
- 若改名影响 migration、存量数据或 SQL 契约，以兼容性优先。

### 9.2 前缀与后缀规则

- 域前缀：`admin_*`、`app_*`、`forum_*`、`work_*`、`sys_*`。
- `app_user*` 用于账号主体及附属表，`user_*` 用于用户行为事实表。
- 后缀示例：`_log`、`_record`、`_count`、`_rule`、`_token`、`_assignment`、`_outbox`。

### 9.3 关系表规则

- 多对多中间表优先使用“左实体 + 右实体”命名。
- `work_*` 子域已有 `_relation` 体系时继续沿用。

## 10. 计数器规范

### 10.1 硬约束

- 计数必须能追溯到事实表或上游对象状态。
- 同一计数字段只有一个 owner。
- 事实写入与计数更新必须在同一事务中完成。
- 增减计数使用原子更新，禁止“先查再算再写回”。
- 可减计数防止下穿为负数，并区分“目标不存在”和“计数不足”。

## 11. 方案与清单文档规范

### 11.1 核心原则

- 文档分层清晰：每类文档只承载一种主要职责。
- 排期、依赖、状态等关键信息只有唯一事实源。
- 每个任务具备明确输入、输出与验收证据。

### 11.2 标准文档集

- `README.md`、`execution-plan.md`、`development-plan.md`、`p0/`、`p1/`、`p2/`、`checklists/`。

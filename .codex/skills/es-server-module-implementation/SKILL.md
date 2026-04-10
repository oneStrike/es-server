---
name: es-server-module-implementation
description: Use when implementing, refactoring, or reviewing a business module in this `es-server` monorepo that spans NestJS controllers/modules, `libs/*` DTOs, internal `*.type.ts`, and Drizzle-backed schema or queries.
---

# ES Server Module Implementation

## 概述

当工作涉及 `apps/admin-api`、`apps/app-api`、`libs/*` 或 `db/*` 的同一业务模块时使用这个技能。
目标是先收敛契约，再实现逻辑，最后验证 Controller、DTO、类型、注释、NestJS 模块关系和 Drizzle 查询是否一致。

## 进入工作前必读

- Controller 规则：`../../../.trae/rules/PROJECT_RULES.md`
- DTO 规则：`../../../.trae/rules/PROJECT_RULES.md`
- 注释规则：`../../../.trae/rules/PROJECT_RULES.md`
- TypeScript 类型规则：`../../../.trae/rules/PROJECT_RULES.md`
- NestJS 约束：`../NestJS/SKILL.md`
- Drizzle 参考：`../lb-drizzle-skill/SKILL.md`

即使这次只改一层，也要先读对应规则，再开始改代码。

## 执行顺序

1. 先定位 owner：共享契约在 `libs/*`，入口在 `apps/*`，表结构在 `db/schema`。
2. 先用 `rg` 看同域兄弟模块，复用既有路由命名、DTO 组合方式、查询风格和返回语义。
3. 先定 DTO 和 service 公开签名，再写 controller；不要先从 controller 或数据库表拼接口。
4. 只有当结构不是 HTTP 契约时，才新增 `*.type.ts`；若与 DTO 同构，直接复用 DTO。
5. 只有在业务确实需要时才改 schema、migration 或 query shape；表字段、可空性和推导类型始终以 Drizzle schema 为准。
6. Service 负责业务编排、查询和事务边界；controller 只做协议层装配。
7. 每次改动后按最小范围跑验证：相关测试、`eslint`、`pnpm type-check`。
8. 若为验证当前改动临时新增 `*.spec.ts`、脚本或探针文件，完成验证后按仓库约定删除，不把一次性验证资产留在模块里。
9. 交付说明里明确兼容性、风险点和例外，不静默扩散历史坏模式。

## Controller Checklist

- `@Controller()` 统一用 `admin/...` 或 `app/...`，不带 `/api` 和前导斜杠。
- path segment 必须是 `kebab-case`。
- 动作用统一语义：`page`、`list`、`detail`、`create`、`update`、`delete`、`update-status`、`update-enabled`、`swap-sort-order`、`my/page`。
- 自定义动作用 `noun/action`，命名直接表达业务语义。
- Controller 只保留参数接收、上下文装配、权限或审计装饰器、Swagger 注解、调用 service。
- 不在 controller 写数据库查询、复杂分支编排或第二套业务实现。
- Swagger 统一使用 `ApiDoc`、`ApiPageDoc`。
- 输出模型必须是响应 DTO 或基础类型，不能把 `CreateXxxDto`、`UpdateXxxDto` 反向当响应 DTO。
- 纯成功确认接口优先返回 `boolean` 或 `204`；确实需要回显时再返回最小必要载荷。
- 变更线上稳定契约前，先给出 compat、versioning 或下线方案。

## DTO Checklist

- 业务场景 DTO 统一放在 `libs/*`，`apps/*` 不复制同构 DTO。
- Service 公开方法的入参与出参与 DTO 保持 1:1，字段、可选性和类型一致。
- 实体字段与物理约束以 Drizzle table 为准；`BaseXxxDto` 仅承载跨场景稳定字段。
- 一个 schema 表对应一个 `xxx.dto.ts`；不要把多张表的基础 DTO 混在同一文件。
- 场景 DTO 优先与所属表的 `xxx.dto.ts` 同文件收口，不新增 `*.public.dto.ts`、`*.app.dto.ts`、`*.admin.dto.ts`。
- 优先用 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 组合复用字段，避免大段复制。
- `PickType` 和 `OmitType` 选字段更少的一侧；`IntersectionType` 组合三个及以上 DTO 时保持单层调用。
- 不新增纯别名 DTO，也不为业务域 DTO 新增 `index.ts`、`base.ts` 这类 barrel。
- 非前端契约字段优先用 `contract: false` 收口；`bizKey`、`deletedAt` 等内部字段默认不对前端暴露。
- 枚举数组统一用 `ArrayProperty` 加 `itemEnum`，TypeScript 类型写成 `XxxEnum[]`，不要写裸 `number[]`。
- 枚举字段 `description` 要写成“真实值=业务含义”的形式。
- 日期时间 Swagger `example` 统一用 ISO 8601。

## Type Checklist

- `*.type.ts` 只放内部领域结构，例如事务上下文、聚合结果、数据库投影、事件载荷、快照。
- 与 DTO 同构的 `Input/View` 类型不要重复定义，直接复用 DTO。
- 优先从 `@db/schema` 的实体类型或 `Entity['field']`、`Pick`、`Omit`、`Partial` 组合字段。
- 纯类型导入统一使用 `import type`。
- 新增内部业务类型默认放在靠近 owner 模块的 `*.type.ts`。
- SQL 投影和聚合结果必须有显式类型；不要用稳定结构的 `Record<string, unknown>` 冒充。
- 禁止 `any`、`as any`、`tx: any` 这类类型逃逸。
- 分页查询统一沿用 `pageIndex`、`pageSize`、`orderBy`，其中 `pageIndex` 为 1-based。

## Service / NestJS / Drizzle Checklist

- NestJS 里优先导入 module，不直接把别的模块 provider 塞进本模块 `providers`。
- 被其他模块消费的 provider 必须正确 `export`；有循环依赖时在双方模块使用 `forwardRef(() => Module)`。
- DTO 校验依赖 `class-validator` 装饰器；嵌套对象需要 `@ValidateNested()` 和 `@Type(() => XxxDto)` 同时存在。
- `@Body()`、`@Param()` 入口要明确转换和验证需求，不要把裸对象直接下沉到 service。
- 抛异常用 NestJS 内建异常或明确业务异常，不要靠返回值伪装错误。
- 查询和写入优先使用 Drizzle 的类型安全能力，不要无意义退回手写字符串 SQL。
- 原生 SQL、复杂查询、性能取舍必须参数化，并写明约束、风险和原因。
- 事务边界要清晰；一旦开启事务，相关调用链都要显式传递事务上下文。
- 只有在业务真的需要拿回新数据时才使用 `returning()`，不要为了形式统一而滥用。
- schema 变更时同步考虑推导类型、DTO 暴露面、查询条件、默认值和兼容影响。

## 注释 Checklist

- 默认使用简体中文，术语和库名保留英文。
- 注释解释原因、约束、语义、风险，不逐句翻译代码。
- Service、Resolver、Extension、Helper 的每个方法都要有注释，重点写前置条件、事务要求、副作用、兼容语义和失败语义。
- `*.type.ts` 中导出的稳定内部类型要写一句用途说明。
- Controller 和 DTO 注释保持克制，不重复 Swagger、校验器或类型已经表达的信息。
- `//` 行内注释只用于局部约束、顺序依赖、兼容原因或关键分支。
- `TODO/FIXME` 必须写清原因、触发条件和清理时机。
- 大型 Service、Helper 先整理方法分组和阅读顺序，再补注释；不要靠堆注释补结构问题。

## 交付前检查

- [ ] Controller 仍是薄层，路径、动作名、Swagger 和权限语义正确。
- [ ] DTO 全部收敛在 `libs/*`，service 公开签名与 DTO 1:1。
- [ ] 没有新增 DTO 镜像类型、端侧拆分 DTO 文件或业务域 DTO barrel。
- [ ] `*.type.ts` 只承载非 HTTP 结构，且使用 `import type`。
- [ ] Drizzle schema、query、transaction、returning 语义与真实业务一致。
- [ ] Service、Helper、exported type comments 满足注释规范。
- [ ] 相关测试、`eslint`、`pnpm type-check` 已完成。
- [ ] 若为了本次任务临时新增验证文件，交付前已删除。

## 参考

- 如需更细的 NestJS DI、校验和异常处理提醒，继续看 `../NestJS/SKILL.md`。
- 如需更细的 Drizzle 查询、事务、schema 或 migration 语法，继续看 `../lb-drizzle-skill/SKILL.md`。

# ES Server 规范总览

本文件是仓库内规范的索引入口。

## AI 快速入口

- 不确定这次改动先读哪篇规则时，先读 [AI 规则快速路由](./AI_RULE_ROUTER.md)
- 遇到 `owner 文件`、`canonical contract`、`闭集字段` 这类术语时，读 [AI 术语表](./AI_TERMS.md)
- 看到仓库现实与理想规则不完全一致时，先读 [AI 已知例外](./AI_EXCEPTIONS.md)

上述 3 份文档只作导航、释义与例外汇总，不替代本文件和 `01-09` 专项规则。

## 决策顺序

1. 已接受且仍有效的 ADR；只在其显式范围内覆盖既有实现。
2. 当前可运行的共享抽象、真实脚本与 canonical contract。
3. `AGENTS.md` 的项目级最小约束与验证基线。
4. 本目录下各专项规范文件。
5. 同一业务域相邻模块的稳定实现。

破坏性更新只保留当前 canonical contract，不保留旧客户端、旧配置、旧数据值域或旧 migration log 的运行时解释能力。未被显式决策覆盖的 contract 变化必须先形成新的显式决策。

## 顶层 owner 边界

- `apps/*` 是入口与 app-exclusive 纵向业务 owner；只被单一 app 使用的业务逻辑、DTO、provider adapter 与 DB provider 可以放在对应 app 内，并由该 app 的 composition root 显式装配。
- `libs/*` 只承载跨 app 或真实共享领域。不得为了“看起来共享”把 app-only DTO、admin/app 专属 auth、RBAC runtime、token storage adapter 或其他单 app 纵向能力提升到 `libs/*`。
- `db/*` 继续拥有 schema、relation、Drizzle core、migration、comments 与 seed/bootstrap 操作事实源；业务 owner 可以消费受控 `@db/schema` / `@db/core` public API，但不能复制 schema/relation source。
- identity hard cut 不保留 `libs/identity`、`@libs/identity/*`、`IdentityModule`、替代 identity umbrella、compat shim、alias re-export、双读双写、旧字段/旧 ORM API fallback 或旧 migration journal 解释能力。
- 仓库不保留测试文件；验证资产只能是受控 operation/static gate、脱敏 evidence 或使用后删除的一次性 probe。

## 规范文件索引

- [导入边界规范](./01-import-boundaries.md) - 导入边界与分层规则
- [Controller 规范](./02-controller.md) - Controller、Module 与 Swagger 暴露层
- [DTO 规范](./03-dto.md) - DTO 定义、复用与枚举字段描述规范
- [TypeScript 类型规范](./04-typescript-types.md) - TypeScript 类型定义与复用规范
- [注释规范](./05-comments.md) - 代码注释与数据表字段注释要求
- [错误处理规范](./06-error-handling.md) - 错误处理、异常与业务码规范
- [Drizzle 使用规范](./07-drizzle.md) - Drizzle ORM 使用、查询与 Migration 规范
- [测试与验证规范](./08-testing.md) - 可重复验证、脱敏 evidence 与交付验证
- [NestJS 架构规范](./09-nestjs-architecture.md) - package DAG、provider owner、跨域协作与协议装配

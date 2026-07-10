# ES Server 规范总览

本文件是仓库内规范的索引入口。

## AI 快速入口

- 不确定这次改动先读哪篇规则时，先读 [AI 规则快速路由](./AI_RULE_ROUTER.md)
- 遇到 `owner 文件`、`canonical contract`、`闭集字段` 这类术语时，读 [AI 术语表](./AI_TERMS.md)
- 看到仓库现实与理想规则不完全一致时，先读 [AI 已知例外](./AI_EXCEPTIONS.md)

上述 3 份文档只作导航、释义与例外汇总，不替代本文件和 `01-09` 专项规则。

当前已接受的破坏性开发纪元 ADR：

- [零债务开发纪元](../../docs/architecture/zero-debt-development-epoch.md)

## 决策顺序

1. 已接受且仍有效的 ADR；只在其显式范围内覆盖既有实现。
2. 当前可运行的共享抽象、真实脚本与 canonical contract。
3. `AGENTS.md` 的项目级最小约束与验证基线。
4. 本目录下各专项规范文件。
5. 同一业务域相邻模块的稳定实现。

零债务开发纪元范围内只保留该纪元定义的 canonical contract，不保留旧客户端、旧配置、旧数据值域或旧 migration log 的运行时解释能力。未被 ADR 覆盖的 contract 变化必须先形成新的显式决策。

## 规范文件索引

- [导入边界规范](./01-import-boundaries.md) - 导入边界与分层规则
- [Controller 规范](./02-controller.md) - Controller、Module 与 Swagger 暴露层
- [DTO 规范](./03-dto.md) - DTO 定义、复用与枚举字段描述规范
- [TypeScript 类型规范](./04-typescript-types.md) - TypeScript 类型定义与复用规范
- [注释规范](./05-comments.md) - 代码注释与数据表字段注释要求
- [错误处理规范](./06-error-handling.md) - 错误处理、异常与业务码规范
- [Drizzle 使用规范](./07-drizzle.md) - Drizzle ORM 使用、查询与 Migration 规范
- [测试与验证规范](./08-testing.md) - 长期测试资产、覆盖率、性能门禁与交付验证
- [NestJS 架构规范](./09-nestjs-architecture.md) - package DAG、provider owner、跨域协作与协议装配

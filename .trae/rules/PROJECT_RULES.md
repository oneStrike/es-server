# ES Server 规范总览

本文件是仓库内规范的索引入口，各专项规范已拆分为独立文件。

## 决策顺序

1. 当前可运行的共享抽象、真实脚本与现有对外契约。
2. `AGENTS.md` 的项目级最小约束与验证基线。
3. 本目录下各专项规范文件。
4. 同一业务域相邻模块的稳定实现。

若规范与当前稳定运行的客户端契约、错误语义、迁移窗口或部署现实冲突，以兼容性优先，并在交付说明中记录冲突点与暂行决策。

## 规范文件索引

- [导入边界规范](./01-import-boundaries.md) - 导入边界与分层规则
- [Controller 规范](./02-controller.md) - Controller、Module 与 Swagger 暴露层
- [DTO 规范](./03-dto.md) - DTO 定义、复用与枚举字段描述规范
- [TypeScript 类型规范](./04-typescript-types.md) - TypeScript 类型定义与复用规范
- [注释规范](./05-comments.md) - 代码注释与数据表字段注释要求
- [错误处理规范](./06-error-handling.md) - 错误处理、异常与业务码规范
- [Drizzle 使用规范](./07-drizzle.md) - Drizzle ORM 使用、查询与 Migration 规范
- [测试规范](./08-testing.md) - 测试原则与验证命令
- [数据库表命名规范](./09-database-naming.md) - 表名、前缀与后缀规则
- [计数器规范](./10-counter.md) - 计数器更新与一致性约束
- [文档规范](./11-documentation.md) - 方案与清单文档标准

# Rule Index

## Primary Rule Files

- `../../AGENTS.md`: Codex 项目级工作约束、分层要求、验证命令与冲突处理方式。
- `./CONTROLLER_SPEC.md`: 路由命名、目录结构、Swagger、权限与审计规范。
- `./DTO_SPEC.md`: DTO 分层、复用方式、命名规则、Service 类型边界。
- `./TS_TYPE_SPEC.md`: TypeScript 领域类型、`db/schema` 推导类型、`*.type.ts` 放置与命名规范。
- `./COMMENT_SPEC.md`: 代码注释密度、文档注释与事务/类型说明规范。
- `./drizzle-guidelines.md`: Drizzle 入口、事务、分页、原生 SQL 与 Resolver 规范。

## Preferred Decision Order

1. 当前可运行的共享抽象与类型定义，例如 `DrizzleService`、`PageDto`、平台装饰器、`db/schema` 导出。
2. `.trae/rules/*` 下与当前改动层匹配的专项规则。
3. 同一业务域相邻模块的现有实现。

## Known Repo-Specific Inconsistencies

- 分页语义：平台层 `PageDto` 与 `findPagination` 当前兼容 0-based 和 1-based `pageIndex`；不要在业务层再次手工转换页码。
- 历史模块里仍可能存在命名或中英文错误消息不完全统一的情况；新增代码应跟随共享抽象和当前规则，而不是复制旧不一致模式。
- 仓库内同时存在 `*.type.ts` 与少量既有 `*.types.ts`；新增业务领域类型默认使用 `*.type.ts`，历史基础设施文件按 `TS_TYPE_SPEC.md` 例外处理。

## Editing Heuristics

- 同时改 controller、DTO、service 时，先对齐 controller 和 DTO 规则，再收敛 service 签名。
- 涉及 service 签名、领域输入输出、事务别名或聚合结果时，先对齐 `TS_TYPE_SPEC.md`，再决定类型放置层级。
- 仅供 service 内部使用的稳定结构，优先落到 `*.type.ts`，不要把 apps DTO 向下传递。
- 发现“规范与现状”冲突时，在交付说明里显式指出，不要默默扩散冲突。

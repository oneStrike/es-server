# Rule Index

## Primary Rule Files

- `../../../AGENTS.md`: Codex 项目级工作约束、分层要求、验证命令与冲突处理方式。
- `../../../.trae/rules/CONTROLLER_SPEC.md`: 路由命名、目录结构、Swagger、权限与审计规范。
- `../../../.trae/rules/COMMENT_SPEC.md`: 注释边界、注释密度与注释写法规范。
- `../../../.trae/rules/DTO_SPEC.md`: DTO 分层、复用方式、命名规则、Service 类型边界。
- `../../../.trae/rules/IMPORT_BOUNDARY_SPEC.md`: 公共入口分层、跨域导入边界、循环依赖防线与迁移策略。
- `../../../.trae/rules/TS_TYPE_SPEC.md`: TypeScript 领域类型、`db/schema` 推导类型、`*.type.ts` 放置与命名规范。
- `../../../.trae/rules/drizzle-guidelines.md`: Drizzle 入口、事务、分页、原生 SQL、Resolver 与 schema 注释规范。
- `../../../.trae/rules/ERROR_HANDLING_SPEC.md`: Service/Resolver 错误分层、数据库错误映射、幂等与日志规范。
- `../../../.trae/rules/COUNTER_SPEC.md`: 涉及计数字段时的事实来源、owner 与事务一致性规范。

## Preferred Decision Order

1. 当前可运行的共享抽象与类型定义，例如 `DrizzleService`、`PageDto`、平台装饰器、`db/schema` 导出。
2. `.trae` 下的专项规则文档。
3. 同一业务域相邻模块的现有实现。

## Known Repo-Specific Notes

- 分页语义：平台层 `PageDto` 与 `findPagination` 当前统一使用 1-based `pageIndex`；不要在业务层再次手工转换页码。
- 历史模块里仍可能存在命名或中英文错误消息不完全统一的情况；新增代码应跟随共享抽象和当前规则，而不是复制旧不一致模式。
- 涉及 `db/schema` 字段注释时，优先遵循 `drizzle-guidelines.md` 的 schema 注释条款。

## Editing Heuristics

- 同时改 controller、DTO、service 时，先对齐 controller 和 DTO 规则，再收敛 service 签名。
- 涉及 service 签名、领域输入输出、事务别名或聚合结果时，先对齐 `TS_TYPE_SPEC.md`，再决定类型放置层级。
- 涉及错误语义、幂等、防重与副作用降级时，必须同时对齐 `ERROR_HANDLING_SPEC.md`。
- 仅供 service 内部使用的稳定结构，优先落到 `*.type.ts`，不要把 apps DTO 向下传递。
- 涉及计数字段新增/回填/修复时，先看 `COUNTER_SPEC.md`，再按需读取参考文档。
- 发现“规范与现状”冲突时，在交付说明里显式指出，不要默默扩散冲突。

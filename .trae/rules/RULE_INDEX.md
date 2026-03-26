# Rule Index

## Primary Rule Files

- `../../AGENTS.md`: Codex 项目级工作约束、分层要求、验证命令与冲突处理方式。
- `./CONTROLLER_SPEC.md`: 路由命名、目录结构、Swagger、权限与审计规范。
- `./DTO_SPEC.md`: DTO 分层、复用方式、命名规则、Service 类型边界。
- `./TS_TYPE_SPEC.md`: TypeScript 领域类型、`db/schema` 推导类型、`*.type.ts` 放置与命名规范。
- `./COMMENT_SPEC.md`: 代码注释密度、文档注释与事务/类型说明规范。
- `./ERROR_HANDLING_SPEC.md`: ValidationPipe、业务异常、Drizzle 错误分类、全局异常过滤器、幂等与日志规范。
- `./drizzle-guidelines.md`: Drizzle 入口、事务、分页、原生 SQL 与 Resolver 规范。
- `./COUNTER_SPEC.md`: 计数器硬约束、决策顺序与验收基线。
- `./COUNTER_PATTERNS.md`: 计数器分层模式、迁移方式与最小实现模板。
- `./COUNTER_REGISTRY.md`: 当前仓库主要计数字段、owner、事实来源与收敛状态。

## Preferred Decision Order

1. 当前可运行的共享抽象与类型定义，例如 `DrizzleService`、`PageDto`、平台装饰器、`db/schema` 导出。
2. `.trae/rules/*` 下与当前改动层匹配的专项规则。
3. 同一业务域相邻模块的现有实现。

## Known Repo-Specific Notes

- 分页语义：平台层 `PageDto` 与 `findPagination` 当前统一使用 1-based `pageIndex`；不要在业务层再次手工转换页码。
- 历史模块里仍可能存在命名或中英文错误消息不完全统一的情况；新增代码应跟随共享抽象和当前规则，而不是复制旧不一致模式。
- 仓库内同时存在 `*.type.ts` 与少量既有 `*.types.ts`；新增业务领域类型默认使用 `*.type.ts`，历史基础设施文件按 `TS_TYPE_SPEC.md` 例外处理。
- 仓库内 `libs` 统一使用命名明确的 public API 入口；不要再从根入口 `@libs/<lib>` 导入业务代码。
- 多域共享库 `@libs/app-content`、`@libs/content`、`@libs/forum`、`@libs/growth`、`@libs/interaction`、`@libs/message` 使用 `@libs/<lib>/<domain>`。
- 单域/聚合库使用约定的二级入口，例如 `@libs/<lib>/module`、`@libs/<lib>/core`。
- 除平台层已约定的公开嵌套命名空间（如 `@libs/platform/modules/auth`）外，不要再从 `@libs/<lib>/<domain>/*` deep import。
- 计数器写路径：用户聚合计数与部分论坛计数已收口到统一 service，但内容域仍存在若干历史手写 delta 路径；新增或收敛时优先复用统一 owner service，并结合 `COUNTER_SPEC.md`、`COUNTER_PATTERNS.md`、`COUNTER_REGISTRY.md` 判断，不要复制散落写法。
- 验证以类型检查为底线；涉及路由、响应结构、错误语义、事务一致性、计数器修复等行为变更时，优先补充 Jest 行为测试。根脚本 `pnpm test` 当前可用；`pnpm test:e2e` 仍指向缺失配置，修复前不作为默认验证命令。

## Editing Heuristics

- 同时改 controller、DTO、service 时，先对齐 controller 和 DTO 规则，再收敛 service 签名。
- 涉及 controller path、响应结构、DTO 字段删除/重命名、分页语义或错误语义时，先判断是否会影响存量客户端；必要时设计 versioning / compat 窗口。
- 涉及 service 签名、领域输入输出、事务别名或聚合结果时，先对齐 `TS_TYPE_SPEC.md`，再决定类型放置层级。
- 涉及异常语义、数据库错误翻译、幂等防重、全局错误响应、日志上下文时，先对齐 `ERROR_HANDLING_SPEC.md`，再决定是在业务层、Drizzle 边界还是全局 filter 处理。
- 涉及点赞数、收藏数、评论数、浏览量、关注数、未读数、聚合读模型等计数字段时，先阅读 `COUNTER_SPEC.md`、`COUNTER_PATTERNS.md`、`COUNTER_REGISTRY.md` 与 `drizzle-guidelines.md`，再决定是增量维护还是按事实重算。
- 仅供 service 内部使用的稳定结构，优先落到 `*.type.ts`，不要把 apps DTO 向下传递。
- 发现“规范与现状”冲突时，在交付说明里显式指出，不要默默扩散冲突。

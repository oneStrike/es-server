# Rule Index

## Core Rules

- `../../AGENTS.md`：项目级最小约束、验证命令与交付要求。
- `./TEST_SPEC.md`：测试分层、目录放置、命名、Mock 策略与验证命令。
- `./CONTROLLER_SPEC.md`：Controller 路由、Swagger、权限、兼容与返回语义。
- `./DTO_SPEC.md`：DTO 分层、复用方式、命名与 Service 边界。
- `./TS_TYPE_SPEC.md`：TypeScript 领域类型、`db/schema` 推导类型与 `*.type.ts` 约定。
- `./COMMENT_SPEC.md`：注释密度、注释边界与注释风格。
- `./WORK_ITEM_DOC_SPEC.md`：方案、排期、任务单与验收清单的生成与维护规范。
- `./ERROR_HANDLING_SPEC.md`：错误分层、数据库错误映射、幂等与日志要求。
- `./drizzle-guidelines.md`：Drizzle 入口、事务、分页、原生 SQL 与 Resolver 约束。
- `./COUNTER_SPEC.md`：计数器硬约束、决策顺序与验收基线。

## Reference Docs

- `../references/DRIZZLE_RECIPES.md`：Drizzle 常见写法模板。仅供参考，不是规范来源。
- `../references/COUNTER_PATTERNS.md`：计数器实现模式、迁移方式与模板。仅供参考，不是规范来源。
- `../references/COUNTER_REGISTRY.md`：当前计数字段 owner / 事实来源 / 修复状态。仅供现状对照，不是规范来源。

## Archived Docs

- `../archive/project_rules.md`：历史通用工作流归档，不参与仓库规则决策。

## Decision Order

1. 当前可运行的共享抽象与类型定义，例如 `DrizzleService`、`PageDto`、平台装饰器、`db/schema` 导出。
2. `.trae/rules/*` 下与当前改动层匹配的核心规范。
3. 同一业务域相邻模块的现有实现。
4. 仅在需要实现模式、现状对照或修复路径时再读取 `references/*`。

## Usage Notes

- 分页语义：`PageDto` 与 `findPagination` 当前统一使用 1-based `pageIndex`。
- DTO 契约：场景 DTO（`Create/Update/Query/Response`）统一定义在 `libs/*`，`apps/*` 仅消费；Service 公开方法入参与出参与 DTO 保持 1:1。
- 查询契约：每个 Query DTO 必须与对应查询方法入参 1:1 对齐。
- 类型文件：新增业务领域类型默认使用 `*.type.ts`；历史基础设施文件保留 `*.types.ts` 例外。
- 导入路径：`libs` 统一走 public API 入口，不再从 `@libs/<lib>/<domain>/*` deep import。
- 行为验证：类型检查是底线；涉及路由、响应结构、错误语义、事务一致性、计数器修复等变更时，优先补充 Jest 行为测试。`pnpm test` 当前可用；`pnpm test:e2e` 仍指向缺失配置，修复前不作为默认验证命令。
- 兼容性：涉及 controller path、响应结构、DTO 字段删除/重命名、分页语义或错误语义时，先判断是否影响存量客户端，必要时设计 versioning / compat 窗口。
- 计数器改动：先看 `COUNTER_SPEC.md`，再按需查看 `references/COUNTER_*`。

# ES Server Working Rules

本文件为 Codex/Agent 在本仓库内工作的项目级约束补充。若文档规范与当前实现冲突，以当前可运行抽象、类型定义与基础设施入口为准，并在变更说明中指出冲突点。

## 1. 仓库概览

- 技术栈：NestJS 11 + Fastify + Drizzle ORM + PostgreSQL + Swagger。
- 应用入口：
  - `apps/admin-api`
  - `apps/app-api`
- 共享领域层：`libs/*`
- 数据库与扩展：
  - Schema：`db/schema`
  - Drizzle 核心：`db/core`
  - 扩展函数：`db/extensions`
- 路径别名统一定义在 `tsconfig.json`，优先使用 `@db/*`、`@libs/*`。

## 2. 分层要求

- `apps/*/src/modules` 只放暴露层与应用编排层：controller、module、应用侧 DTO、少量应用 service。
- 可复用的领域逻辑优先放到 `libs/*`。
- 数据访问统一经过 `DrizzleService`，不要在业务模块里重建数据库入口。
- 表定义与推导类型优先靠近 `db/schema` 维护。

## 3. Controller 规则

- 项目接口风格是 RPC over HTTP，不按 REST 资源路由去重构现有接口。
- 路径统一写在 `@Controller('admin/...')` 或 `@Controller('app/...')` 中，不带前导斜杠。
- 方法路径使用语义化动作名：`page`、`list`、`detail`、`create`、`update`、`delete`、`update-status`、`swap-sort-order`、`my/page`。
- controller 只负责：
  - 入参接收
  - 鉴权/审计/用户上下文装饰器
  - Swagger 注解
  - 调用 service
- controller 不负责编写数据库查询或复杂业务转换。
- Swagger 统一使用 `ApiDoc`、`ApiPageDoc`，输出模型必须是响应 DTO 或基础类型。

## 4. DTO 规则

- DTO 规范以 `.trae/rules/DTO_SPEC.md` 为准。
- 通用字段优先复用 `libs/platform/src/dto` 中的 `IdDto`、`IdsDto`、`BaseDto`、`PageDto` 等基础类。
- 实体级 `BaseXxxDto` 必须和 Drizzle Table 保持字段、类型、可空性、枚举、长度一致。
- apps 层 DTO 通过 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 组合生成。
- Service 方法签名不要直接使用 apps 层 DTO；优先使用 Drizzle 推导类型或模块内 `*.type.ts` 领域类型。
- 日期时间 Swagger 示例统一使用 ISO 8601。

## 5. Drizzle 规则

- Drizzle 规范以 `.trae/rules/drizzle-guidelines.md` 为准。
- 只注入 `DrizzleService`，通过 `drizzle.db`、`drizzle.schema`、`drizzle.ext` 工作。
- 写操作统一使用 `withErrorHandling` 或等价事务封装；需要保证资源存在时调用 `assertAffectedRows`。依赖原始数据库错误做重试/幂等判断的事务路径，按 `drizzle-guidelines.md` 的例外处理。
- 常规分页统一使用 `drizzle.ext.findPagination`；复合分页按 `drizzle-guidelines.md` 的例外条款处理。
- 条件构建统一使用 `drizzle.buildWhere(...)` 或 `SQL[] + and(...)`。
- 事务必须沿调用链传递，禁止 `tx: any` 或收到事务后不使用；需要保留原始数据库错误码的路径不要被通用事务包装吞掉错误类型。
- 不新增 Prisma 遗留写法。
- 原生 SQL 只允许 `sql\`...\`` / `db.execute`；`sql.raw()` 只能注入白名单常量。

## 6. 当前实现约束

- 全局 HTTP 前缀是 `/api`，controller 路径中不要重复写 `/api`。
- `findPagination` 当前兼容 `pageIndex` 0-based 与 1-based 输入；新增代码直接复用 `PageDto` 与 `findPagination`，不要在业务层自行换算页码。
- admin-api 默认受保护，`@Public()` 只能用于认证或明确公开能力。
- app-api 除 WebSocket 相关能力外，仍按普通 HTTP controller 组织。

## 7. 工作方式

1. 先定位修改所在层：controller、DTO、service、resolver、schema、bootstrap。
2. 再读取对应规范：
   - Controller：`.trae/rules/CONTROLLER_SPEC.md`
   - DTO：`.trae/rules/DTO_SPEC.md`
   - Drizzle：`.trae/rules/drizzle-guidelines.md`
3. 改代码前先查相邻模块的现有实现，优先复用仓库内既有模式。
4. 仅在现有抽象不满足时新增类型、DTO 或 helper。

## 8. 验证命令

- 全量类型检查：`pnpm type-check`
- 根 tsconfig 检查：`pnpm exec tsc -p tsconfig.json --noEmit`
- admin-api 检查：`pnpm exec tsc -p apps/admin-api/tsconfig.app.json --noEmit`
- app-api 检查：`pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit`

## 9. 交付要求

- 说明修改影响的层与模块。
- 如果发现“规范与现状”冲突，明确写出冲突点，而不是默默扩散不一致。
- 除非用户明确要求，不顺手做大范围风格迁移或历史代码清理。

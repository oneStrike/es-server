# 项目 Controller 规范

适用范围：本仓库所有 `apps/admin-api`、`apps/app-api` 的 Controller、Module 与 Swagger 暴露层。

## 1. 核心原则

- 接口继续采用 RPC over HTTP，不为了“规范化”把现有接口整体改成 REST。
- Controller 只负责入参接收、上下文装配、权限与审计装饰器、Swagger 注解、调用 service。
- Controller 入参 DTO 与响应 DTO 统一从 `libs/*` 复用；`apps/*` 不重复定义同构 DTO。
- Controller 不写数据库查询，不承载复杂业务编排，不保留第二套正式业务实现。
- 默认只保留一套正式入口；若变更会影响已有客户端或引入 breaking change，必须提供 versioning / compat 方案与下线计划。

## 2. 路由规范

- `@Controller()` 路径统一写成 `admin/...` 或 `app/...`，不带前导斜杠，不重复写 `/api`。
- 路径 segment 统一使用 `kebab-case`，禁止 camelCase、PascalCase、下划线和尾部斜杠。
- 通用动作名统一使用：`page`、`list`、`detail`、`create`、`update`、`delete`、`update-status`、`update-enabled`、`swap-sort-order`、`my/page`。
- 二级资源与动作型接口统一使用 `noun/action` 形式，例如 `history/list`、`token/refresh`、`password/change`。
- 自定义动作必须直接表达业务语义；禁止 `detail-by-id`、`detail-by-code`、`rules-page`、`records-page`、`my-page`、`config-update` 这类历史命名。
- 路径语义必须和返回结果一致：分页接口用 `page`，非分页列表用 `list`，详情接口用 `detail`，统计接口用 `stats`，上传接口用 `upload`。

## 3. Swagger 规范

- 统一使用 `ApiDoc`、`ApiPageDoc`。
- 响应模型必须是输出 DTO 或基础类型；禁止把 `CreateXxxDto`、`UpdateXxxDto` 作为输出模型。
- `ApiPageDoc` 只能用于真实返回分页结构的接口。
- `@ApiTags` 只用于文档分组，不用于驱动 controller/module 的拆分。
- tag 层级保持克制：admin-api 最多三级，app-api 最多两级；命名使用稳定业务名词，同一业务域保持一致。

## 4. 返回语义

- 纯成功确认类接口优先返回 `boolean` 或使用 `204 No Content`。
- `create`、需要立即回显新状态的 `update`、需要返回快照的动作型接口，可以返回 `id`、最小成功载荷或资源快照。
- Service 返回值按领域需求建模；只有应用边界确实只关心成功状态时，才收敛为 `boolean`。
- 仅在需要返回新数据或依赖返回值继续处理时才使用 Drizzle `returning()`；禁止为“形式统一”无意义返回数据。

## 5. 权限与审计

- admin-api 默认受保护，`@Public()` 只用于认证接口或明确公开能力。
- app-api 除 WebSocket 相关能力外，仍按普通 HTTP controller 组织。
- admin 侧变更类接口优先补齐审计装饰器。

## 6. 兼容与维护

- breaking change 发生前，先评估是否需要版本化、兼容路由或短期双入口。
- 兼容入口必须复用同一 service 或共享编排逻辑，不复制第二套业务实现。
- 正式入口、Swagger 和设计文档必须同步更新。
- 发现规范与当前稳定契约冲突时，优先记录例外，不静默改坏线上行为。

## 7. 验收清单

- [ ] Controller 保持薄层，只做协议与编排边界。
- [ ] Controller 使用 `libs/*` DTO 作为入参与输出契约，未在 `apps/*` 重复定义同构 DTO。
- [ ] 路径不含前导斜杠与 `/api`，并使用统一动作名与 `kebab-case`。
- [ ] Swagger 输出模型使用响应 DTO 或基础类型，没有输入 DTO 反向复用为输出。
- [ ] 纯成功确认类接口优先 `boolean/204`；需要回显新状态时返回最小必要载荷。
- [ ] admin 公开接口与变更类接口的权限、审计语义正确。
- [ ] 涉及 breaking change 或存量客户端时，已提供兼容方案与下线计划。

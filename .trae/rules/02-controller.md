# Controller 规范

适用范围：`apps/admin-api`、`apps/app-api` 的 Controller、Module 与 Swagger 暴露层。

## 核心原则

- 接口继续采用 RPC over HTTP，不强制改成 REST。
- Controller 只负责入参接收、上下文装配、权限与审计装饰器、Swagger 注解、调用 service。
- Controller 入参 DTO 与响应 DTO 统一从 `libs/*` 复用；`apps/*` 不重复定义同构 DTO。
- Controller 不写数据库查询，不承载复杂业务编排，不保留第二套正式业务实现。
- breaking change 必须提供 versioning / compat 方案与下线计划。

## 路由规范

- `@Controller()` 路径统一写成 `admin/...` 或 `app/...`，不带前导斜杠，不重复写 `/api`。
- 路径 segment 统一使用 `kebab-case`。
- 通用动作名统一使用：`page`、`list`、`detail`、`create`、`update`、`delete`、`update-status`、`update-enabled`、`swap-sort-order`、`my/page`。
- 二级资源与动作型接口统一使用 `noun/action` 形式。

## Swagger 规范

- 统一使用 `ApiDoc`、`ApiPageDoc`。
- 响应模型必须是输出 DTO 或基础类型；禁止把 `CreateXxxDto`、`UpdateXxxDto` 作为输出模型。
- `ApiPageDoc` 只用于真实返回分页结构的接口。
- `@ApiTags` 只用于文档分组，不驱动模块拆分。

## 返回语义

- 纯成功确认类接口优先 `boolean`，特殊场景可按照业务需求返回其他类型。
- `create`、需要立即回显新状态的 `update`、需要返回快照的动作型接口，可返回 `id`、最小成功载荷或资源快照。

## 权限与审计

- admin-api 默认受保护，`@Public()` 只用于认证或明确公开能力。
- admin 侧变更类接口优先使用 `@ApiAuditDoc()`，记录变更操作与影响。

## 兼容与维护

- 兼容入口必须复用同一 service 或共享编排逻辑，不复制第二套业务实现。
- 发现规范与当前稳定契约冲突时，优先记录例外，不静默改坏线上行为。

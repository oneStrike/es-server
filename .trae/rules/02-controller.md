# Controller 规范

适用范围：`apps/admin-api`、`apps/app-api` 的 Controller、Module 与 Swagger 暴露层。

## TL;DR

- 何时看：改 Controller、路由、Swagger、响应模型、`@HttpCode()` 时先看本篇。
- 必做：Controller 只做入参接收、装配、注解和调用 service；入参 / 出参 DTO 从 `libs/*` 复用；成功 `POST` 的状态与 `@HttpCode()` 约定以本篇“返回语义”小节为准。
- 不要：在 Controller 里写数据库查询或复杂业务编排，不要把输入 DTO 当输出模型，不要机械补 `@HttpCode(200)`，也不要为旧路由新增 alias/version 入口。
- 最低验证：`pnpm type-check`、目标 HTTP e2e 与 OpenAPI check。

Controller 是 HTTP transport；WebSocket gateway/adapter 的装配与 HTTP/WS 隔离以 [09-nestjs-architecture.md](./09-nestjs-architecture.md) 为准。

## 核心原则

- 接口继续采用动作型路由（RPC 风格）over HTTP，不强制改成 RESTful。
- Controller 只负责入参接收、上下文装配、权限与审计装饰器、Swagger 注解、调用 service。
- Controller 入参 DTO 与响应 DTO 统一从 `libs/*` 复用；`apps/*` 不重复定义同构 DTO。
- Controller 不写数据库查询，不承载复杂业务编排，不保留第二套正式业务实现。
- app composition 必须显式装配 HTTP pipe、guard、filter、interceptor 与 error mapper；不得假设这些 application globals 适用于 WS。
- contract 变更按明确决策原子切换；旧路由、旧字段与旧错误入口明确失败，不提供 versioning、alias、shim 或转换层。

## 路由规范

- `@Controller()` 路径统一写成 `admin/...` 或 `app/...`，不带前导斜杠，不重复写 `/api`。
- 路径 segment 统一使用 `kebab-case`。
- 通用动作名统一使用：`page`、`list`、`detail`、`create`、`update`、`delete`、`update-status`、`update-enabled`、`swap-sort-order`、`my/page`。
- 二级资源与动作型接口统一使用 `noun/action` 形式。

## Swagger 规范

- 统一使用 `ApiDoc`、`ApiPageDoc`、`ApiHtmlDoc`。其中 `ApiHtmlDoc` 仅用于返回 `text/html` 的特殊接口（如协议页、公告页渲染），保持 `ApiDoc` 的 JSON envelope 语义不变。
- 响应模型必须是输出 DTO 或基础类型；禁止把 `CreateXxxDto`、`UpdateXxxDto` 作为输出模型。
- `ApiPageDoc` 只用于真实返回分页结构的接口。
- `@ApiTags` 只用于文档分组，不驱动模块拆分。

## 返回语义

- 纯成功确认类接口优先 `boolean`，特殊场景可按照业务需求返回其他类型。
- `create`、需要立即回显新状态的 `update`、需要返回快照的动作型接口，可返回 `id`、最小成功载荷或资源快照。
- 项目通过平台层全局拦截器将未显式声明状态码的 `POST` 成功响应归一为 `200`；Controller 不需要书写 `@HttpCode(200)`。
- 创建/上传类 `POST` 接口需要保留 `201` 时，使用 `@HttpCode(201)` 显式声明，并同步 Swagger `successStatus: 201`。
- 返回给前端的数据结构必须稳定：所有输出 DTO 中声明的字段必须始终存在于 JSON 响应中，即使值为 `null` 也不允许字段缺失。Service 层不得通过赋值 `undefined` 让字段在序列化时被省略。

## 权限与审计

- admin-api 默认受保护，`@Public()` 只用于认证或明确公开能力。
- admin 侧变更类接口优先使用 `@ApiAuditDoc()`，记录变更操作与影响。

## Contract 切换与维护

- 当前 canonical route、DTO、HTTP status、error code 与 OpenAPI 必须同轮一致。
- 未被有效 ADR 覆盖的公开 contract 变化必须先形成显式决策；不得由局部 Controller 改动自行制造第二套入口。
- 删除的旧入口必须由可重复 HTTP 验证证明返回明确 4xx，并由 OpenAPI artifact/check 证明不再暴露；临时验证代码按 `AGENTS.md` 删除。
- 外部 OpenAPI publish 属于凭据化写操作，不由本规则或普通验证授权。

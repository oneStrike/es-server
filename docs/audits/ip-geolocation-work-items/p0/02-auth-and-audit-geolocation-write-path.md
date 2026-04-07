# P0-02 打通登录态与审计属地写入

## 目标

- 让 app / admin 登录态持久化链路写入统一属地快照。
- 让后台请求审计日志写入统一属地快照，同时保持后台查询口径不扩散。

## 范围

- `apps/app-api/src/modules/auth/auth.controller.ts`
- `apps/app-api/src/modules/auth/auth.service.ts`
- `apps/admin-api/src/modules/auth/auth.controller.ts`
- `apps/admin-api/src/modules/auth/auth.service.ts`
- `libs/identity/src/session.service.ts`
- `libs/identity/src/token/drizzle-token-storage.base.ts`
- `libs/platform/src/modules/auth/token-storage.types.ts`
- `apps/admin-api/src/modules/system/audit/audit.service.ts`
- `libs/platform/src/modules/audit/dto/audit.dto.ts`
- 视实现方式可能波及 `libs/platform/src/utils/requestParse.ts`

## 当前代码锚点

- auth controller 已能透传最小客户端上下文：
  - `apps/app-api/src/modules/auth/auth.controller.ts`
  - `apps/admin-api/src/modules/auth/auth.controller.ts`
- session 持久化当前只消费 `ip/userAgent/deviceInfo`：
  - `libs/identity/src/session.service.ts`
- token storage 基础写入当前只落 `deviceInfo/ipAddress/userAgent`：
  - `libs/identity/src/token/drizzle-token-storage.base.ts`
- 审计日志当前通过 `buildRequestLogFields(req)` 落 `ip/userAgent/device`：
  - `apps/admin-api/src/modules/system/audit/audit.service.ts`

## 非目标

- 不新增登录态列表或审计分页的属地筛选条件。
- 不改动 logout、token revoke、异常处理等既有业务语义。
- 不把原始 `FastifyRequest` 重新透传到 `libs/identity`。
- 不回填历史 token / request log 记录的属地字段。

## 主要改动

- 在 auth controller 边界补充 Geo 上下文组装，并把已解析属地透传给 auth service / session service。
- 扩展 token 持久化输入类型与底层 Drizzle 写入，使 app / admin token 表能够写入 `geo*` 字段。
- 为后台审计请求日志补充属地快照写入。
- 保持审计 DTO 与 service 查询条件不新增属地筛选，防止本轮范围扩散到后台检索能力。
- 后台审计分页 / 详情若沿用现有行对象返回，可被动带出只读 `geo*` 字段；但不新增基于属地的查询、排序或统计逻辑。

## 完成标准

- app / admin 登录成功与 refresh token 链路写入的 token 记录都包含统一属地字段。
- 审计请求日志记录包含统一属地字段。
- `geoSource` 在上述链路中固定为 `ip2region`。
- `libs/identity` 仍只接收已解析的客户端上下文，不新增 `FastifyRequest` 依赖回流。
- 历史 token / request log 记录允许保持 `geo*` 空值，不要求补写。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-02` 的状态。
- 更新 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 中登录态与审计日志证据位。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-02` 为唯一事实源。

# HTTP 状态与字符串响应码破坏性变更

日期：2026-07-08

## 变更目标

本次变更将 API 与 WebSocket ACK 的应用响应码从数字码迁移为稳定字符串码，并让 HTTP 状态码真实表达协议层结果。JSON 响应 envelope 结构不变，仍为：

```json
{
  "code": "SUCCESS",
  "data": {},
  "message": "success"
}
```

## 破坏性变化

- 成功 body `code` 从数字成功码迁移为 `"SUCCESS"`。
- 平台错误 body `code` 从数字码迁移为 `BAD_REQUEST`、`VALIDATION_FAILED`、`UNAUTHORIZED`、`FORBIDDEN`、`ROUTE_NOT_FOUND`、`PAYLOAD_TOO_LARGE`、`RATE_LIMITED`、`HTTP_ERROR`、`INTERNAL_SERVER_ERROR`。
- 业务错误 body `code` 从数字码迁移为 `RESOURCE_NOT_FOUND`、`RESOURCE_ALREADY_EXISTS`、`STATE_CONFLICT`、`OPERATION_NOT_ALLOWED`、`QUOTA_NOT_ENOUGH`、`INVALID_OPERATION_TARGET`。
- `BusinessException` 不再统一通过 HTTP 200 返回。资源不存在、冲突、不可处理操作等会返回对应 4xx 状态。
- 非创建语义的 POST action 显式返回 HTTP 200；创建或上传语义 POST 保留 HTTP 201。
- WebSocket ACK 与认证失败消息使用同一套字符串响应码。

## 默认 HTTP 映射

| 场景                                 | HTTP status | body code                                     |
| ------------------------------------ | ----------: | --------------------------------------------- |
| 成功                                 |  200 或 201 | `SUCCESS`                                     |
| 参数语法或必填字段错误               |         400 | `BAD_REQUEST`                                 |
| DTO 或数据库 check 语义校验失败      |         422 | `VALIDATION_FAILED`                           |
| 未认证                               |         401 | `UNAUTHORIZED`                                |
| 无权访问或账号封禁                   |         403 | `FORBIDDEN` 或业务 code                       |
| 资源不存在                           |         404 | `RESOURCE_NOT_FOUND`                          |
| 唯一约束或状态冲突                   |         409 | `RESOURCE_ALREADY_EXISTS` 或 `STATE_CONFLICT` |
| 操作不允许、额度不足、目标类型不支持 |         422 | 对应业务 code                                 |
| 请求过大                             |         413 | `PAYLOAD_TOO_LARGE`                           |
| 限流                                 |         429 | `RATE_LIMITED`                                |
| 未分类服务端异常                     |         500 | `INTERNAL_SERVER_ERROR`                       |

## 客户端迁移要求

- 判断成功时改为检查 HTTP 2xx 与 body `code === "SUCCESS"`。
- 错误分支不要再依赖数字响应码；改为匹配稳定字符串 `code`。
- 不要假设所有业务失败都是 HTTP 200；需要按 HTTP 4xx/5xx 进入错误分支后读取 body envelope。
- WebSocket ACK 成功判断改为 `code === "SUCCESS"`。

## 后端新增约束

- 新增 API response code 必须更新 `libs/platform/src/constant/error-code.constant.ts` 与 `.trae/rules/06-error-handling.md`。
- 新增非创建 POST action 必须加 `@HttpCode(200)`。
- 新增创建或上传 POST 若使用 `ApiDoc` / `ApiAuditDoc`，必须显式 `successStatus: 201`。
- 第三方 provider 原始响应中的数字 `code` 属于上游协议字段，不得直接作为本仓库 API envelope code 对外透出。

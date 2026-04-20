# 错误处理规范

适用范围：`libs/*` 与 `apps/*` 中的错误处理与异常抛出逻辑。

## 总体原则

- 协议层错误与业务结果分层表达：HTTP 状态码只承载协议层、鉴权、限流与未预期异常语义。
- 成功响应统一返回 `code=0`；业务失败统一使用 5 位数字业务码，不再复用 HTTP 状态码镜像。
- 平台层固定 code：`10001`（Bad Request）、`10002`（Unauthorized）、`10003`（Forbidden）、`10004`（Route Not Found）、`10005`（Payload Too Large）、`10006`（Rate Limited）、`50001`（Internal Server Error）。
- 业务层固定按错误类型分配 code：`20001`（资源不存在）、`20002`（资源已存在）、`20003`（状态冲突）、`20004`（当前操作不允许）、`20005`（额度不足）。
- 业务错误由业务层定性，全局层只兜底。
- 平台层只保留 `BusinessException` 这一种业务异常载体，以及共享错误码常量；不提供根据 `message` 反推业务码的异常工厂。
- 数据库错误在 Drizzle 边界分类，不在 controller 重复发明语义。
- 幂等优先数据库原生写法，不以异常驱动正常流程。
- 读接口附带写入必须可降级。

## 分层职责

- ValidationPipe：参数校验与转换；语法、格式、DTO、JSON 结构、枚举值、字段类型、分页排序参数非法，统一输出 `400 / 10001`。
- Controller：入参接收与编排，不翻译数据库错误。
- Service/Resolver：对可预期业务失败抛 `BusinessException`；仅协议层、鉴权与未预期异常继续抛 Nest HTTP 异常。
- Service/Resolver 抛 `BusinessException` 时必须显式引用共享错误码常量，不允许直接手写裸数字 `20001`、`20002` 等字面量。
- Drizzle：统一 `withErrorHandling`/`assertAffectedRows`，负责提取 PostgreSQL 元信息并保留原始 `cause`。
- 全局过滤器：统一错误响应结构与结构化日志，区分 `BusinessException` 与 `HttpException`。

## 数据库错误处理

- PostgreSQL 默认错误码映射以 `db/core/error/postgres-error.ts` 为单一来源。
- 由数据库约束兜底暴露出的输入非法（如 `NOT NULL`、`CHECK`）继续按 `400 / 10001` 处理。
- 唯一约束冲突默认映射到 `20002`，序列化 / 乐观并发冲突默认映射到 `20003`，0 行变更且语义为目标不存在时默认映射到 `20001`。
- 可预期数据库错误转换为业务异常时必须保留原始 `cause`；日志继续输出 `businessCode`、`errorCode`、`Constraint`、`Table`、`Column`、`Detail`。

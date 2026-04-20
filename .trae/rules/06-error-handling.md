# 错误处理规范

适用范围：`libs/*` 与 `apps/*` 中的错误处理与异常抛出逻辑。

## 仓库约定

- 本仓库采用“HTTP 状态码表达协议层，业务码表达业务失败”的双层错误模型。
- 成功响应统一返回 `code=0`。
- 可预期业务失败统一抛 `BusinessException`，并由全局过滤器输出业务 `code`；不要把业务失败伪装成 HTTP 4xx / 5xx。
- 平台层共享错误码以 `PlatformErrorCode` 为单一来源；业务层共享错误码以 `BusinessErrorCode` 为单一来源。
- 数据库错误在 Drizzle 边界统一分类；controller 不重复发明数据库语义。
- 幂等优先使用数据库原生约束、原子更新和唯一键设计，不以异常驱动正常流程。
- 读接口若附带写入、副作用或统计补记，必须可降级，不能让主读取流程因为附带写入失败而整体失败。

## 默认动作

- ValidationPipe、参数转换、DTO 校验、JSON 结构非法、枚举值非法、分页排序参数非法，统一按协议层错误处理。
- Controller 负责接收入参和编排调用，不负责翻译数据库错误，也不负责定义业务错误码。
- Service / Resolver 对可预期业务失败抛 `BusinessException`；协议层、鉴权、限流和未预期异常继续抛 Nest HTTP 异常或交给全局兜底。
- 抛 `BusinessException` 时必须显式引用共享错误码常量；不允许手写裸数字 `20001`、`20002` 这类字面量。
- 数据库读写优先通过 `drizzle.withErrorHandling(...)`、`drizzle.withTransaction(...)`、`drizzle.assertAffectedRows(...)` 收口。
- 业务层若需要感知 PostgreSQL 细节，应通过 `extractError(...)`、共享错误描述器或 `withErrorHandling` 的映射能力获取，不要自行解析驱动错误字符串。

## 分层职责

- ValidationPipe：参数校验、语法错误、格式错误、DTO 结构错误。
- Controller：入参接收、调用编排、响应返回；不翻译数据库错误，不重写业务语义。
- Service / Resolver：定义业务规则、判断可预期失败、抛出 `BusinessException`。
- Drizzle / `db/core`：提取 PostgreSQL 元信息、做默认错误映射、保留原始 `cause`。
- 全局过滤器：统一响应结构与结构化日志，区分 `BusinessException`、`HttpException` 与未知异常。

## 错误码与映射

- 平台层固定 code 以 `PlatformErrorCode` 为准，例如 `10001`（Bad Request）、`10002`（Unauthorized）、`10003`（Forbidden）、`10004`（Route Not Found）、`10005`（Payload Too Large）、`10006`（Rate Limited）、`50001`（Internal Server Error）。
- 业务层固定 code 以 `BusinessErrorCode` 为准，例如 `20001`（资源不存在）、`20002`（资源已存在）、`20003`（状态冲突）、`20004`（当前操作不允许）、`20005`（额度不足）。
- `db/core/error/postgres-error.ts` 是 PostgreSQL 默认错误码映射的单一来源。
- `NOT NULL`、`CHECK` 等数据库约束暴露出的输入非法，默认继续按平台层 `400 / 10001` 处理。
- 唯一约束冲突默认映射到 `20002`；序列化失败、乐观并发冲突默认映射到 `20003`；0 行变更且语义为目标不存在时默认映射到 `20001`。
- 数据库错误若被转换为业务异常，必须保留原始 `cause`，不能丢失底层上下文。

## 日志与诊断

- 统一记录 `businessCode`、`errorCode`、`constraint`、`table`、`column`、`detail` 等结构化字段。
- 禁止通过匹配 `message` 文本来反推错误码或业务语义。
- 若业务层 catch 后重新抛出异常，必须保留原始 `cause` 或等价上下文；不能只保留一条新的字符串 message。

## 禁止项

- 禁止在业务层对可预期失败抛 `BadRequestException`、`NotFoundException`、`ConflictException` 等 HTTP 异常来替代 `BusinessException`。
- 禁止手写业务错误码裸数字。
- 禁止在 controller 中捕获数据库错误后再重复翻译一遍业务语义。
- 禁止依赖异常 message 字符串做业务分支。
- 禁止把正常幂等路径写成“先执行，再靠异常判断是否重复”。
- 禁止为了省事吞掉异常、降级为 `null` / `false` / 空数组而不保留错误语义。

## 正反例

- 允许：`throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '应用用户不存在')`
- 允许：`await this.drizzle.withErrorHandling(() => persist(this.db), { notFound: '用户不存在' })`
- 允许：在业务层捕获唯一约束冲突后，基于共享错误码转换为 `BusinessException`，同时保留 `cause`。
- 禁止：`throw new NotFoundException('用户不存在')` 来表达业务资源不存在。
- 禁止：`throw new BusinessException(20001, '用户不存在')`
- 禁止：`if (error.message.includes('duplicate')) { ... }`

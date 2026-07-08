# 错误处理规范

适用范围：`libs/*` 与 `apps/*` 中的错误处理、异常抛出、响应 envelope、WebSocket ACK 与数据库错误转换。

## 仓库约定

- 本仓库采用“HTTP 状态表达协议结果，body `code` 表达应用结果”的双层模型。
- 成功 JSON envelope 固定返回 `code: "SUCCESS"`；`data` 与 `message` 字段保持不变。
- 可预期业务失败统一抛 `BusinessException`，由全局过滤器输出业务字符串 `code` 与对应 HTTP 4xx；禁止把业务失败伪装成 HTTP 200。
- 平台层共享错误码以 `PlatformErrorCode` 为单一来源；业务层共享错误码以 `BusinessErrorCode` 为单一来源。
- 数据库错误在 Drizzle 边界统一分类；controller 不重复发明数据库语义。
- 幂等优先使用数据库原生约束、原子更新和唯一键设计，不以异常驱动正常流程。
- 读接口若附带写入、副作用或统计补记，必须可降级，不能让主读取流程因为附带写入失败而整体失败。

## 默认动作

- ValidationPipe、参数转换、DTO 校验、JSON 结构非法、枚举值非法、分页排序参数非法，统一按协议层错误处理。
- Controller 负责接收入参和编排调用，不负责翻译数据库错误，也不负责定义业务错误码。
- Service / Resolver 对可预期业务失败抛 `BusinessException`；协议层、鉴权、限流和未预期异常继续抛 Nest HTTP 异常或交给全局兜底。
- 抛 `BusinessException` 时必须显式引用共享错误码常量；不允许手写裸数字或裸字符串字面量。
- `BusinessException` 默认 HTTP 状态由 `getBusinessErrorHttpStatus(...)` 决定；同一业务码在鉴权、账号封禁等特殊上下文需要不同协议状态时，通过 `httpStatus` 显式覆盖。
- 数据库读写优先通过 `drizzle.withErrorHandling(...)`、`drizzle.withTransaction(...)`、`drizzle.assertAffectedRows(...)` 收口。
- 业务层若需要感知 PostgreSQL 细节，应通过 `extractError(...)`、共享错误描述器或 `withErrorHandling` 的映射能力获取，不要自行解析驱动错误字符串。
- 平台层全局将 `POST` 成功响应状态码归一为 `200`；Controller 不再显式书写 `@HttpCode(200)`，Swagger 成功状态也应保持 `200`。
- 若极少数 `POST` 接口必须保留非 `200` 成功状态码，必须通过受控例外显式声明，并同步更新 Swagger 文档与规则说明。

## 分层职责

- ValidationPipe：参数校验、语法错误、格式错误、DTO 结构错误。
- Controller：入参接收、调用编排、响应返回；不翻译数据库错误，不重写业务语义。
- Service / Resolver：定义业务规则、判断可预期失败、抛出 `BusinessException`。
- Drizzle / `db/core`：提取 PostgreSQL 元信息、做默认错误映射、保留原始 `cause`。
- 全局过滤器：统一响应结构与结构化日志，区分 `BusinessException`、`HttpException`、PostgreSQL 错误与未知异常。
- WebSocket：ACK 使用同一套字符串响应码；成功为 `"SUCCESS"`，失败为平台或业务字符串错误码。

## 错误码与映射

- 平台层固定 code 以 `PlatformErrorCode` 为准：`BAD_REQUEST`、`VALIDATION_FAILED`、`UNAUTHORIZED`、`FORBIDDEN`、`ROUTE_NOT_FOUND`、`PAYLOAD_TOO_LARGE`、`RATE_LIMITED`、`HTTP_ERROR`、`INTERNAL_SERVER_ERROR`。
- 业务层固定 code 以 `BusinessErrorCode` 为准：`RESOURCE_NOT_FOUND`、`RESOURCE_ALREADY_EXISTS`、`STATE_CONFLICT`、`OPERATION_NOT_ALLOWED`、`QUOTA_NOT_ENOUGH`、`INVALID_OPERATION_TARGET`。
- `db/core/error/postgres-error.ts` 是 PostgreSQL 默认错误码映射的单一来源。
- `NOT NULL` 约束默认映射为 HTTP 400 / `BAD_REQUEST`。
- `CHECK` 约束默认映射为 HTTP 422 / `VALIDATION_FAILED`。
- 唯一约束冲突默认映射为 HTTP 409 / `RESOURCE_ALREADY_EXISTS`。
- 序列化失败、乐观并发冲突默认映射为 HTTP 409 / `STATE_CONFLICT`。
- 0 行变更且语义为目标不存在时默认映射为 HTTP 404 / `RESOURCE_NOT_FOUND`。
- 数据库错误若被转换为业务异常，必须保留原始 `cause`，不能丢失底层上下文。
- 新增错误码必须同步更新 `libs/platform/src/constant/error-code.constant.ts` 常量定义与本规范文档的错误码列表；不允许只改代码不更新规范，也不允许只更新规范不补充代码。

## 日志与诊断

- 统一记录 `responseCode`、`businessCode`、`httpStatus`、`errorCode`、`constraint`、`table`、`column`、`detail` 等结构化字段。
- 禁止通过匹配 `message` 文本来反推错误码或业务语义。
- 若业务层 catch 后重新抛出异常，必须保留原始 `cause`、`httpStatus` 或等价上下文；不能只保留一条新的字符串 message。

## 上游与领域字段例外

- 第三方 provider 原始响应中的 `code?: number`、`err?: number`、`statusCode` 等字段属于上游协议，不能改写为本仓库 API envelope code。
- 领域模型中的事件编码、枚举状态、用户 ID、排序值等数字字段不是 API 响应码；审查时必须按字段语义分类，不能只按字段名 `code` 机械替换。
- 保留上游或领域数字 code 时，应通过类型命名、注释或覆盖清单说明其边界，避免与 `ApiResponseCode` 混用。

## 禁止项

- 禁止在业务层对可预期失败抛 `BadRequestException`、`NotFoundException`、`ConflictException` 等 HTTP 异常来替代 `BusinessException`。
- 禁止手写业务错误码裸数字或裸字符串。
- 禁止新增数字形式的 API 响应码字面量。
- 禁止在 controller 中捕获数据库错误后再重复翻译一遍业务语义。
- 禁止依赖异常 message 字符串做业务分支。
- 禁止把正常幂等路径写成“先执行，再靠异常判断是否重复”。
- 禁止为了省事吞掉异常、降级为 `null` / `false` / 空数组而不保留错误语义。

## 正反例

- 允许：`throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '应用用户不存在')`
- 允许：`throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '账号已封禁', { httpStatus: HttpStatus.FORBIDDEN })`
- 允许：`await this.drizzle.withErrorHandling(() => persist(this.db), { notFound: '用户不存在' })`
- 允许：在业务层捕获唯一约束冲突后，基于共享错误码转换为 `BusinessException`，同时保留 `cause`。
- 禁止：`throw new NotFoundException('用户不存在')` 来表达业务资源不存在。
- 禁止：`throw new BusinessException(20001, '用户不存在')`
- 禁止：`throw new BusinessException('RESOURCE_NOT_FOUND', '用户不存在')`
- 禁止：`if (error.message.includes('duplicate')) { ... }`

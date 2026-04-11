# API 错误语义重构设计

## 1. 背景

当前仓库的 HTTP 接口响应存在两套混杂语义：

- 成功响应通过全局拦截器统一包装为 `code: 200`。
- 业务层大量直接抛出 `BadRequestException`、`NotFoundException`、`ConflictException` 等 Nest 异常。
- 全局异常过滤器再把 `HttpException.status` 原样写回 HTTP 状态码，并把响应体中的 `code` 也同步写成 HTTP 状态码。

这会导致以下问题：

- `code` 字段名义上是业务码，实际上只是 HTTP 状态码镜像。
- 业务资源不存在、状态不允许、重复操作等“业务拒绝”与“协议层失败”没有清晰边界。
- 前端无法稳定地区分“请求失败”与“请求已进入业务层，但业务判定未通过”。
- 仓库已明确采用 RPC over HTTP 风格，继续把大部分业务规则绑定到 HTTP 状态码，不利于统一接口心智。

## 2. 本次设计的前提

- 本方案是**全项目替换**，不是局部试点。
- 本方案**不提供兼容层**、不保留新旧双语义并存。
- 当前项目处于快速开发阶段，允许直接调整现有对外契约。
- 重构目标是明确区分「协议层错误」与「业务层结果」。

## 3. 设计目标

- 统一接口响应语义，让调用方能稳定判断请求结果。
- 让 HTTP 状态码只承担协议层、网关层、基础设施层含义。
- 让业务规则失败统一通过业务码表达，不再借用 `404/409` 等 HTTP 状态码。
- 让全局错误处理、数据库错误映射、业务异常抛出方式在仓库内保持一致。

## 4. 非目标

- 不为旧客户端保留兼容分支。
- 不保留 `code = HTTP status` 的旧响应格式。
- 不在本轮引入复杂的国际化错误文案体系。
- 不在本轮设计中细化每个业务域的完整错误码清单；本轮先定义结构、边界与命名规则。

## 5. 最终决策

### 5.1 总体原则

- 进入业务层且得到稳定业务结论的请求，统一返回 HTTP `200`。
- 业务资源不存在，视为业务结果，不再返回 HTTP `404`。
- 原先使用 HTTP `409` 表达的业务冲突，全部改为 HTTP `200 + bizCode`。
- 只有协议层、认证鉴权、网关限流、请求格式、未预期异常，继续使用非 `200` HTTP 状态码。
- 接口或路由不存在，继续返回 HTTP `404`。

### 5.2 状态码边界

| 场景                                            | HTTP 状态码        | 响应体 `code`                     |
| ----------------------------------------------- | ------------------ | --------------------------------- |
| 成功                                            | `200`              | `OK`                              |
| 业务资源不存在                                  | `200`              | 业务码，如 `USER_NOT_FOUND`       |
| 重复操作 / 状态冲突 / 配额不足 / 业务规则不满足 | `200`              | 业务码，如 `TASK_ALREADY_CLAIMED` |
| DTO 校验失败 / 参数格式错误 / 非法请求体        | `400`              | `BAD_REQUEST`                     |
| 未登录 / Token 无效                             | `401`              | `UNAUTHORIZED`                    |
| 已登录但无权限                                  | `403`              | `FORBIDDEN`                       |
| 路由不存在                                      | `404`              | `ROUTE_NOT_FOUND`                 |
| 上传体过大等请求约束错误                        | `413` 等协议层状态 | 对应平台码                        |
| 限流                                            | `429`              | `RATE_LIMITED`                    |
| 未预期异常                                      | `500`              | `INTERNAL_SERVER_ERROR`           |

## 6. 响应结构

### 6.1 统一响应体

全项目统一使用如下结构：

```ts
interface ApiResponse<T> {
  code: string
  message: string
  data: T | null
}
```

约定如下：

- `code`：统一改为**业务语义码**，不再承载 HTTP 状态码镜像。
- `message`：面向调用方的稳定提示文案。
- `data`：成功时返回正常数据；失败时默认返回 `null`。

### 6.2 成功示例

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "id": 123
  }
}
```

### 6.3 业务失败示例

```json
{
  "code": "USER_NOT_FOUND",
  "message": "用户不存在",
  "data": null
}
```

对应 HTTP 状态码仍为 `200`。

### 6.4 协议层失败示例

```json
{
  "code": "BAD_REQUEST",
  "message": "pageIndex 必须大于 0",
  "data": null
}
```

对应 HTTP 状态码为 `400`。

## 7. 异常模型

### 7.1 异常分类

全项目异常分为两类：

- 业务异常（Business Exception）
- 框架异常 / 协议异常（Framework / Transport Exception）

### 7.2 业务异常

新增统一的业务异常抽象，例如：

```ts
class BusinessException extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
  ) {
    super(message)
  }
}
```

业务异常的处理规则：

- 统一由 Service / Resolver 抛出。
- 全局过滤器捕获后，一律返回 HTTP `200`。
- 响应体中的 `code` 使用异常内定义的业务码。
- `message` 使用稳定业务文案。
- `data` 固定为 `null`。

### 7.3 框架异常

下列异常继续保留 HTTP 语义：

- `BadRequestException`
- `UnauthorizedException`
- `ForbiddenException`
- 限流异常
- 上传体积、请求格式、Content-Type 等请求层异常
- 未知异常与基础设施异常

处理规则：

- HTTP 状态码保持真实值。
- 响应体仍统一使用 `{ code, message, data }` 结构。
- 其中 `code` 使用稳定的平台语义码，而不是数字状态码。

## 8. 业务资源不存在的定义

本方案明确将以下情况视为业务结果，而非 HTTP `404`：

- 用户不存在
- 帖子不存在
- 评论不存在
- 任务不存在
- 订单不存在
- 任何“查询目标业务对象未命中”的情况

原因如下：

- 这类请求已成功命中接口并完成业务处理。
- 在 RPC over HTTP 模型中，它们更接近业务返回结果，而不是 URL 层面的资源发现失败。
- 与重复操作、状态不允许等失败场景放在同一层处理，更利于前端统一消费。

## 9. 数据库错误映射策略

### 9.1 保留 HTTP 的场景

以下错误仍保留协议层状态码：

- 非空约束导致的无效请求，可继续映射到 `400`
- 非法输入导致的 check constraint，可继续映射到 `400`
- 未预期的数据库错误，映射到 `500`

### 9.2 改为业务码的场景

以下错误默认视为业务结果，改为 HTTP `200 + bizCode`：

- 唯一约束冲突
- 乐观并发冲突 / 序列化冲突
- 写路径 0 行变更且业务上代表“目标对象不存在”

落地原则：

- `withErrorHandling` 与 `assertAffectedRows` 不再默认翻译为 `HttpException`。
- 业务层需要把这些可预期错误收口为 `BusinessException`。
- `db/core` 只负责提取数据库错误元信息，不再直接决定全部业务语义。

## 10. 全项目替换策略

本次改造采取一次性替换，不提供兼容层：

1. 统一替换响应体中的 `code` 语义，从数字 HTTP 状态码改为字符串业务码。
2. 全局成功拦截器统一返回 `code: 'OK'`。
3. 全局异常过滤器新增业务异常分支：
   - `BusinessException` -> HTTP `200`
   - 框架异常 -> 保持真实 HTTP 状态码
4. 业务层中的 `NotFoundException`、`ConflictException` 等业务用途抛错，统一替换为 `BusinessException`。
5. 仅保留协议层必要的 `BadRequestException`、`UnauthorizedException`、`ForbiddenException`、限流与未知异常。
6. 更新 Swagger 文档与 DTO 注释，明确 `code` 含义已经变更。
7. 同步修正相关单测，删除基于旧状态码语义的断言。

## 11. 命名规范

### 11.1 业务码命名

业务码统一使用全大写蛇形命名：

- `OK`
- `USER_NOT_FOUND`
- `TOPIC_NOT_FOUND`
- `TASK_ALREADY_CLAIMED`
- `PHONE_ALREADY_BOUND`
- `TASK_PROGRESS_CONFLICT`

规范要求：

- 按业务语义命名，而不是按技术实现命名。
- 禁止出现 `ERR_001` 这类无法自解释的裸编号。
- 同一业务含义在全仓只保留一个码名。

### 11.2 平台码命名

平台码同样使用稳定字符串：

- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `ROUTE_NOT_FOUND`
- `RATE_LIMITED`
- `INTERNAL_SERVER_ERROR`

## 12. 影响范围

本方案至少会影响以下层面：

- `libs/platform/src/interceptors/*`
- `libs/platform/src/filters/*`
- `db/core/error/*`
- `db/core/drizzle.service.ts`
- 业务层中所有将资源不存在、唯一冲突、状态冲突翻译为 Nest HTTP 异常的 Service / Resolver
- 复用 `Response<T>` 或等效响应 DTO 的声明位置
- Swagger 示例与接口文档
- 相关单元测试与集成测试

## 13. 风险与取舍

### 13.1 主要收益

- 前端可以统一把业务失败当作正常业务响应处理。
- 业务资源不存在与业务冲突规则归于同一语义层，心智更一致。
- `404` 的含义会被严格收缩为“接口不存在”。
- `code` 字段终于回归真正的业务码语义。

### 13.2 主要代价

- 会形成一次明确的 breaking change。
- 现有前端、测试、接口文档都要同步切换。
- 对监控而言，原先通过 `404/409` 聚合的业务失败会沉到 HTTP `200`，后续必须基于 `bizCode` 做统计。

### 13.3 接受该代价的原因

- 当前项目处于快速开发阶段。
- 用户已明确接受全项目替换，不要求兼容层。
- 在这个阶段统一语义，比后续继续累积双重约定更有价值。

## 14. 验收标准

方案落地后，应满足以下验收结果：

1. 任一成功接口，响应体 `code` 为 `OK`。
2. 任一业务资源不存在场景，HTTP 状态码为 `200`，响应体 `code` 为对应业务码。
3. 任一原 `409` 业务冲突场景，HTTP 状态码为 `200`，响应体 `code` 为对应业务码。
4. DTO 校验失败仍返回 `400`。
5. 鉴权失败仍返回 `401/403`。
6. 路由不存在仍返回 `404`。
7. 未知异常仍返回 `500`。
8. 全仓不再出现“响应体 `code` 只是 HTTP status 镜像”的实现。

## 15. 后续实现约束

实现阶段必须遵守以下约束：

- 不新增兼容层、适配层或双写逻辑。
- 不保留“旧接口返回 HTTP status 镜像，新接口返回 bizCode”的混合状态。
- 以全局抽象替换为主，避免在 Controller 层逐个手写兼容判断。
- 先收敛基础设施层抽象，再批量替换业务域异常。

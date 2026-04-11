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
- 不要求在本轮为每一条业务文案都分配独立错误码；仅收敛全项目共享规则与首批必落地 code。

## 5. 最终决策

### 5.1 总体原则

- 进入业务层且得到稳定业务结论的请求，统一返回 HTTP `200`。
- 业务资源不存在，视为业务结果，不再返回 HTTP `404`。
- 原先使用 HTTP `409` 表达的业务冲突，全部改为 HTTP `200 + bizCode`。
- 只有协议层、认证鉴权、网关限流、请求格式、未预期异常，继续使用非 `200` HTTP 状态码。
- 接口或路由不存在，继续返回 HTTP `404`。

### 5.2 状态码边界

| 场景                                            | HTTP 状态码        | 响应体 `code`       |
| ----------------------------------------------- | ------------------ | ------------------- |
| 成功                                            | `200`              | `0`                 |
| 业务资源不存在                                  | `200`              | 业务码，如 `210001` |
| 重复操作 / 状态冲突 / 配额不足 / 业务规则不满足 | `200`              | 业务码，如 `250003` |
| DTO 校验失败 / 参数格式错误 / 非法请求体        | `400`              | `100001`            |
| 未登录 / Token 无效                             | `401`              | `100002`            |
| 已登录但无权限                                  | `403`              | `100003`            |
| 路由不存在                                      | `404`              | `100004`            |
| 上传体过大等请求约束错误                        | `413` 等协议层状态 | 平台码，如 `100005` |
| 限流                                            | `429`              | `100006`            |
| 未预期异常                                      | `500`              | `100500`            |

## 6. 响应结构

### 6.1 统一响应体

全项目统一使用如下结构：

```ts
interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}
```

约定如下：

- `code`：统一改为**数字业务码**，不再承载 HTTP 状态码镜像。
- `message`：面向调用方的稳定提示文案。
- `data`：成功时返回正常数据；失败时默认返回 `null`。

### 6.2 成功示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 123
  }
}
```

### 6.3 业务失败示例

```json
{
  "code": 210001,
  "message": "用户不存在",
  "data": null
}
```

对应 HTTP 状态码仍为 `200`。

### 6.4 协议层失败示例

```json
{
  "code": 100001,
  "message": "pageIndex 必须大于 0",
  "data": null
}
```

对应 HTTP 状态码为 `400`。

### 6.5 数字 code 规则

- 成功固定使用 `0`。
- 协议层 / 平台层错误统一使用 `100xxx`。
- 通用业务错误统一使用 `200xxx`。
- 具体业务域错误按模块分段使用 `21xxxx` 到 `28xxxx`。
- 除成功码 `0` 外，所有对外 code 一律使用 `6` 位数字，避免与 HTTP 状态码混淆。

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
    public readonly code: number,
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
- 其中 `code` 使用稳定的平台数字码，而不是 HTTP 状态码镜像。

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

1. 统一替换响应体中的 `code` 语义，从 HTTP 状态码镜像改为数字业务码。
2. 全局成功拦截器统一返回 `code: 0`。
3. 全局异常过滤器新增业务异常分支：
   - `BusinessException` -> HTTP `200`
   - 框架异常 -> 保持真实 HTTP 状态码
4. 业务层中的 `NotFoundException`、`ConflictException` 与业务用途的 `BadRequestException`，统一替换为 `BusinessException`。
5. 仅保留协议层必要的 `BadRequestException`、`UnauthorizedException`、`ForbiddenException`、限流与未知异常。
6. 更新 Swagger 文档与 DTO 注释，明确 `code` 含义已经变更。
7. 同步修正相关单测，删除基于旧状态码语义的断言。

## 11. 编码规范

### 11.1 编码原则

- 对外响应中的 `code` 一律使用数字。
- 成功码固定为 `0`，不再使用 `200` 或字符串 `OK`。
- 平台错误与业务错误共享同一个数字字段，但通过区间区分含义。
- 同一业务语义在全仓只保留一个稳定 code，不允许同义不同码。
- 同一 code 对应的 `message` 可以按场景微调文案，但语义不能漂移。

### 11.2 号段分配

| 号段                | 归属                   | 说明                               |
| ------------------- | ---------------------- | ---------------------------------- |
| `0`                 | 成功                   | 全项目统一成功码                   |
| `100000` - `109999` | 平台 / 协议层          | 参数、鉴权、路由、限流、系统异常   |
| `200000` - `209999` | 通用业务层             | 跨域复用的兜底业务语义             |
| `210000` - `214999` | `user`                 | 用户主体、用户资料、用户关系       |
| `215000` - `219999` | `identity` / `auth`    | 登录、密码、验证码、会话           |
| `220000` - `224999` | `app-content`          | 页面、公告、协议等应用内容         |
| `225000` - `229999` | `config`               | 字典、系统配置等配置能力           |
| `230000` - `239999` | `content`              | 作品、章节、作者、分类、标签       |
| `240000` - `249999` | `forum`                | 主题、板块、标签、版主等论坛能力   |
| `250000` - `259999` | `growth`               | 任务、徽章、积分、等级、权限       |
| `260000` - `269999` | `interaction`          | 举报、购买、阅读状态、点赞收藏关注 |
| `270000` - `279999` | `message`              | 通知、会话、消息、outbox           |
| `280000` - `284999` | `moderation`           | 风控、敏感词、审核能力             |
| `285000` - `289999` | `admin-api` / 系统管理 | 审计、后台工具、系统任务           |

### 11.3 平台层固定 code

| code     | 名称                  | 说明                                     |
| -------- | --------------------- | ---------------------------------------- |
| `0`      | SUCCESS               | 成功                                     |
| `100001` | BAD_REQUEST           | DTO 校验失败、参数格式错误、非法请求体   |
| `100002` | UNAUTHORIZED          | 未登录、Token 无效、会话无效             |
| `100003` | FORBIDDEN             | 无权限、被禁用、禁止访问                 |
| `100004` | ROUTE_NOT_FOUND       | 接口或路由不存在                         |
| `100005` | PAYLOAD_TOO_LARGE     | 上传体过大、文件数量超限等请求体约束错误 |
| `100006` | RATE_LIMITED          | 触发限流                                 |
| `100500` | INTERNAL_SERVER_ERROR | 未预期异常                               |

### 11.4 通用业务 code

| code     | 名称                  | 说明                                 |
| -------- | --------------------- | ------------------------------------ |
| `200001` | RESOURCE_NOT_FOUND    | 无法归入更细业务域时的兜底资源不存在 |
| `200002` | DUPLICATE_RESOURCE    | 无法归入更细业务域时的兜底重复资源   |
| `200003` | STATE_CONFLICT        | 无法归入更细业务域时的兜底状态冲突   |
| `200004` | OPERATION_NOT_ALLOWED | 无法归入更细业务域时的兜底规则不允许 |
| `200005` | QUOTA_NOT_ENOUGH      | 无法归入更细业务域时的兜底额度不足   |

### 11.5 首批项目级业务 code

以下 code 为当前项目重构后首批必须落地的共享业务码，覆盖当前仓库中已高频出现的业务失败语义。

#### 11.5.1 用户与认证

| code     | 名称                      | 说明                                       |
| -------- | ------------------------- | ------------------------------------------ |
| `210001` | USER_NOT_FOUND            | 用户不存在、应用用户不存在、目标用户不存在 |
| `210002` | USER_PHONE_NOT_BOUND      | 当前账号未绑定手机号                       |
| `210003` | USER_PHONE_MISMATCH       | 当前手机号与已绑定手机号不一致             |
| `210004` | USER_PHONE_SAME_AS_OLD    | 新手机号不能与当前手机号相同               |
| `210005` | EMAIL_ALREADY_USED        | 邮箱已被使用                               |
| `210006` | PHONE_ALREADY_USED        | 手机号已被使用、手机号已被绑定             |
| `215001` | OLD_PASSWORD_INCORRECT    | 旧密码错误                                 |
| `215002` | PASSWORD_CONFIRM_MISMATCH | 两次输入的密码不一致                       |

#### 11.5.2 应用内容与配置

| code     | 名称                         | 说明                                 |
| -------- | ---------------------------- | ------------------------------------ |
| `220001` | PAGE_NOT_FOUND               | 页面不存在                           |
| `220002` | PAGE_PLATFORM_FILTER_INVALID | 启用平台筛选不是合法数组或枚举值数组 |
| `220101` | ANNOUNCEMENT_NOT_FOUND       | 公告不存在                           |
| `220102` | ANNOUNCEMENT_PAGE_NOT_FOUND  | 公告关联页面不存在                   |
| `225001` | DICTIONARY_NOT_FOUND         | 字典不存在、数据字典不存在           |
| `225002` | DICTIONARY_CODE_EMPTY        | 字典编码不能为空                     |
| `225003` | DICTIONARY_IN_USE            | 字典存在关联字典项，无法删除         |

#### 11.5.3 内容域

| code     | 名称                           | 说明                                       |
| -------- | ------------------------------ | ------------------------------------------ |
| `230001` | WORK_NOT_FOUND                 | 作品不存在、漫画作品不存在、小说作品不存在 |
| `230002` | WORK_UNPUBLISHED               | 作品未发布                                 |
| `230003` | WORK_NAME_ALREADY_EXISTS       | 同类型作品名称已存在                       |
| `230004` | WORK_TYPE_UNSUPPORTED          | 不支持的作品类型                           |
| `230005` | WORK_COMMENT_NOT_SUPPORTED     | 作品类型不支持评论                         |
| `230006` | CHAPTER_NOT_FOUND              | 章节不存在、漫画章节不存在、小说章节不存在 |
| `230007` | CHAPTER_NUMBER_ALREADY_EXISTS  | 同一作品下章节号已存在                     |
| `230008` | CHAPTER_COMMENT_NOT_SUPPORTED  | 当前章节不允许评论                         |
| `230009` | CHAPTER_PURCHASE_NOT_SUPPORTED | 当前章节不支持购买                         |
| `230010` | DOWNLOAD_CONTENT_NOT_FOUND     | 下载内容不存在                             |
| `230011` | AUTHOR_NOT_FOUND_OR_DISABLED   | 部分作者不存在或已禁用                     |
| `230012` | CATEGORY_NOT_FOUND_OR_DISABLED | 部分分类不存在或已禁用                     |
| `230013` | TAG_NOT_FOUND_OR_DISABLED      | 部分标签不存在或已禁用                     |
| `230014` | MEMBER_LEVEL_NOT_FOUND         | 指定的阅读会员等级不存在                   |

#### 11.5.4 论坛域

| code     | 名称                          | 说明                         |
| -------- | ----------------------------- | ---------------------------- |
| `240001` | TOPIC_NOT_FOUND               | 主题不存在、帖子不存在       |
| `240002` | TOPIC_LOCKED                  | 主题已锁定，无法编辑或评论   |
| `240003` | TOPIC_PERMISSION_DENIED       | 无权修改或删除主题           |
| `240004` | TOPIC_SECTION_INFO_MISSING    | 帖子板块信息缺失             |
| `240005` | SECTION_NOT_FOUND_OR_DISABLED | 板块不存在或已禁用           |
| `240006` | TAG_NOT_FOUND                 | 标签不存在                   |
| `240007` | TAG_ALREADY_EXISTS            | 标签名称已存在               |
| `240008` | TAG_DISABLED                  | 标签未启用                   |
| `240009` | TAG_IN_USE                    | 标签已被使用，无法删除或禁用 |
| `240010` | TOPIC_TAG_ALREADY_BOUND       | 该主题已关联此标签           |
| `240011` | TOPIC_TAG_BINDING_NOT_FOUND   | 该主题未关联此标签           |
| `240012` | TOPIC_AUTHOR_NOT_FOUND        | 主题作者不存在               |

#### 11.5.5 成长域

| code     | 名称                        | 说明                             |
| -------- | --------------------------- | -------------------------------- |
| `250001` | TASK_NOT_FOUND              | 任务不存在                       |
| `250002` | TASK_ASSIGNMENT_NOT_FOUND   | 任务分配不存在、任务分配创建失败 |
| `250003` | TASK_PROGRESS_CONFLICT      | 任务进度更新冲突，请重试         |
| `250004` | TASK_COMPLETION_CONFLICT    | 任务完成状态更新冲突，请重试     |
| `250005` | TASK_NOT_CLAIMED            | 任务未领取                       |
| `250006` | TASK_EXPIRED                | 任务已过期                       |
| `250007` | TASK_PROGRESS_NOT_REACHED   | 任务进度未达成                   |
| `250008` | TASK_REWARD_ALREADY_SETTLED | 任务奖励已结算成功，无需重试     |
| `250009` | TASK_CODE_ALREADY_EXISTS    | 任务编码已存在                   |
| `250010` | BADGE_NOT_FOUND             | 徽章不存在                       |
| `250011` | BADGE_IN_USE                | 徽章已被分配，无法删除或禁用     |
| `250012` | USER_BADGE_RECORD_NOT_FOUND | 用户徽章记录不存在               |
| `250013` | LEVEL_RULE_NOT_FOUND        | 等级规则不存在                   |
| `250014` | USER_LEVEL_RULE_NOT_FOUND   | 用户等级规则不存在               |
| `250015` | MEMBER_LEVEL_NOT_ENOUGH     | 会员等级不足                     |
| `250016` | POINT_NOT_ENOUGH            | 积分不足                         |
| `250017` | POINT_RULE_NOT_FOUND        | 积分规则不存在                   |
| `250018` | GROWTH_RULE_NOT_FOUND       | 成长规则不存在                   |

#### 11.5.6 互动域

| code     | 名称                             | 说明                     |
| -------- | -------------------------------- | ------------------------ |
| `260001` | REPORT_NOT_FOUND                 | 举报记录不存在           |
| `260002` | REPORT_TARGET_TYPE_UNSUPPORTED   | 不支持的举报目标类型     |
| `260003` | REPORT_SELF_NOT_ALLOWED          | 不能举报自己             |
| `260004` | REPORT_RESULT_INVALID            | 举报处理结果非法         |
| `260005` | REPORT_ALREADY_RESOLVED          | 已处理举报不能重复裁决   |
| `260006` | PURCHASE_TARGET_TYPE_UNSUPPORTED | 不支持的购买业务类型     |
| `260007` | READING_STATE_TYPE_UNSUPPORTED   | 不支持的阅读状态业务类型 |

#### 11.5.7 消息域

| code     | 名称                                 | 说明                               |
| -------- | ------------------------------------ | ---------------------------------- |
| `270001` | NOTIFICATION_TEMPLATE_NOT_FOUND      | 通知模板不存在                     |
| `270002` | NOTIFICATION_TEMPLATE_ALREADY_EXISTS | 该通知类型的模板已存在             |
| `270003` | NOTIFICATION_TYPE_INVALID            | 通知类型非法                       |
| `270004` | NOTIFICATION_PREFERENCES_EMPTY       | preferences 不能为空               |
| `270005` | NOTIFICATION_TYPE_DUPLICATED         | preferences 中存在重复的通知类型   |
| `270006` | CONVERSATION_NOT_FOUND               | 会话不存在                         |
| `270007` | MESSAGE_NOT_FOUND                    | 消息不存在                         |
| `270008` | DIRECT_CONVERSATION_SELF_NOT_ALLOWED | 不允许给自己创建私聊会话           |
| `270009` | MESSAGE_CONTENT_EMPTY                | 消息内容不能为空                   |
| `270010` | CHAT_OUTBOX_MESSAGE_NOT_FOUND        | 聊天 outbox 消息不存在             |
| `270011` | OUTBOX_EVENT_TYPE_MISMATCH           | 通知事件类型与 payload.type 不一致 |

#### 11.5.8 后台与系统能力

| code     | 名称                         | 说明                               |
| -------- | ---------------------------- | ---------------------------------- |
| `285001` | REQUEST_LOG_NOT_FOUND        | 请求日志不存在                     |
| `285002` | IP2REGION_SWITCH_IN_PROGRESS | 当前正在切换 IP 属地库，请稍后重试 |
| `285003` | IP2REGION_FILE_EMPTY         | 上传文件不能为空                   |
| `285004` | IP2REGION_FILE_INVALID       | 上传文件类型不合法                 |

## 12. 影响范围

本方案至少会影响以下层面：

- `libs/platform/src/interceptors/*`
- `libs/platform/src/filters/*`
- `db/core/error/*`
- `db/core/drizzle.service.ts`
- 业务层中所有将资源不存在、唯一冲突、状态冲突翻译为 Nest HTTP 异常的 Service / Resolver
- 复用 `Response<T>` 或等效响应 DTO 的声明位置
- 未来新增错误语义时对应的 code 注册位置
- Swagger 示例与接口文档
- 相关单元测试与集成测试

## 13. 风险与取舍

### 13.1 主要收益

- 前端可以统一把业务失败当作正常业务响应处理。
- 业务资源不存在与业务冲突规则归于同一语义层，心智更一致。
- `404` 的含义会被严格收缩为“接口不存在”。
- `code` 字段终于回归真正的数字业务码语义。

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

1. 任一成功接口，响应体 `code` 为 `0`。
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
- 不保留“旧接口返回 HTTP status 镜像，新接口返回数字 bizCode”的混合状态。
- 以全局抽象替换为主，避免在 Controller 层逐个手写兼容判断。
- 先收敛基础设施层抽象，再批量替换业务域异常。

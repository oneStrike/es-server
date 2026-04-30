# libs/platform 代码规范审查报告

## 审查概览

- 审查模块：`libs/platform`
- 审查文件数：148
- 读取范围：`libs/platform/src/**`、`libs/platform/tsconfig.lib.json`
- 适用规范总条数：86
- 合规条数：57
- 违规条数：29
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 18 / LOW 11
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                                               | 校验结果 | 证据                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/platform` 可保留受控目录级 public API                            | 合规     | `src/config/index.ts`、`src/decorators/index.ts`、`src/dto/index.ts`、`src/utils/index.ts`、`src/modules/*/index.ts` 属平台例外范围                                                                                                                                                                                                   |
| 禁止新增/保留 `*.types.ts`、`types.ts`、`types/index.ts` 类型入口      | 违规     | `platform.module.types.ts`、`config/*.types.ts`、`utils/*.types.ts`、`modules/*/*.types.ts`、`decorators/validate/types.ts`、`modules/logger/types.ts`、`modules/auth/types/index.ts`                                                                                                                                                 |
| 纯 TS 类型/接口必须统一放入 `*.type.ts`                                | 违规     | `platform.module.ts:22`、`filters/http-exception.filter.ts:19-27`、`bootstrap/multipart.ts:16`、`interceptors/transform.interceptor.ts:8`、`config/db.config.ts:4-14`、`decorators/api-doc.decorator.ts:16-24`、`modules/upload/upload.service.ts:45-54`、`modules/auth/auth.service.ts:10`、`modules/health/health.service.ts:10-24` |
| 方法/函数签名不得直接写复杂对象、`any`、深层泛型                       | 违规     | `decorators/api-doc.decorator.ts:20`、`bootstrap/compression.ts:20`、`modules/auth/token-storage.types.ts:82-97`、`modules/eventing/domain-event-dispatch.service.ts:133-136`                                                                                                                                                         |
| Service/helper 对可预期业务失败应使用统一错误模型                      | 违规     | `modules/upload/upload.service.ts:79-197`、`:358`、`:372`、`:381`；`modules/eventing/domain-event-publisher.service.ts:45`、`:148`、`:151`；`modules/crypto/scrypt.service.ts:25`；`modules/crypto/rsa.service.ts:70`；`utils/timeRange.ts:14`                                                                                        |
| 启动/协议/鉴权/限流边界允许继续使用 Nest HTTP 异常                     | 合规     | `platform.module.ts:141` 的 ValidationPipe、`auth.guard.ts`、`auth.strategy.ts`、`login-guard.service.ts` 属协议/鉴权/限流边界                                                                                                                                                                                                        |
| 成功响应 code 应统一为 `0`                                             | 违规     | `decorators/api-doc.decorator.ts:35-38` Swagger 示例仍写 `example: 200`                                                                                                                                                                                                                                                               |
| 禁止直接 `console.log` 留在业务/共享服务路径                           | 违规     | `modules/upload/upload.service.ts:540`                                                                                                                                                                                                                                                                                                |
| 配置校验必须覆盖运行时实际读取的关键环境变量                           | 违规     | `config/auth.config.ts:7-11` 读取 `JWT_JWT_AUD`，`config/validation.config.ts:12-20` 未校验该变量                                                                                                                                                                                                                                     |
| 导出常量、枚举成员和映射字段必须有字段级业务注释                       | 违规     | `modules/eventing/eventing.constant.ts:1-9`、`:11-13`；`modules/upload/upload.types.ts:3-9`；`modules/geo/geo.types.ts:12-19`                                                                                                                                                                                                         |
| 方法注释统一用紧邻行注释，不使用 JSDoc                                 | 违规     | `modules/upload/upload.service.ts:58-557`、`modules/auth/auth.service.ts:16-166`、`modules/auth/login-guard.service.ts:12-77`、`modules/crypto/*.service.ts`、`modules/sms/sms.service.ts:16-179`                                                                                                                                     |
| catch 不得吞掉异常而不保留错误语义                                     | 违规     | `modules/geo/geo.service.ts:137`、`:293`、`:373`；`bootstrap/multipart.ts:40`                                                                                                                                                                                                                                                         |
| 测试不得用 `as never` / 双重断言绕过契约                               | 违规     | `bootstrap/app.setup.spec.ts:67`、`modules/upload/upload.service.spec.ts:43-46`、`:74`                                                                                                                                                                                                                                                |
| DTO 字段装饰器和 validation helper 基本符合平台公共入口职责            | 合规     | `decorators/validate/*.ts`、`dto/*.ts` 未发现运行时依赖业务 service/module                                                                                                                                                                                                                                                            |
| 本模块不含 `db/schema` 或 migration，Drizzle schema 字段注释规则不适用 | 不适用   | `libs/platform` 范围内无 schema/migration owner 文件                                                                                                                                                                                                                                                                                  |

## 按文件/模块拆分的详细违规清单

### 类型文件命名与入口

[MEDIUM] 平台层大量历史类型文件仍使用被禁用命名

- 位置：`libs/platform/src/platform.module.types.ts:1`、`config/aliyun.types.ts:1`、`config/upload.types.ts:1`、`utils/bytes.types.ts:1`、`utils/request-parse.types.ts:1`、`modules/upload/upload.types.ts:1`、`modules/auth/auth.types.ts:1`、`modules/auth/login-guard.types.ts:1`、`modules/auth/token-storage.types.ts:1`、`modules/geo/geo.types.ts:1`、`modules/sms/sms.types.ts:1`、`modules/captcha/captcha.types.ts:1`
- 对应规范：`04-typescript-types.md` / 禁止新增 `*.types.ts`，历史文件默认收敛到 `*.type.ts`
- 违规原因：这些文件承载平台公共类型，但命名仍是 `*.types.ts`。平台导入白名单允许某些 public API 暴露，不等于类型命名规范豁免。
- 整改建议：按 owner 分批改名为 `*.type.ts`，并通过平台 public API 维持兼容导出窗口；调用方逐步切换到新入口。

[MEDIUM] 使用 `types.ts` 和 `types/index.ts` 作为类型入口

- 位置：`libs/platform/src/decorators/validate/types.ts:1`、`libs/platform/src/modules/logger/types.ts:1`、`libs/platform/src/types/index.ts:1`、`libs/platform/src/modules/auth/types/index.ts:1`
- 对应规范：`04-typescript-types.md` / 使用 `types/` 目录仍必须直连具体 `*.type.ts`，禁止 `types.ts`、`types/index.ts`
- 违规原因：`types.ts` 和 `types/index.ts` 会重新形成目录语义入口，与“直连 owner 类型文件”的规范冲突。
- 整改建议：拆为 `validate-property-options.type.ts`、`logger-config.type.ts`、`platform.type.ts` 等具体文件；目录索引仅作为兼容层短期保留或移除。

### platform.module.ts

[MEDIUM] 平台模块文件内声明请求头类型

- 位置：`libs/platform/src/platform.module.ts:22`
- 对应规范：`04-typescript-types.md` / module 文件不得声明顶层纯类型
- 违规原因：`RequestIdHeaderCarrier` 是入口层请求对象裁剪类型，却直接放在 module 文件。
- 整改建议：迁入 `platform.module.type.ts` 或平台 request context 类型文件，module 中使用 `import type`。

[LOW] 模块注册逻辑存在模板化注释

- 位置：`libs/platform/src/platform.module.ts:48`、`:54`、`:57`、`:65`、`:70`、`:75`、`:80`、`:104`、`:115`、`:153`
- 对应规范：`05-comments.md` / 注释解释原因和边界，不逐句翻译代码
- 违规原因：多处注释仅复述“默认配置”“构建导入模块列表”“日志模块”“数据库模块”等代码行为。
- 整改建议：删除复述性注释，仅保留 ValidationPipe 错误语义、CLS request-id、限流策略等关键设计说明。

### filters/http-exception.filter.ts

[MEDIUM] exception filter 文件内声明纯类型

- 位置：`libs/platform/src/filters/http-exception.filter.ts:19`、`:27`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型统一放入 `*.type.ts`
- 违规原因：`ErrorDescriptor` 和 `FilterErrorInput` 是过滤器稳定内部类型，却放在 filter 主文件。
- 整改建议：迁入 `http-exception-filter.type.ts`，过滤器只保留异常映射逻辑。

[LOW] `safeParse` 和属地/静态头场景使用空 catch 丢失诊断

- 位置：`libs/platform/src/filters/http-exception.filter.ts:257`、`libs/platform/src/bootstrap/multipart.ts:40`
- 对应规范：`06-error-handling.md` / catch 后应保留错误语义
- 违规原因：异常日志字段解析失败、静态文件响应头解析失败均直接吞掉错误。虽然不能影响主链路，但完全无诊断信息会降低排障能力。
- 整改建议：保留降级返回，但补充 debug 级日志或结构化 cause 字段。

### interceptors/transform.interceptor.ts

[MEDIUM] 响应包装类型声明在 interceptor 文件

- 位置：`libs/platform/src/interceptors/transform.interceptor.ts:8`
- 对应规范：`04-typescript-types.md` / interceptor 文件不得声明顶层纯类型
- 违规原因：`TransformResponse<T>` 是统一响应 contract，应该由平台类型文件维护。
- 整改建议：移动到 `transform-response.type.ts` 或 `platform.type.ts`，并由拦截器引用。

### decorators/api-doc.decorator.ts

[MEDIUM] Swagger 成功响应示例 code 与运行时响应 code 不一致

- 位置：`libs/platform/src/decorators/api-doc.decorator.ts:35-38`
- 对应规范：`.trae/rules/PROJECT_RULES.md`、`06-error-handling.md` / 成功响应统一 `code=0`
- 违规原因：`TransformInterceptor` 返回 `ApiSuccessCode = 0`，但 `ApiDoc` 的基础响应示例写成 `example: 200`。这会误导前端按 HTTP 状态码判断业务响应码。
- 整改建议：将示例改为 `0`，并直接复用 `ApiSuccessCode`，避免文档与运行时漂移。

[MEDIUM] API 文档装饰器类型使用 `Record<string, any>`

- 位置：`libs/platform/src/decorators/api-doc.decorator.ts:20`
- 对应规范：`04-typescript-types.md` / 禁止 `any`
- 违规原因：`model?: Type<TModel> | Record<string, any>` 放宽了 schema 输入，后续装饰器调用可以绕过 OpenAPI schema 约束。
- 整改建议：改为 `Record<string, unknown>` 或引入 `SchemaObject | ReferenceObject` 这类明确 Swagger schema 类型。

### config/db.config.ts

[MEDIUM] 配置文件内声明分页查询类型

- 位置：`libs/platform/src/config/db.config.ts:4`、`:6`、`:8`、`:14`
- 对应规范：`04-typescript-types.md` / config 文件不得承载顶层纯类型
- 违规原因：`DbQueryOrderByRecord`、`DbQueryConfig`、`DbConfigInterface` 是稳定配置类型，却与运行时 `registerAs` 混在同一 config 文件。
- 整改建议：迁入 `db-config.type.ts`，`db.config.ts` 仅保留环境变量读取和 register 逻辑。

### config/validation.config.ts 与 config/auth.config.ts

[MEDIUM] 环境变量校验未覆盖实际读取的 JWT audience

- 位置：`libs/platform/src/config/auth.config.ts:7-11`、`libs/platform/src/config/validation.config.ts:12-20`
- 对应规范：工程风格与配置约束 / 配置校验必须覆盖运行时关键配置
- 违规原因：`AuthConfig` 读取 `JWT_JWT_AUD` 并默认为 `es`，但 validation schema 没有声明 `JWT_JWT_AUD`。生产配置写错时不会在启动期暴露。
- 整改建议：在 `environmentValidationSchema` 中加入 `JWT_JWT_AUD: Joi.string().required()` 或显式 `.default('es')`，并统一命名是否保留 `JWT_JWT_` 前缀。

### config/upload.config.ts

[LOW] 上传配置文件存在重复/陈旧注释和格式漂移

- 位置：`libs/platform/src/config/upload.config.ts:3`、`:83-86`
- 对应规范：`05-comments.md`、工程风格
- 违规原因：`parseBytes` 导入行保留分号；`注册上传配置` 注释重复为 JSDoc 与行注释并列，属于模板化重复注释。
- 整改建议：统一 prettier 格式；保留一条说明 register 目的的注释或直接删除重复注释。

### modules/upload/upload.service.ts

[MEDIUM] 上传服务对可预期校验失败直接抛 HTTP 异常

- 位置：`libs/platform/src/modules/upload/upload.service.ts:79`、`:85`、`:99`、`:105`、`:185`、`:190`、`:197`、`:358`、`:372`、`:381`
- 对应规范：`06-error-handling.md` / service 可预期业务失败不应直接绑定 HTTP 异常
- 违规原因：上传场景、文件类型、路径、文件名等可预期失败都由 service 抛 `BadRequestException`。该服务同时被本地文件二次上传复用，非 HTTP 调用方会被迫继承协议异常。
- 整改建议：拆分上传领域错误或使用 `BusinessException`；Controller/全局 filter 再映射为协议层 400。

[MEDIUM] 上传服务文件内声明纯接口

- 位置：`libs/platform/src/modules/upload/upload.service.ts:45`、`:50`
- 对应规范：`04-typescript-types.md` / service 文件禁止顶层类型
- 违规原因：`MultipartFieldLike`、`UploadResponseCarrier` 是内部边界类型，放在 service 主文件。
- 整改建议：迁入 `upload.type.ts` 或 `upload-boundary.type.ts`。

[LOW] 上传场景解析残留调试日志

- 位置：`libs/platform/src/modules/upload/upload.service.ts:540`
- 对应规范：代码质量 / 共享服务不应直接 `console.log`
- 违规原因：`console.log(normalizedScene)` 会把用户传入的上传场景写入 stdout，影响日志噪声和隐私边界。
- 整改建议：删除该日志；如需诊断，使用 `Logger.debug` 并避免输出未必要的用户输入。

### modules/upload/local-upload.provider.ts 与 bootstrap/multipart.ts

[LOW] 上传相关文件存在格式漂移和内联类型

- 位置：`libs/platform/src/modules/upload/local-upload.provider.ts:1`、`:14`、`:22`；`libs/platform/src/bootstrap/multipart.ts:1`、`:10-11`、`:16`
- 对应规范：工程风格、`04-typescript-types.md`
- 违规原因：部分导入行保留分号，长行未格式化；`StaticHeadersResponse` 是静态文件响应头适配类型，直接声明在 bootstrap 文件。
- 整改建议：运行 prettier；将 `StaticHeadersResponse` 移入 `multipart.type.ts`。

### modules/upload/upload.types.ts

[LOW] 类型文件存在重复堆叠注释

- 位置：`libs/platform/src/modules/upload/upload.types.ts:13-18`、`:29-34`、`:42-47`、`:55-60`、`:70-75`、`:82-85`、`:95-98`、`:104-109`、`:116-120`
- 对应规范：`05-comments.md` / 禁止为同一符号堆叠重复 JSDoc
- 违规原因：多个类型先有业务说明 JSDoc，紧接着又有“稳定领域类型 xxx”的模板注释，形成重复注释。
- 整改建议：保留业务说明，删除模板化第二段；必要时补充字段级语义。

### modules/eventing/eventing.constant.ts

[MEDIUM] 领域事件枚举和常量缺少字段级业务注释

- 位置：`libs/platform/src/modules/eventing/eventing.constant.ts:1-9`、`:11-13`
- 对应规范：`05-comments.md` / 导出枚举成员、常量字段必须有紧邻注释
- 违规原因：`DomainEventConsumerEnum`、`DomainEventDispatchStatusEnum` 以及批量大小/最大重试/超时常量没有说明每个值的业务语义。
- 整改建议：为每个 consumer、dispatch 状态和调度参数补充中文注释，写清重试上限与 processing 超时的调度含义。

### modules/eventing/domain-event-publisher.service.ts

[MEDIUM] 领域事件发布器直接抛 HTTP 400

- 位置：`libs/platform/src/modules/eventing/domain-event-publisher.service.ts:45`、`:148`、`:151`
- 对应规范：`06-error-handling.md` / service 可预期失败使用统一错误模型
- 违规原因：缺少 consumer、批量发布缺少幂等键属于领域事件发布契约失败，但当前抛 `BadRequestException`。
- 整改建议：改为 `BusinessException`、专用 `DomainEventPublishError`，或使用普通 `Error` 表达内部调用契约错误，再由调用边界转换。

### modules/eventing/domain-event-dispatch.service.ts

[LOW] dispatch 状态机方法注释不足

- 位置：`libs/platform/src/modules/eventing/domain-event-dispatch.service.ts:33`、`:42`、`:61`、`:153`、`:164`、`:197`、`:239`、`:270`
- 对应规范：`05-comments.md` / 所有方法定义前必须有简短注释
- 违规原因：调度状态机的 claim、mark、recover、retry 等关键方法没有紧邻方法注释，维护者需要阅读 SQL 条件才能确认幂等边界。
- 整改建议：为每个方法补一行说明 claim 条件、状态迁移和并发保护语义。

### modules/auth/auth.service.ts

[MEDIUM] 认证服务文件内声明刷新选项接口且 payload 未显式类型化

- 位置：`libs/platform/src/modules/auth/auth.service.ts:10`、`:36`
- 对应规范：`04-typescript-types.md` / service 文件禁止顶层类型；禁止隐式宽泛边界
- 违规原因：`RefreshAccessTokenOptions` 应属于认证 owner 类型；`generateTokens(payload)` 未声明 payload 类型，导致 token 载荷 contract 依赖隐式推断。
- 整改建议：把刷新选项迁入 `auth.type.ts`，将 `payload` 标注为 `JwtPayload` 的安全子集或专用 `GenerateTokenPayload`。

### modules/auth/token-storage.types.ts

[MEDIUM] token storage 类型文件存在重复注释和复杂内联函数签名

- 位置：`libs/platform/src/modules/auth/token-storage.types.ts:13-29`、`:73-97`
- 对应规范：`04-typescript-types.md`、`05-comments.md`
- 违规原因：同一类型前有业务 JSDoc 与“稳定领域类型”模板重复；`ITokenDelegate` 中多个函数参数直接写 `{ where: ... }`、`{ data: ... }` 内联对象结构。
- 整改建议：删除重复模板注释；提取 `TokenDelegateCreateArgs`、`TokenDelegateWhereArgs`、`TokenDelegateFindManyArgs` 等命名类型。

### modules/auth/login-guard.service.ts

[LOW] 登录防护方法注释仍使用 JSDoc 且 `@throws` 描述过期

- 位置：`libs/platform/src/modules/auth/login-guard.service.ts:12-77`
- 对应规范：`05-comments.md` / 方法注释用短行注释，不使用 JSDoc；注释不得与实现不一致
- 违规原因：`@throws BadRequestException` 与实现的 `HttpException(429)`、`UnauthorizedException` 不一致。
- 整改建议：改为短行注释，说明锁定、失败计数、解锁行为；删除过期 `@throws`。

### modules/crypto/scrypt.service.ts 与 modules/crypto/rsa.service.ts

[MEDIUM] crypto service 对输入/解密失败直接抛 HTTP 400

- 位置：`libs/platform/src/modules/crypto/scrypt.service.ts:25`、`libs/platform/src/modules/crypto/rsa.service.ts:70`
- 对应规范：`06-error-handling.md` / service 可预期失败不应绑定 HTTP 异常
- 违规原因：密码长度不合规、RSA 解密失败是可预期输入/加密边界失败，但 crypto 服务直接抛 `BadRequestException`。
- 整改建议：定义平台 crypto 错误或抛 `BusinessException(PlatformErrorCode.BAD_REQUEST, ...)` 的统一包装，由调用边界决定协议响应。

[LOW] crypto service 方法注释模板化

- 位置：`libs/platform/src/modules/crypto/scrypt.service.ts:8-77`、`libs/platform/src/modules/crypto/rsa.service.ts:7-82`
- 对应规范：`05-comments.md`
- 违规原因：注释大多复述“加密函数”“返回值”“指定哈希算法”，有效信息密度低。
- 整改建议：保留 scrypt 参数、salt 格式、OAEP sha256 兼容性等关键约束，删除逐句翻译注释。

### utils/timeRange.ts

[MEDIUM] 通用时间范围 helper 直接抛 HTTP 异常

- 位置：`libs/platform/src/utils/timeRange.ts:1`、`:14`
- 对应规范：`06-error-handling.md` / helper 不应无条件绑定 HTTP 协议
- 违规原因：`assertValidTimeRange` 是通用工具函数，但错误固定为 `BadRequestException`，非 HTTP 调用方无法复用。
- 整改建议：返回校验结果或抛领域无关的 `RangeError`/平台错误，再由 controller/DTO pipe 映射。

### modules/geo/geo.types.ts 与 modules/geo/geo.service.ts

[LOW] 属地类型文件存在重复模板注释，服务降级 catch 无诊断

- 位置：`libs/platform/src/modules/geo/geo.types.ts:6`、`:24`、`:36`；`libs/platform/src/modules/geo/geo.service.ts:137`、`:293`、`:373`
- 对应规范：`05-comments.md`、`06-error-handling.md`
- 违规原因：`GeoSource`、`GeoSnapshot`、`GeoLookupResult` 存在模板化重复注释；属地库 metadata 解析、初始化、查询失败全部静默降级为空属地。
- 整改建议：删除重复模板注释；降级仍可保留，但至少记录 debug 级原因和当前 filePath/source。

### modules/sms/sms.service.ts

[LOW] 短信服务日志输出手机号明文

- 位置：`libs/platform/src/modules/sms/sms.service.ts:121`、`:165`、`:170`
- 对应规范：安全风险 / 日志与诊断应避免泄露敏感标识
- 违规原因：发送、校验和失败日志直接输出完整手机号，生产日志会沉淀敏感个人信息。
- 整改建议：使用脱敏工具输出手机号后四位或 hash；错误日志保留模板、错误码、供应商 requestId 等诊断字段。

### bootstrap/compression.ts

[LOW] 函数内部声明复杂泛型别名

- 位置：`libs/platform/src/bootstrap/compression.ts:20`
- 对应规范：`04-typescript-types.md` / 复杂函数签名类型表达式需先命名
- 违规原因：`type RegisterPlugin = Parameters<FastifyAdapter['register']>[0]` 写在函数体内，属于局部复杂类型表达式。
- 整改建议：移动到 `compression.type.ts` 或文件顶部类型区并改为 `*.type.ts` owner 类型。

### bootstrap/app.setup.spec.ts 与 modules/upload/upload.service.spec.ts

[LOW] 测试使用 `as never` 构造依赖和 mock 结果

- 位置：`libs/platform/src/bootstrap/app.setup.spec.ts:67`、`libs/platform/src/modules/upload/upload.service.spec.ts:43`、`:44`、`:45`、`:46`、`:74`
- 对应规范：`08-testing.md` / 测试不得用 `as never` 绕过契约
- 违规原因：测试用 `as never` 压过 Nest app、ConfigService、provider、file-type 返回值类型，削弱了对真实依赖面的保护。
- 整改建议：定义最小 mock interface 或 `Pick<...>` 命名测试夹具类型，并让 mock 返回满足真实库类型的对象。

## 已审查且未发现独立违规项的文件

- `libs/platform/tsconfig.lib.json`：配置结构未发现违规项。
- `libs/platform/src/constant/base.constant.ts`、`content.constant.ts`、`interaction.constant.ts`、`logger.constant.ts`、`profile.constant.ts`：常量导出未发现独立违规项。
- `libs/platform/src/constant/audit.constant.ts`、`error-code.constant.ts`：枚举/错误码字段注释完整，未发现独立违规项。
- `libs/platform/src/bootstrap/swagger.ts`、`logStartupInfo.ts`、`app.setup.ts`、`app.setup.spec.ts`：除上文列明的测试断言和 console 启动输出外，未发现其他独立违规项；`logStartupInfo.ts` 属启动提示边界。
- `libs/platform/src/dto/base.dto.ts`、`page.dto.ts`、`drag-reorder.dto.ts`：DTO 字段和装饰器使用符合规范。
- `libs/platform/src/exceptions/business.exception.ts`：异常结构与业务 code 模型符合规范，但建议后续把选项类型迁出。
- `libs/platform/src/decorators/current-user.decorator.ts`、`public.decorator.ts`、`validate.decorator.ts`：装饰器职责清晰，未发现独立违规项。
- `libs/platform/src/decorators/validate/array-property.ts`、`boolean-property.ts`、`date-property.ts`、`enum-array-property.ts`、`enum-property.ts`、`enum-shared.ts`、`json-property.ts`、`nested-property.ts`、`number-property.ts`、`object-property.ts`、`regex-property.ts`、`string-property.ts`、`contract.ts`：除 `types.ts` 命名问题外，验证装饰器实现未发现独立违规项。
- `libs/platform/src/utils/bitmask.ts`、`bytes.ts`、`env.ts`、`is.ts`、`jsonParse.ts`、`mask.ts`、`regExp.ts`、`requestParse.ts`、`richText.ts`、`time.ts`、`time.spec.ts`：除 `.types.ts` 文件命名与 `timeRange` 异常模型外，工具函数未发现独立违规项。
- `libs/platform/src/modules/cache/cache.module.ts`：模块声明未发现违规项。
- `libs/platform/src/modules/captcha/captcha.service.ts`、`captcha.types.ts`、`dto/captcha.dto.ts`：除 `.types.ts` 命名外未发现独立违规项。
- `libs/platform/src/modules/health/health.controller.ts`、`health.module.ts`、`health.service.ts`：除内部 adapter 类型应迁出外，健康检查逻辑未发现独立违规项。
- `libs/platform/src/modules/logger/logger.module.ts`、`logger.service.ts`：除 `types.ts` 命名外未发现独立违规项。
- `libs/platform/src/modules/upload/upload.module.ts`、`upload-image-dimension.util.ts`、`qiniu-upload.provider.ts`、`superbed-upload.provider.ts`、`upload.service.spec.ts`：除上文列明的类型命名、测试断言和日志问题外，上传 provider 基本符合规范。
- `libs/platform/src/modules/auth/auth-cron.service.ts`、`auth.constant.ts`、`auth.guard.ts`、`auth.strategy.ts`、`base-token-storage.service.ts`、`jwt-blacklist.service.ts`：除类型命名、方法 JSDoc 和 `auth.service.ts` 类型问题外，认证协议边界未发现独立违规项。
- `libs/platform/src/modules/geo/geo.dto.ts`、`geo.module.ts`：DTO 与模块声明未发现独立违规项。
- `libs/platform/src/modules/sms/sms.constant.ts`、`sms.module.ts`、`dto/sms.dto.ts`：除 `sms.types.ts` 命名和手机号日志外未发现独立违规项。

## 整体合规率总结

- 模块合规率：约 66.3%（57/86）
- 平台层最大问题不是单点 bug，而是历史公共类型入口与当前规范不一致，影响所有业务模块的导入和类型放置。
- 未发现 CRITICAL/HIGH 级漏洞；但 `ApiDoc` 成功码错误、上传服务调试日志、短信手机号明文日志会直接影响客户端契约或生产诊断质量。

## 必改项清单

1. 分批将 `*.types.ts`、`types.ts`、`types/index.ts` 收敛为具体 `*.type.ts` 文件，并更新平台白名单导出。
2. 修正 `ApiDoc` 成功响应示例 code，确保 Swagger 与运行时 `code=0` 一致。
3. 删除 `UploadService.extractScene` 中的 `console.log(normalizedScene)`。
4. 将上传、事件发布、crypto、timeRange 等共享 service/helper 的可预期失败从 HTTP 异常中解耦。
5. 给 `DomainEventConsumerEnum`、`DomainEventDispatchStatusEnum` 和调度常量补字段级业务注释。
6. 将测试里的 `as never` 改为命名 mock/fixture 类型。

## 优化建议清单

1. 平台类型迁移建议先建立兼容导出，再逐模块替换导入，避免一次性破坏业务模块。
2. 统一清理方法 JSDoc 时，优先保留协议边界、鉴权锁定、事件幂等、上传安全头等原因型注释。
3. 短信和认证相关日志建议统一接入脱敏工具，避免平台层继续沉淀敏感标识。
4. 对属地库、静态文件头、指标类降级 catch 保留主流程可用，但增加 debug 级结构化日志，提升线上可观测性。

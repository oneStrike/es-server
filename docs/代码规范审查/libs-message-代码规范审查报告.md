# libs/message 代码规范审查报告

## 审查概览

- 审查模块：`libs/message`
- 审查文件数：49
- 读取范围：`libs/message/src/**`、`libs/message/tsconfig.lib.json`
- 适用规范总条数：86
- 合规条数：68
- 违规条数：18
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 11 / LOW 7
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                                                            | 校验结果 | 证据                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 导入边界必须使用白名单入口和 owner 文件直连                                         | 违规     | `notification-websocket.types.ts` 使用被禁用的 `.types.ts` 命名，并被 `notification-websocket.service.ts:11`、`notification-native-websocket.server.ts:4`、`:200`、`:211`、`notification.gateway.ts:6` 引用                                                                                                              |
| 禁止新增或保留 `*.types.ts`，历史文件默认收敛为 `*.type.ts`                         | 违规     | `libs/message/src/notification/notification-websocket.types.ts`                                                                                                                                                                                                                                                          |
| 纯 TS 类型/接口必须统一放入 `*.type.ts`                                             | 违规     | `chat.service.ts:55`、`inbox.service.ts:11`、`ws-monitor.service.ts:5`、`message-event.constant.ts:4-26`、`notification-native-websocket.server.ts:10`、`notification-realtime.service.ts:7-41`、`notification-template.service.ts:38-47`、`notification.constant.ts:26`、`notification/dto/notification.dto.ts:321-368` |
| 方法/函数签名中的复杂类型必须先命名                                                 | 违规     | `notification-delivery.service.ts:99`、`:239`、`:390`、`inbox.service.ts:44`、`message-domain-event.factory.ts` 多处 `input: { ... }`、`chat.service.ts:1255-1256`                                                                                                                                                       |
| Service/Resolver 可预期业务失败应抛 `BusinessException`                             | 违规     | `chat.service.ts:396`、`:466`、`:1362`、`:1379`、`:1398`、`:1417`、`:1421`、`:1437`、`:1443`、`:1464`、`:1468`；`notification-template.service.ts:376`、`:444`、`:471`、`:475`；`notification-preference.service.ts:133`、`:144`、`:158`、`:163`                                                                         |
| DTO 文件不得承载纯内部类型或复杂运行时 schema 组装类型                              | 违规     | `notification/dto/notification.dto.ts:321-427`                                                                                                                                                                                                                                                                           |
| 方法注释必须使用紧邻行注释，禁止用 JSDoc 作为方法注释                               | 违规     | `chat.service.ts:1357-1482`、`notification-websocket.service.ts` 多处方法 JSDoc、`ws-monitor.service.ts` 多处方法 JSDoc                                                                                                                                                                                                  |
| catch 不得吞掉异常而不保留错误语义                                                  | 违规     | `chat.service.ts:1503`、`:1507`、`:1519`；`message-domain-event-dispatch.worker.ts:81`；`notification-websocket.service.ts:133`、`:685`                                                                                                                                                                                  |
| 测试不得使用 `as never` / 宽泛双重断言绕过契约                                      | 违规     | `notification-projection.service.spec.ts:37`、`:50-52`、`:113-115`、`:178-180`、`:243-245`；`notification-preference.service.spec.ts:46`                                                                                                                                                                                 |
| DTO 枚举描述应使用中文业务语义，不直接暴露技术 key                                  | 合规     | 本模块 DTO 装饰器未发现直接以英文常量名替代业务描述的新增问题                                                                                                                                                                                                                                                            |
| 本模块未包含 schema/migration 文件，Drizzle schema 字段注释和迁移联动规则本轮不适用 | 不适用   | `libs/message` 范围内无 `db/schema` 或 `db/migration` 文件                                                                                                                                                                                                                                                               |

## 按文件/模块拆分的详细违规清单

### notification/notification-websocket.types.ts

[MEDIUM] WebSocket 类型文件使用被禁用的 `.types.ts` 命名

- 位置：`libs/message/src/notification/notification-websocket.types.ts:1`
- 对应规范：`04-typescript-types.md` / 禁止新增 `*.types.ts`，历史文件默认收敛到 `*.type.ts`
- 违规原因：项目类型规范明确要求纯类型文件使用 `*.type.ts`。当前文件名为 `notification-websocket.types.ts`，且已被 service、gateway、native server 多处导入，继续扩大了错误入口。
- 整改建议：重命名为 `notification-websocket.type.ts`，同步更新 `notification-websocket.service.ts`、`notification-native-websocket.server.ts`、`notification.gateway.ts` 中的导入路径。

[LOW] 稳定领域类型注释全部使用模板化重复文案

- 位置：`libs/message/src/notification/notification-websocket.types.ts:3`、`:10`、`:19`、`:25`、`:33`
- 对应规范：`05-comments.md` / 类型注释应说明业务语义、供谁复用、和 DTO/schema 的关系
- 违规原因：五个类型均使用“稳定领域类型 xxx，仅供内部领域/服务链路复用，避免重复定义”的同构模板，未说明消息发送、已读、ack、原生连接请求各自的边界语义。
- 整改建议：分别补充连接协议、客户端消息、已读同步、ack 响应和原生 WebSocket envelope 的业务含义。

### chat/chat.service.ts

[MEDIUM] 聊天服务文件内声明纯接口

- 位置：`libs/message/src/chat/chat.service.ts:55`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型统一放入 `*.type.ts`
- 违规原因：`ChatMessageCreatedDomainEventPayload` 是事件 payload 类型，却直接声明在 service 主文件中。
- 整改建议：移入 `chat.type.ts` 或事件 owner 的 `message-event.type.ts`，service 中使用 `import type` 引用。

[MEDIUM] 聊天服务对可预期输入错误直接抛 HTTP 400

- 位置：`libs/message/src/chat/chat.service.ts:396`、`:466`、`:1362`、`:1379`、`:1398`、`:1417`、`:1421`、`:1437`、`:1443`、`:1464`、`:1468`
- 对应规范：`06-error-handling.md` / service 可预期业务失败使用 `BusinessException`
- 违规原因：游标互斥、消息内容为空、整数字符串非法、payload 非对象、messageType 和 clientMessageId 非法都在 service 中直接抛 `BadRequestException`，把业务/领域校验绑定到了 HTTP 协议异常。
- 整改建议：对 DTO/协议层可处理的格式错误前移到 DTO pipe；保留在 service 的领域失败改为 `BusinessException(BusinessErrorCode.CURRENT_OPERATION_NOT_ALLOWED | RESOURCE_NOT_FOUND, ...)` 或专用业务错误码。

[MEDIUM] 聊天消息领域事件结果类型直接使用深层泛型表达式

- 位置：`libs/message/src/chat/chat.service.ts:1255`、`:1256`
- 对应规范：`04-typescript-types.md` / 复杂方法签名不得直接写 `Awaited<ReturnType<...>>`
- 违规原因：方法签名中直接展开 `Awaited<ReturnType<typeof ...>>`，降低可读性，也让调用方依赖 service 内部 helper 形态。
- 整改建议：在 owner type 文件中定义 `PersistChatMessageResult`、`ChatMessageCreatedEventInput` 等命名类型。

[LOW] 方法注释使用 JSDoc 且部分注释复述异常类型

- 位置：`libs/message/src/chat/chat.service.ts:1357-1482`
- 对应规范：`05-comments.md` / 方法注释用短行注释，不使用 JSDoc
- 违规原因：多个私有校验方法使用 JSDoc，并包含 `@throws BadRequestException`，既不符合方法注释形式，也与后续应改为业务异常的错误语义冲突。
- 整改建议：改为紧邻方法定义的一到两行中文行注释，说明方法职责；异常语义由代码和统一错误模型表达。

[LOW] 指标记录失败被空 catch 吞掉

- 位置：`libs/message/src/chat/chat.service.ts:1503`、`:1507`、`:1519`
- 对应规范：`06-error-handling.md` / 禁止吞掉异常而不保留错误语义
- 违规原因：`recordResyncTriggered()`、`recordResyncSuccess()`、`recordResyncFailure()` 的失败全部被 `catch(() => {})` 吞掉。虽然指标写入属于旁路能力，但完全丢失错误上下文会影响线上诊断。
- 整改建议：使用 `Logger.debug`/`Logger.warn` 记录 metric 名称、conversationId、lastSeq 等关键字段，保持主流程可降级。

### inbox/inbox.service.ts

[MEDIUM] inbox service 内部声明导出接口和内联复杂返回类型

- 位置：`libs/message/src/inbox/inbox.service.ts:11`、`:44`、`:64`
- 对应规范：`04-typescript-types.md` / service 文件禁止顶层类型；复杂签名需命名
- 违规原因：`InboxLatestChatSummary` 是可复用查询汇总类型，却放在 service 文件；`extractRows` 和 `latestNotification?: { ... }` 直接使用内联对象结构。
- 整改建议：新增 `inbox.type.ts`，放入 `InboxLatestChatSummary`、`InboxExtractRowsResult`、`InboxLatestNotificationSummary` 等命名类型。

### monitor/ws-monitor.service.ts

[MEDIUM] monitor service 内部声明纯接口

- 位置：`libs/message/src/monitor/ws-monitor.service.ts:5`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型统一放入 `*.type.ts`
- 违规原因：`MessageWsMetricDelta` 是指标增量结构，当前直接放在 service 文件顶部。
- 整改建议：移入 `message-ws-monitor.type.ts` 或同域 `monitor.type.ts`。

[LOW] monitor 方法使用 JSDoc 作为方法注释

- 位置：`libs/message/src/monitor/ws-monitor.service.ts:15-120`
- 对应规范：`05-comments.md` / 方法注释统一用行注释
- 违规原因：多个 service 方法使用 JSDoc 说明“记录连接/断开/重连”等行为，不符合本仓库方法注释形式。
- 整改建议：替换为简短中文行注释，并保留关键指标语义即可。

### eventing/message-event.constant.ts

[MEDIUM] constant 文件混入事件类型定义

- 位置：`libs/message/src/eventing/message-event.constant.ts:4`、`:20`、`:26`
- 对应规范：`04-typescript-types.md` / constant 文件不得声明顶层纯类型
- 违规原因：`MessageDomainEventKey`、`MessageNotificationProjectionMode`、`MessageDomainEventDefinition` 是纯类型，却放在 constant 文件中。
- 整改建议：移动到 `message-event.type.ts`，constant 文件仅保留事件定义常量和查找函数。

### eventing/notification-event.consumer.ts

[LOW] 通过 `as never` 规避事件键收窄

- 位置：`libs/message/src/eventing/notification-event.consumer.ts:195`
- 对应规范：`04-typescript-types.md` / 禁止使用断言绕过类型契约
- 违规原因：`getMessageDomainEventDefinition(event.eventKey as never)` 表明 `DomainEventRecord.eventKey` 与本模块事件键之间缺少显式守卫。
- 整改建议：增加 `isMessageDomainEventKey(value): value is MessageDomainEventKey` 类型守卫，先校验再调用定义查找。

### eventing/message-domain-event-dispatch.worker.ts

[LOW] 派发失败处理存在空 catch

- 位置：`libs/message/src/eventing/message-domain-event-dispatch.worker.ts:81`
- 对应规范：`06-error-handling.md` / catch 后必须保留错误语义
- 违规原因：如果状态回写或补偿调用失败被空 catch 吞掉，无法从日志定位派发状态不一致的根因。
- 整改建议：至少记录 eventId、dispatchId、consumer、retryCount 和错误 cause。

### notification/notification-native-websocket.server.ts

[MEDIUM] native WebSocket server 文件内声明连接状态接口

- 位置：`libs/message/src/notification/notification-native-websocket.server.ts:10`
- 对应规范：`04-typescript-types.md` / service/adapter 文件禁止顶层纯类型
- 违规原因：`NativeWsClientState` 是连接状态结构，应作为 WebSocket adapter owner 类型维护。
- 整改建议：迁入 `notification-websocket.type.ts`，与 envelope/payload 类型一起收口。

### notification/notification-realtime.service.ts

[MEDIUM] 实时通知 service 文件内声明多个 payload 接口

- 位置：`libs/message/src/notification/notification-realtime.service.ts:7`、`:11`、`:16`、`:30`、`:41`
- 对应规范：`04-typescript-types.md` / service 文件不得声明顶层 type/interface
- 违规原因：删除通知、已读同步、聊天消息、会话更新、inbox 汇总等 payload 都属于稳定事件负载，却散落在 service 文件顶部。
- 整改建议：迁入 `notification-realtime.type.ts`，并按事件名建立明确 payload 类型。

### notification/notification-template.service.ts

[MEDIUM] 模板服务文件内声明缓存与上下文类型

- 位置：`libs/message/src/notification/notification-template.service.ts:38`、`:47`
- 对应规范：`04-typescript-types.md` / service 文件禁止顶层类型
- 违规原因：`NotificationTemplateCacheEntry` 和 `NotificationTemplateContextValue` 是内部领域结构，当前声明在 service 主文件。
- 整改建议：移动到 `notification-template.type.ts`，service 仅引用命名类型。

[MEDIUM] 模板校验失败直接抛 HTTP 400

- 位置：`libs/message/src/notification/notification-template.service.ts:376`、`:444`、`:471`、`:475`
- 对应规范：`06-error-handling.md` / service 可预期业务失败使用 `BusinessException`
- 违规原因：模板占位符非法、通知分类非法等后台配置业务失败直接抛 `BadRequestException`。
- 整改建议：使用 `BusinessException` 和共享业务错误码表达配置非法；若属于 DTO 字段格式错误，应前移到 DTO 校验。

[MEDIUM] 模板路径解析使用宽泛 Record 断言

- 位置：`libs/message/src/notification/notification-template.service.ts:365`
- 对应规范：`04-typescript-types.md` / `unknown` 使用后必须收窄，禁止宽泛断言沿链路透传
- 违规原因：`(current as Record<string, unknown>)[key]` 依赖断言读取模板上下文，没有先确认当前节点是开放对象。
- 整改建议：增加 `isTemplateContextRecord` 类型守卫，确认对象边界后再读取下一层。

### notification/notification-preference.service.ts

[MEDIUM] 通知偏好服务直接抛 HTTP 400

- 位置：`libs/message/src/notification/notification-preference.service.ts:133`、`:144`、`:158`、`:163`
- 对应规范：`06-error-handling.md` / service 可预期业务失败使用 `BusinessException`
- 违规原因：偏好为空、分类重复、通知分类非法均为可预期业务校验失败，不应在 service 中绑定 `BadRequestException`。
- 整改建议：偏好结构格式错误前移 DTO 校验；领域规则失败改为 `BusinessException(BusinessErrorCode.CURRENT_OPERATION_NOT_ALLOWED, ...)` 或新增业务错误码。

### notification/notification-query-id.util.ts

[LOW] util 直接抛 Nest HTTP 异常，调用方无法按业务场景映射

- 位置：`libs/message/src/notification/notification-query-id.util.ts:1`、`:12`
- 对应规范：`06-error-handling.md` / helper 可预期失败不应无条件绑定 HTTP 协议
- 违规原因：`parsePositiveBigintQueryId` 被 delivery 查询等 service 复用，非法 query id 直接抛 `BadRequestException`，使非 HTTP 调用方也继承协议异常。
- 整改建议：返回解析结果联合类型或抛领域解析错误，再由 controller/DTO pipe 或调用 service 映射成协议错误。

### notification/notification.constant.ts

[MEDIUM] constant 文件声明类型并且映射字段注释不足

- 位置：`libs/message/src/notification/notification.constant.ts:26`、`:40`、`:48`、`:80`
- 对应规范：`04-typescript-types.md`、`05-comments.md`
- 违规原因：`MessageNotificationCategoryKey` 是纯类型却放在 constant 文件；多个导出映射常量只表达整体用途，字段级业务含义需要读者从 key 名推断。
- 整改建议：类型移入 `notification-contract.type.ts` 或 `notification.type.ts`；为各 category、delivery status、preference 映射字段补充紧邻中文注释。

### notification/dto/notification.dto.ts

[MEDIUM] DTO 文件承载大量纯 TS 类型和复杂 Swagger schema helper

- 位置：`libs/message/src/notification/dto/notification.dto.ts:321`、`:326`、`:332`、`:336`、`:340`、`:345`、`:349`、`:355`、`:368`、`:382-427`
- 对应规范：`04-typescript-types.md` / DTO 文件默认只定义 DTO；纯类型放入 `*.type.ts`
- 违规原因：通知数据 union、接口映射和 `Record<string, SchemaObject | ReferenceObject>` schema 组装逻辑集中在 DTO 文件中，混合了 HTTP 文档类、内部类型映射和 Swagger schema 细节。
- 整改建议：DTO 类保留字段文档；数据映射类型迁入 `notification-contract.type.ts`；复杂 schema 生成 helper 迁入专用 swagger helper 文件并保持 DTO 文件轻量。

### notification/notification-public.mapper.ts

[MEDIUM] mapper 文件内声明导出类型

- 位置：`libs/message/src/notification/notification-public.mapper.ts:5`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型统一放入 `*.type.ts`
- 违规原因：`NotificationActorSource` 是基于 `AppUserSelect` 的字段视图类型，却直接声明在 mapper 文件。
- 整改建议：移动到 `notification-contract.type.ts` 或 `notification-public.type.ts`，mapper 只负责转换逻辑。

### notification/notification-delivery.service.ts

[MEDIUM] delivery service 多个方法签名直接写内联对象类型

- 位置：`libs/message/src/notification/notification-delivery.service.ts:99`、`:239`、`:390`
- 对应规范：`04-typescript-types.md` / 方法签名不得直接写复杂对象类型
- 违规原因：`recordFailedDispatch`、`upsertDeliveryRecord`、`assertRequiredTaskReminderProjectionFacts` 的参数直接写多字段对象结构，且包含联合类型和可选字段。
- 整改建议：在 `notification-delivery.type.ts` 中定义 `RecordFailedDispatchInput`、`UpsertNotificationDeliveryRecordInput`、`TaskReminderProjectionFacts`。

### eventing/notification-projection.service.spec.ts

[LOW] 测试使用 `as never` 和双重断言绕过依赖契约

- 位置：`libs/message/src/eventing/notification-projection.service.spec.ts:37`、`:50`、`:51`、`:52`、`:113`、`:114`、`:115`、`:178`、`:179`、`:180`、`:243`、`:244`、`:245`
- 对应规范：`08-testing.md`、`04-typescript-types.md`
- 违规原因：spec 通过 `as never` 和 `as unknown as DrizzleService` 压过构造依赖类型，测试没有真实表达 service 需要的最小依赖 contract。
- 整改建议：定义测试专用 fake 类型或使用 `Partial<Pick<...>>` 的命名测试夹具类型，避免断言私有实现细节。

### notification/notification-preference.service.spec.ts

[LOW] 测试使用双重断言伪造 DrizzleService

- 位置：`libs/message/src/notification/notification-preference.service.spec.ts:46`
- 对应规范：`08-testing.md`、`04-typescript-types.md`
- 违规原因：`as unknown as DrizzleService` 让测试绕过真实依赖面，后续构造函数变更时不容易暴露契约变化。
- 整改建议：抽出 `createDrizzleServiceMock()` 并返回满足 `Pick<DrizzleService, 'db' | ...>` 的命名夹具类型。

## 已审查且未发现违规项的文件

- `libs/message/tsconfig.lib.json`：配置结构符合本模块当前规范要求。
- `libs/message/src/message.module.ts`：模块声明和导入未发现违规项。
- `libs/message/src/monitor/monitor.module.ts`：模块声明未发现违规项。
- `libs/message/src/monitor/dto/message-monitor.dto.ts`：DTO 装饰器、分页继承和导入入口未发现违规项。
- `libs/message/src/eventing/chat-realtime-event.consumer.ts`：导入边界和消费逻辑未发现违规项。
- `libs/message/src/eventing/message-domain-event.factory.ts`：存在内联入参类型问题已归入“复杂方法签名”汇总，未发现其他独立违规项。
- `libs/message/src/eventing/message-domain-event.publisher.ts`：发布封装和导入边界未发现违规项。
- `libs/message/src/eventing/message-domain-event.module.ts`：模块声明和平台 eventing 导入命中白名单。
- `libs/message/src/eventing/notification-event.consumer.ts`：除 `as never` 事件键收窄问题外，未发现其他独立违规项。
- `libs/message/src/eventing/notification-projection.service.ts`：投影主流程、偏好/模板调用和 delivery 记录协作未发现其他独立违规项。
- `libs/message/src/chat/chat.constant.ts`：常量定义未发现独立违规项。
- `libs/message/src/chat/dto/chat.dto.ts`：DTO 装饰器、JSON 字段和导入入口未发现违规项。
- `libs/message/src/inbox/inbox.module.ts`：模块声明未发现违规项。
- `libs/message/src/inbox/dto/inbox.dto.ts`：DTO 字段声明和装饰器未发现违规项。
- `libs/message/src/notification/notification.service.ts`：查询服务未发现独立违规项。
- `libs/message/src/notification/notification.module.ts`：模块导入命中平台白名单。
- `libs/message/src/notification/notification.gateway.ts`：除引用 `.types.ts` 外，gateway 协议适配未发现其他独立违规项。
- `libs/message/src/notification/notification-unread.type.ts`：类型文件命名和类型职责符合规范。
- `libs/message/src/notification/notification-template.type.ts`：类型文件命名和类型职责符合规范。
- `libs/message/src/notification/notification-template-contract.ts`：当前作为契约类型文件使用，未发现除命名风格外的阻断性问题；建议后续合并到 `*.type.ts` 体系。
- `libs/message/src/notification/notification-query-id.util.ts`：除 HTTP 异常绑定问题外，正整数解析逻辑未发现其他违规项。
- `libs/message/src/notification/notification-category-key-filter.util.ts`：分类过滤逻辑未发现违规项。
- `libs/message/src/notification/notification-preference.type.ts`：类型文件命名和职责符合规范。
- `libs/message/src/notification/notification-contract.type.ts`：类型文件命名和职责符合规范。
- `libs/message/src/notification/dto/notification-delivery-filter.dto.ts`：DTO 装饰器和分页字段未发现违规项。
- `libs/message/src/notification/dto/notification-template.dto.ts`：DTO 字段装饰器未发现违规项。
- `libs/message/src/notification/dto/notification-unread.dto.ts`：DTO 字段装饰器未发现违规项。
- `libs/message/src/notification/notification-public.mapper.spec.ts`：mapper 行为测试未发现违规项。

## 整体合规率总结

- 模块合规率：约 79.1%（68/86）
- 主要风险集中在类型放置、异常模型和注释形式三类规范。
- 本模块没有发现 CRITICAL/HIGH 级别问题，但 MEDIUM 级问题覆盖 service、DTO、eventing、WebSocket adapter 多个关键路径，建议按 owner 边界集中整改。

## 必改项清单

1. 将 `notification-websocket.types.ts` 收敛为 `notification-websocket.type.ts` 并修正所有导入。
2. 将 service、constant、DTO、mapper 文件中的顶层 type/interface 移入同域 `*.type.ts`。
3. 将 `chat.service.ts`、`notification-template.service.ts`、`notification-preference.service.ts` 中的可预期业务失败改为 `BusinessException` 或前移 DTO 校验。
4. 为 delivery、inbox、event factory、chat 持久化等复杂签名补充命名类型。
5. 清理 `as never`、`as unknown as` 测试断言，改用可维护的测试夹具类型。

## 优化建议清单

1. WebSocket 协议 payload、ack、native envelope、连接状态建议统一归档到单一 owner 类型文件，减少 adapter/service 之间的协议漂移。
2. 通知 DTO 中的 Swagger schema helper 建议拆到专用 helper，避免 DTO 文件同时承载文档类和 schema 运行时代码。
3. 指标与派发补偿的旁路失败可以保留降级，但应记录结构化 debug/warn 日志，便于生产排查。
4. 把方法 JSDoc 批量替换为短行注释时，优先保留幂等、重试、投影、WebSocket 协议边界等关键原因说明。

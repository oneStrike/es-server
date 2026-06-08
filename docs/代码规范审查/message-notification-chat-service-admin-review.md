# 消息通知与聊天模块审查问题记录

审查日期：2026-06-08

审查范围：

- 后端 service：`libs/message/src/chat`、`libs/message/src/notification`、`libs/message/src/inbox`、`libs/message/src/eventing`
- 后端接口：`apps/app-api/src/modules/message`、`apps/admin-api/src/modules/message`
- 数据库：`chat_conversation`、`chat_conversation_member`、`chat_message`、`user_notification`、`notification_delivery`、`notification_template`、`domain_event_dispatch`
- 管理端：消息运行监控、通知模板配置、消息相关生成 API 类型
- APP 对接：消息中心、通知列表、聊天会话、聊天实时连接、未读数 store

最终结论：`REQUEST CHANGES`

架构状态：服务链路 `WATCH`；admin 运营闭环 `BLOCK`

## 阻断问题

### H-01 聊天发送后按成员重算 inbox summary，存在查询放大风险

证据：

- `libs/message/src/chat/chat.service.ts:563`
- `libs/message/src/chat/chat.service.ts:588`
- `libs/message/src/inbox/inbox.service.ts:136`

问题：发送消息后对会话成员逐个推送实时事件，并对每个成员调用 `getSummary()`。`getSummary()` 内部会并发执行通知未读、聊天未读、最新通知、最新会话等多条查询。

影响：当前像是私聊模型，但 fanout 边界没有强制“仅两个活跃成员”。一旦出现群聊扩展、系统会话或脏数据，单条聊天消息会放大为 `成员数 * 多次 DB 查询`，同时增加 WS 推送压力。

建议：在发送 fanout 边界强制校验私聊成员数，或把 summary 更新改成批量、缓存、防抖或异步刷新；如果只支持私聊，应把“最多两个活跃成员”的约束写入服务层和测试。

### H-02 app 会话输出包含内部 bizKey

证据：

- `libs/message/src/chat/chat.service.ts:1127`
- `libs/message/src/chat/dto/chat.dto.ts:569`
- `es-app-v2/src/api/types/message/message.d.ts:643`

问题：服务端运行时会把 `conversation.bizKey` 组装到 app-facing 会话响应中，形式类似 `direct:10001:10002`。生成的 app 类型未显式声明该字段，但响应对象仍可能带出。

影响：泄露内部会话键和双方用户 ID 组合。APP 侧已有 `id` 与 `peerUser`，不需要该字段完成业务展示或请求。

建议：从公开 app 输出中移除 `bizKey`；如需排障，仅在受控 admin/debug 接口中按权限暴露。

### H-03 APP 消息中心部分用户动作没有服务端持久化闭环

证据：

- `apps/app-api/src/modules/message/message.controller.ts:43`
- `apps/app-api/src/modules/message/message.controller.ts:115`
- `es-app-v2/src/api/core/message/message.ts:28`
- `es-app-v2/src/pages/message/message.vue:249`
- `es-app-v2/src/pages/message/message.vue:258`
- `es-app-v2/src/pages/message/message.vue:267`
- `es-app-v2/src/pages/message/message-comment-list.vue:305`
- `es-app-v2/src/pages/message/message-like-collect.vue:265`
- `es-app-v2/src/pages/message/message-follow-notice.vue:157`

问题：APP UI 暴露删除会话、标记会话已读、置顶会话等动作，但 app-api 只提供通知分页/已读、聊天打开/列表/消息/上传、inbox 摘要/时间线等接口。多处通知删除也明确是“仅本地删除”。

影响：用户以为操作成功，刷新或换端后状态恢复；消息中心业务闭环不成立。

建议：补齐会话隐藏/删除、置顶、列表已读、通知删除或隐藏等服务端 API；如果本期不做，应移除入口或明确展示“仅本地临时操作”。

### H-04 admin 监控接口暴露原始诊断与用户标识，未看到消息模块内细粒度权限

证据：

- `apps/admin-api/src/modules/message/message.controller.ts:15`
- `apps/admin-api/src/modules/message/message.controller.ts:26`
- `apps/admin-api/src/modules/message/message-monitor.service.ts:78`
- `libs/message/src/notification/notification-delivery.service.ts:199`
- `es-admin/apps/web-ele/src/views/message/monitor/model/dispatch.ts:145`
- `es-admin/apps/web-ele/src/views/message/monitor/model/delivery.ts:158`
- `es-admin/apps/web-ele/src/router/routes/modules/message-manager.ts:18`

问题：消息运行页向所有能进入该路由的 admin 展示 `lastError`、`failureReason`、`fallbackReason`、`receiverUserId`、`projectionKey`、`eventId`、`dispatchId` 等诊断字段，并提供按 `dispatchId` 重试投递能力。当前消息路由元信息只看到标题/图标，未在消息模块内看到单独的操作权限声明。

影响：错误文本可能包含内部实现、用户或内容标识；重试能力属于生产侧写操作，给普通运营过宽。

建议：拆分“运营支持视图”和“SRE/开发诊断视图”。普通运营只看中文业务状态、用户可识别信息和可执行建议；原始错误、内部 key/id、重试操作需单独权限并做脱敏。

### H-05 WebSocket 实时推送是进程本地能力，多实例部署不闭环

证据：

- `libs/message/src/notification/notification-websocket.service.ts:47`
- `libs/message/src/notification/notification-websocket.service.ts:279`
- `libs/message/src/notification/notification-realtime.service.ts:18`

问题：WS 客户端保存在进程内 `Map<number, Set<WebSocket>>` 中，`emitToUser()` 只向本进程连接发送。

影响：多实例部署时，如果用户连接在实例 A，而事件在实例 B 消费，实时消息不会被推到用户连接上。APP 的重连/HTTP resync 能缓解最终一致性，但不能保证实时闭环。

建议：接入 Redis/pubsub 或 WebSocket adapter 做跨实例 fanout；或明确单实例/粘性会话为部署约束，并在监控中展示未推送只能靠补偿拉取的风险。

### H-06 重新发送是低上下文 dispatch 重放，不是运营可理解的业务操作

证据：

- `es-admin/apps/web-ele/src/views/message/monitor/index.vue:158`
- `es-admin/apps/web-ele/src/views/message/monitor/index.vue:182`
- `es-admin/apps/web-ele/src/views/message/monitor/index.vue:190`
- `apps/admin-api/src/modules/message/message-monitor.service.ts:124`
- `apps/admin-api/src/modules/message/message-monitor.service.ts:131`

问题：delivery 行只要状态为失败就展示“重新发送”，确认文案只包含原始 `dispatchId`，后端也只是按 dispatch ID 调用 notification consumer 重试。

影响：运营无法在确认前看到接收人、通知类型、业务对象、失败原因摘要、预计会重新发送什么内容；误点后会触发生产侧重放。

建议：把重试改成业务化动作：确认弹窗展示接收用户、通知类型、业务对象、失败原因和重试影响；要求填写操作原因；后端校验 delivery 行仍为可重试状态，并按权限限制该动作。

## 数据库与性能问题

### M-01 admin 概览用三个分页接口取 total，触发多次 count

证据：

- `es-admin/apps/web-ele/src/views/message/monitor/index.vue:135`
- `es-admin/apps/web-ele/src/views/message/monitor/model/shared.ts:56`
- `apps/admin-api/src/modules/message/message-monitor.service.ts:68`
- `libs/message/src/notification/notification-delivery.service.ts:194`

问题：消息运行概览为了展示失败/重试数量，用 `pageSize: 1` 调用三次分页接口，再读取 `total`。后端分页接口会执行 `COUNT(*)`，dispatch 还会 join `domain_event` 与 `notification_delivery`。

影响：页面首屏会产生多个面向历史表的 exact count。随着 dispatch/delivery 历史增长，概览会成为高频慢查询入口。

建议：新增专用 summary 聚合接口，按状态维护索引或缓存；概览不要复用通用分页 total。

### M-02 admin 监控筛选/排序前端展示，后端没有完整兑现

证据：

- `es-admin/apps/web-ele/src/views/message/monitor/index.vue:82`
- `es-admin/apps/web-ele/src/views/message/monitor/index.vue:101`
- `es-admin/apps/web-ele/src/views/message/monitor/model/dispatch.ts:70`
- `es-admin/apps/web-ele/src/views/message/monitor/model/dispatch.ts:89`
- `es-admin/apps/web-ele/src/views/message/monitor/model/delivery.ts:83`
- `es-admin/apps/web-ele/src/views/message/monitor/model/delivery.ts:98`
- `apps/admin-api/src/modules/message/message-monitor.service.ts:193`
- `libs/message/src/notification/notification-delivery.service.ts:138`

问题：前端会传 `sorts`、`dateRange/startDate/endDate`，并在表格列上标注 sortable；dispatch 表单还定义了 `retryCount`、`nextRetryAt`、`processedAt`、`lastError`，delivery 表单定义了 `usedTemplate`、`templateId`、`notificationId`、`lastAttemptAt`、`failureReason`、`fallbackReason`。后端实际只处理部分字段，并硬编码 `updatedAt/id` 排序。

影响：运营或排障人员看到筛选/排序控件，以为结果已经被约束，实际可能没有生效，容易误判故障范围。

建议：后端实现受控筛选/排序 allowlist 并补匹配索引；暂不支持的字段从搜索区和 sortable 列移除。

### M-03 inbox timeline 使用 union + offset，历史用户翻页成本上升

证据：

- `libs/message/src/inbox/inbox.service.ts:198`
- `libs/message/src/inbox/inbox.service.ts:215`

问题：消息中心时间线对通知和聊天做 `UNION ALL` 后全局排序，再用 `LIMIT/OFFSET` 分页，同时还 count 通知与会话总数。

影响：用户历史通知和聊天会话多时，深翻页成本持续上升。

建议：改为 keyset pagination；通知和聊天两侧分别取 bounded candidates 后在应用层合并，或引入统一 inbox item 读模型表。

### M-04 通知模板分页前端传日期/排序，后端只按分类和启用状态查询

证据：

- `es-admin/apps/web-ele/src/views/message/notification-templates/index.vue:78`
- `es-admin/apps/web-ele/src/views/message/notification-templates/model/shared.ts:155`
- `libs/message/src/notification/dto/notification-template.dto.ts:65`
- `libs/message/src/notification/notification-template.service.ts:56`
- `libs/message/src/notification/notification-template.service.ts:69`

问题：通知模板列表前端传 `dateRange/startDate/endDate` 和 `sorts`，但后端 DTO 只声明 `categoryKey/isEnabled`，服务层也只按这两个字段过滤，并固定 `updatedAt desc, id asc` 排序。

影响：模板配置页的创建时间筛选和列排序实际不可用，运营无法按时间定位最近变更。

建议：实现日期和受控排序，或去掉对应 UI 能力。

## admin 运营友好度问题

### U-01 消息运行页更像技术监控，不适合普通运营独立排查

证据：

- `es-admin/apps/web-ele/src/views/message/monitor/model/shared.ts:7`
- `es-admin/apps/web-ele/src/views/message/monitor/model/shared.ts:13`
- `es-admin/apps/web-ele/src/views/message/monitor/model/shared.ts:14`
- `es-admin/apps/web-ele/src/views/message/monitor/model/shared.ts:22`
- `es-admin/apps/web-ele/src/views/message/monitor/model/dispatch.ts:12`
- `es-admin/apps/web-ele/src/views/message/monitor/model/delivery.ts:13`

问题：核心筛选和列大量依赖 `dispatchId`、`eventId`、`eventKey`、`domain`、`projectionKey`、`receiverUserId`、`templateId`、`notificationId`。这些字段是研发/日志/数据库排障线索，普通运营通常无法从用户反馈中拿到。

影响：运营拿到“某用户没收到某类通知”时，很难直接从页面定位；必须先找研发查 key/id，后台没有形成运营闭环。

建议：提供运营入口筛选：用户昵称/手机号/用户 ID 混合搜索、通知类型中文下拉、业务对象类型和对象标题/编号、时间范围、状态、是否使用模板。技术 key/id 放到高级筛选或详情中。

### U-02 通知类型有中文选项，但事件场景仍要求输入 eventKey

证据：

- `es-admin/apps/web-ele/src/views/message/monitor/model/delivery.ts:35`
- `es-admin/apps/web-ele/src/views/message/monitor/model/dispatch.ts:24`
- `libs/message/src/notification/dto/notification-delivery.dto.ts:46`

问题：delivery 页有“通知类型”中文下拉，但 dispatch 页和 delivery 页都保留 `eventKey` 文本输入。`eventKey` 示例是 `comment.replied`，运营不一定知道事件键。

影响：同一个业务问题要在“通知类型”和“通知触发场景”之间切换心智，且触发场景没有中文枚举或说明。

建议：把常见 `eventKey` 映射为“评论回复/评论点赞/公告发布/任务提醒”等中文选项；保留原始 `eventKey` 作为高级字段。

### U-03 通知模板配置有变量辅助，但缺少试渲染/预览，运营难判断最终文案

证据：

- `es-admin/apps/web-ele/src/views/message/notification-templates/index.vue:324`
- `es-admin/apps/web-ele/src/views/message/notification-templates/index.vue:337`
- `libs/message/src/notification/notification-template.service.ts:242`

问题：模板编辑页提供分类、默认模板和可点击变量，后端也有真实渲染逻辑，但 admin 没有“用示例数据预览标题/正文”或“测试渲染”入口。

影响：运营只能看 `{{actor.nickname}}` 这类占位符，无法确认最终 APP 文案是否自然、是否超长、变量缺失时是否会回退。

建议：增加 admin 试渲染接口或前端预览能力；按通知类型提供样例上下文，提交前展示最终标题/正文和可能的回退原因。

### U-04 模板表格/详情仍展示 key 和 ID，业务信息层级不够清晰

证据：

- `es-admin/apps/web-ele/src/views/message/notification-templates/index.vue:297`
- `es-admin/apps/web-ele/src/views/message/notification-templates/model/detail.ts:17`
- `es-admin/apps/web-ele/src/views/message/notification-templates/model/detail.ts:28`

问题：列表在通知分类下方展示 `categoryKey`，详情展示“模板 ID”和“分类 key”。这些对研发有用，但对运营主流程不是首要信息。

影响：页面视觉重心被技术标识占据，运营更关心“这个模板影响哪类通知、启用后用户看到什么、上次谁改了什么”。

建议：默认隐藏 key/id，放到“技术信息/高级信息”折叠区；主区展示中文分类、启用状态、最终文案预览、最近修改时间和审计人。

### U-05 admin 没有聊天会话运营/客服排查入口

证据：

- `es-admin/apps/web-ele/src/router/routes/modules/message-manager.ts:12`
- `es-admin/apps/web-ele/src/router/routes/modules/message-manager.ts:23`
- `apps/admin-api/src/modules/message/message.controller.ts:15`
- `apps/admin-api/src/modules/message/message-template.controller.ts:14`
- `es-admin/apps/web-ele/src/views` 中未找到消息聊天/会话管理页面

问题：当前 admin 消息模块只有“通知模板”和“消息运行”。聊天模块没有会话检索、用户维度排查、消息送达/已读排查或举报/风控联动入口。

影响：当用户反馈聊天消息丢失、未读数异常、媒体消息失败时，运营无法在后台自助定位，只能依赖研发查库或日志。

建议：补一个只读“聊天会话排查”页，支持按用户搜索会话、查看最近消息元信息、发送状态、未读/已读位置、媒体类型、失败原因；敏感正文按权限脱敏或默认不展示。

### U-06 通知模板删除缺少运营护栏

证据：

- `es-admin/apps/web-ele/src/views/message/notification-templates/index.vue:278`
- `es-admin/apps/web-ele/src/views/message/notification-templates/index.vue:256`
- `apps/admin-api/src/modules/message/message-template.controller.ts:99`
- `libs/message/src/notification/notification-template.service.ts:229`

问题：通知模板列表直接提供“删除”，确认文案只有“确认删除当前通知模板?”。后端硬删除模板，删除后通知主链路会回退到业务 fallback 文案。

影响：运营误删模板会改变线上通知展示效果，且确认前没有展示影响的通知分类、当前模板内容、回退效果或操作原因。

建议：普通运营优先只允许停用，不允许硬删除；删除动作单独权限控制，确认弹窗展示影响范围并要求填写原因。更稳妥的是改成软删除或版本化模板。

## 接口契约与字段边界问题

### C-01 生成类型普遍带 `[property: string]: any`

证据：

- `es-admin/apps/web-ele/src/api/types/message.d.ts:6`
- `es-admin/apps/web-ele/src/api/types/message.d.ts:79`
- `es-admin/apps/web-ele/src/api/types/message.d.ts:415`
- `es-app-v2/src/api/types/message/message.d.ts:6`
- `es-app-v2/src/api/types/message/message.d.ts:728`

问题：生成的 request/response 类型带 catch-all index signature，接口边界过松。

影响：前端可以传入后端不支持的字段，TypeScript 不会报警；也会掩盖后端返回了不该给字段的风险。

建议：收紧 OpenAPI 生成策略，移除 request DTO 的任意字段签名；对确需扩展的 payload 字段建立显式白名单。

### C-02 APP 聊天 bodyTokens 生成类型错误

证据：

- `libs/message/src/chat/dto/chat.dto.ts:519`
- `es-app-v2/src/api/types/message/message.d.ts:720`

问题：服务端 DTO 定义 `bodyTokens` 为 union array，但 app 生成类型变成 `TextToken | EmojiUnicodeToken | EmojiCustomTokenDto[]`。

影响：客户端渲染和校验可能按错误结构实现，后续维护容易出错。

建议：修正 OpenAPI schema/generator，使其生成 `Array<TextToken | EmojiUnicodeToken | EmojiCustomToken>`。

## 已确认的正向点

- app/admin HTTP 基础鉴权存在，消息 controller 未看到 `@Public` 暴露。
- WS auth 会校验 JWT access token 和 app 用户状态，发送/已读操作也会再校验状态。
- 聊天发送有事务、幂等键、`pg_advisory_xact_lock` 和 messageSeq 控制。
- 聊天媒体上传收口在 message domain，并限定聊天场景及 image/audio/video 类型。
- 通知模板有占位符 allowlist，能阻止任意上下文字段被模板读取。
- 通知模板 admin 表单提供中文分类下拉、默认模板和变量插入，相比直接填写 key 已有改善。

## 建议整改优先级

1. 先修业务闭环：APP 会话/通知动作持久化、admin 聊天排查入口。
2. 再修字段边界：移除 app `bizKey`、收紧 admin 原始错误和技术 key/id 暴露、拆分权限。
3. 再修性能：summary 聚合接口、monitor 查询索引/筛选、inbox timeline keyset。
4. 最后修运营体验：中文化事件场景、模板试渲染、隐藏高级技术字段、补筛选说明。

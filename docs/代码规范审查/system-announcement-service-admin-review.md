# 系统公告模块审查问题记录

审查日期：2026-06-08

审查范围：

- 后端 service：admin-api、app-api、`libs/app-content/src/announcement`
- 数据库：`app_announcement`、`app_announcement_read`、`app_announcement_notification_fanout_task`、`user_notification`
- 管理端：admin 系统公告页面、表单、筛选、详情、API 类型
- APP 对接：公告弹窗、系统通知列表、消息中心投影链路

最终结论：`REQUEST CHANGES`

架构状态：`BLOCK`

## 阻断问题

### H-01 公告撤回/删除事件可能被幂等键吞掉

证据：

- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:142`
- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:409`
- `libs/message/src/eventing/message-domain-event.publisher.ts:74`
- `libs/platform/src/modules/eventing/domain-event-publisher.service.ts:177`

问题：`announcement.published` 和 `announcement.unpublished` 使用同一个 `projectionKey`，而消息领域事件发布器默认用 `projectionKey` 作为幂等键，底层唯一键是 `domain + idempotencyKey`。发布后再取消发布/删除时，撤回事件可能被当作重复事件跳过。

影响：消息中心 `user_notification` 会残留已下线公告，业务闭环断裂。

建议：保持通知投影 `projectionKey` 不变，但显式传事件级幂等键，例如 `announcement:${eventKey}:${announcementId}:user:${receiverUserId}`。补“发布后取消发布必须删除通知”的回归测试。

### H-02 fanout 任务会永久停在 PROCESSING

证据：

- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:19`
- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:189`
- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:206`
- `libs/app-content/src/announcement/announcement-notification-fanout.worker.ts:11`

问题：可运行状态只包含 pending/failed，claim 后置为 processing，但没有 processing 超时回收、租约、心跳或 stale recovery。

影响：进程在处理过程中崩溃后，任务不会再次被消费，公告通知扇出中断。

建议：增加 processing 超时恢复，或复用现有 domain-event dispatch 的 stale recovery 模型。

### H-03 定时发布和自然过期没有 fanout 闭环

证据：

- `libs/app-content/src/announcement/announcement.service.ts:93`
- `libs/app-content/src/announcement/announcement.service.ts:280`
- `libs/app-content/src/announcement/announcement.service.ts:299`
- `libs/app-content/src/announcement/announcement.service.ts:319`
- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:377`
- `libs/app-content/src/announcement/announcement.constant.ts:71`
- `libs/app-content/src/announcement/announcement.service.ts:168`

问题：fanout 只在 create/update/status/delete 写入时入队，事件类型按入队当时的时间判断。未来 `publishStartTime` 到达时不会自动发布到消息中心，`publishEndTime` 自然过期时也不会自动撤回消息中心通知。

影响：APP 列表按当前时间动态可见，但消息中心通知不随时间窗口自动进入/退出，内容可见性与通知中心状态分裂。

建议：增加公告生命周期调度任务，按开始/结束时间扫描并幂等发布/撤回；或禁止“消息中心通知 + 未来发布时间”组合并在 DTO/admin 表单明确拦截。

### H-04 APP 公告平台可见性没有服务端强制

证据：

- `apps/app-api/src/modules/system/system.controller.ts:105`
- `libs/app-content/src/announcement/announcement.service.ts:139`
- `db/schema/app/app-announcement.ts:80`

问题：APP 公共接口只传 `publishedOnly: true`，平台过滤依赖调用方 query；服务端只有 `enablePlatform` 参数存在时才过滤。

影响：H5/小程序专属公告默认可能出现在 APP 端。

建议：APP API 从可信客户端上下文派生平台并强制过滤 `EnablePlatformEnum.APP`，不要让公开调用方决定默认平台边界。

### H-05 公告已读和浏览量业务闭环缺失

证据：

- `apps/app-api/src/modules/system/system.controller.ts:98`
- `db/schema/app/app-announcement-read.ts:16`
- `libs/app-content/src/announcement/announcement.service.ts:359`

问题：APP 侧只暴露公告分页，没有详情、标记已读、弹窗排除已读、浏览量自增入口。`app_announcement_read` 表和 `incrementViewCount()` 存在但没有实际闭环。

影响：管理端浏览量失真，弹窗/通知中心/公告列表的已读态无法统一。

建议：增加登录态详情和标记已读接口，写入 `app_announcement_read`，列表返回 `isRead/readAt` 或提供未读计数；详情或有效阅读行为调用浏览量自增。

### H-06 admin-api 和 app-api 隐式启动同一个 fanout worker

证据：

- `libs/app-content/src/announcement/announcement.module.ts:13`
- `apps/admin-api/src/modules/app-content/announcement/announcement.module.ts:6`
- `apps/app-api/src/modules/system/system.module.ts:19`
- `apps/admin-api/src/app.module.ts:53`
- `apps/app-api/src/app.module.ts:55`

问题：`AppAnnouncementModule` 同时注册业务 service 和 cron worker，admin-api 与 app-api 导入该模块后都会启动 fanout worker。

影响：查询能力和后台消费者绑定，运行边界不清，部署多个 API 实例时消费者数量不可控。

建议：拆分纯 service module 与 worker/runtime module，只在明确的后台 worker 进程中注册 cron。

## 数据库与性能问题

### M-01 fanout task 领取索引与查询排序不匹配

证据：

- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:189`
- `db/schema/app/app-announcement-notification-fanout-task.ts:52`

问题：查询按 `status IN (...) ORDER BY updatedAt ASC, id ASC LIMIT 1`，索引是 `(status, updatedAt DESC)`，且不含 `id`。

建议：建 `(status, updated_at ASC, id ASC)` 或 runnable partial index，例如只覆盖 pending/failed。

### M-02 fanout 用户扫描缺少匹配索引

证据：

- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:302`
- `db/schema/app/app-user.ts:137`
- `db/schema/app/app-user.ts:145`

问题：用户扫描条件为 `isEnabled=true AND deletedAt IS NULL AND id > cursor ORDER BY id LIMIT 200`，但用户表只有单列索引。

建议：增加 partial index `ON app_user(id) WHERE is_enabled = true AND deleted_at IS NULL`，或复合索引并用 EXPLAIN 验证。

### M-03 fanout/read 表迁移疑似缺失

证据：

- `db/schema/app/app-announcement-notification-fanout-task.ts:17`
- `db/schema/app/app-announcement-read.ts:16`
- 静态检索未在 `db/migration/**/migration.sql` 中找到对应 `CREATE TABLE`

问题：schema 定义存在，但可执行迁移疑似缺少建表 SQL。

影响：新环境按迁移重建时可能缺表，公告创建入队或已读写入失败。

建议：补迁移创建两张表及索引/check，并用空库迁移验证。

### M-04 公告表业务约束不完整

证据：

- `db/schema/app/app-announcement.ts:154`

问题：当前只看到 priority/platform/viewCount check，缺少公告类型、发布时间区间、弹窗背景位置等表级约束。

建议：补 `announcementType in (...)`、`publishStartTime <= publishEndTime`、`popupBackgroundPosition in (...)` 等约束。

### M-05 APP 公告分页返回全字段和完整 content

证据：

- `libs/app-content/src/announcement/announcement.service.ts:205`
- `apps/app-api/src/modules/system/system.controller.ts:98`

问题：分页查询使用 `select()` 全字段，APP 列表/弹窗依赖列表里的完整 `content`。公告内容较大时，列表接口和弹窗接口都会变重。

建议：拆分 APP 公共 list DTO 和 detail DTO，列表返回摘要、标题、展示字段；详情接口返回完整内容。

### M-06 首页弹窗只取默认第一页后前端排序，可能漏掉高优先级弹窗

证据：

- `libs/app-content/src/announcement/announcement.service.ts:201`
- `es-app-v2/src/components/oa-announcement-popup/oa-announcement-popup.vue:95`
- `es-app-v2/src/components/oa-announcement-popup/oa-announcement-popup.vue:103`

问题：服务端默认按 `id desc` 返回第一页，APP 弹窗只取 10 条后再按优先级排序。

影响：高优先级弹窗如果不在最新 10 条内，会被漏掉。

建议：服务端提供专用 popup 查询排序：已发布、窗口内、平台匹配、showAsPopup，再按置顶/优先级/开始时间/id 排序。

## 安全与代码规范问题

### M-07 公告 HTML 内容缺少服务端净化契约

证据：

- `libs/app-content/src/announcement/dto/announcement.dto.ts:31`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/detail.ts:181`

问题：`content` 原样入库返回，管理端详情按 HTML 渲染。

建议：服务端写入前做 HTML sanitize 白名单，或明确只允许安全富文本，并统一渲染层净化。

### L-01 摘要长度前后端不一致

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:289`
- `libs/app-content/src/announcement/dto/announcement.dto.ts:42`

问题：前端限制 200，后端 DTO/DB 允许 500。

建议：统一为 500，或统一收紧为 200。

## Admin 运营体验问题

### H-07 “实时公告”文案掩盖了消息中心通知开关

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:222`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/index.vue:362`
- `libs/app-content/src/announcement/announcement.constant.ts:54`

问题：admin 表单和列表只显示“实时公告”，但后端逻辑中 `isRealtime` 实际控制是否进入消息中心通知。

影响：运营人员可能误以为这是“立即展示”或“实时生效”，实际它会影响全量消息中心扇出。可能误发通知，也可能以为已通知用户但实际没有。

建议：改名为“同步到消息中心”或“消息中心通知”，增加 help 文案说明：开启后会在发布窗口内向用户消息中心生成系统公告通知；关闭/下线会撤回消息中心通知。

### H-08 发布时间帮助文案误导

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:242`
- `libs/app-content/src/announcement/announcement.service.ts:168`
- `apps/app-api/src/modules/system/system.controller.ts:105`

问题：admin 文案写“仅对首页展示的公告有效”，但服务端对 APP published-only 公告列表整体使用发布时间窗口过滤，不只是首页。

影响：运营可能配置错误，误判公告会在哪些入口展示。

建议：改成“控制 APP 公开公告列表、首页弹窗和消息中心通知的生效时间窗口；窗口外不展示/不通知”。

### H-09 发布成功不等于通知送达成功，admin 没有 fanout 状态

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/index.vue:271`
- `libs/app-content/src/announcement/announcement.service.ts:291`
- `db/schema/app/app-announcement-notification-fanout-task.ts:24`

问题：admin 点击发布后直接提示“发布成功”，但服务端只是写入公告并入队 fanout，真正扇出状态在任务表中，admin 不展示 queued/processing/success/failed/lastError。

影响：运营无法知道消息中心通知是否已经生成、失败还是卡住。

建议：实时公告详情/列表展示 fanout 状态；发布 toast 对实时公告改为“已提交发布，消息中心通知处理中”；失败时提供重试/错误提示。

### M-08 页面筛选总体不是 ID 友好问题，但降级体验有缺口

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/index.vue:88`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:365`

结论：正常情况下，跳转页面筛选是运营友好的，UI 用 `pageItem.name` 作为 label，`id` 只是提交值，运营不需要手输 ID。

问题：页面选项一次性加载前 500 条，没有失败/加载/空状态；失败或超过 500 条时表格 fallback 为 `-`，会隐藏已有 pageId 绑定。

建议：改为远程搜索/分页选择器，label 展示“页面名称 / 页面标题 / 路径”，加载失败时显示 `页面ID: ${pageId}` 或详情中的 `name/code/path`，不要静默显示 `-`。

### M-09 删除操作实际是下线，文案不准确

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/index.vue:331`
- `libs/app-content/src/announcement/announcement.service.ts:307`

问题：admin 操作写“删除”，确认文案也是删除，但后端实际将公告置为未发布并入队撤回。

影响：运营可能以为记录会永久删除，实际记录仍在。

建议：改成“下线”或“取消发布”；若需要真删除，另做删除能力并明确风险。

### M-10 弹窗配置未完整暴露给运营

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:262`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:272`
- `es-admin/apps/web-ele/src/api/types/announcement.d.ts:148`
- `libs/app-content/src/announcement/dto/announcement.dto.ts:94`

问题：API 支持 `popupBackgroundPosition`，payload 也转发，但表单只暴露“首页弹窗展示”和“弹窗背景”，没有背景位置选择。

影响：配置能力存在但运营不可操作。

建议：增加“弹窗背景位置”下拉，使用中文 label：居中、顶部居中、底部居中、左侧居中、右侧居中等，并在详情展示。

### M-11 筛选缺少运营高频状态

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:378`
- `es-admin/apps/web-ele/src/api/types/announcement.d.ts:31`
- `es-admin/apps/web-ele/src/api/types/announcement.d.ts:58`

问题：后端/API 支持 `isPublished`、`showAsPopup`，页面也展示发布/弹窗状态，但搜索 schema 未暴露发布状态、过期/待生效派生状态、首页弹窗筛选。

影响：运营无法快速找到已发布、未发布、已过期、待生效、首页弹窗公告。

建议：增加发布状态筛选，至少覆盖未发布、已发布、待生效、已过期；增加“首页弹窗展示”筛选。

### M-12 发布状态判断忽略开始时间

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:158`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/index.vue:291`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/index.vue:380`

问题：前端状态只看 `isPublished` 和 `publishEndTime`，忽略未来 `publishStartTime`。

影响：未来定时公告会显示“已发布”，运营会误以为用户已可见。

建议：增加“待生效/定时发布”状态，按钮和标签都使用同一状态函数。

### M-13 日期控件只提交日期，不提交具体时间

证据：

- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:244`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/model/shared.ts:247`
- `es-admin/apps/web-ele/src/views/app-manager/announcement/index.vue:157`

问题：`DatePicker` 使用 `daterange` 和 `YYYY-MM-DD`，运营无法配置具体生效时刻。

影响：如果业务需要“10:00 发布”这类常见运营场景，当前 UI 无法表达；同时后端 DTO 是 Date，语义不一致。

建议：改为 `datetimerange`，或明确按整日生效并在后端统一归一化开始/结束边界。

## 运营友好性结论

当前 admin 基础 CRUD 可用，枚举值和页面选择大多通过中文 label 呈现，没有要求运营直接输入 pageId/key。但它还不能算运营友好：

- 关键业务概念不清：`实时公告` 实际是消息中心通知开关。
- 生效范围不清：发布时间窗口不是“仅首页”，而是 APP 公告可见性和通知生命周期的一部分。
- 异步闭环不可见：发布成功不代表消息中心通知成功，admin 没有 fanout 状态。
- 高频筛选缺失：发布状态、待生效、已过期、首页弹窗不可筛。
- 降级体验不足：页面选项加载失败或超过 500 条时会隐藏绑定关系。

## 建议整改优先级

1. 先修阻断链路：事件幂等键、processing stale recovery、时间窗口 fanout 调度。
2. 补 APP 闭环：服务端平台过滤、详情/已读/浏览量接口、列表/detail DTO 拆分。
3. 补 admin 运营文案和筛选：实时公告改名、发布时间文案、发布状态筛选、弹窗筛选、待生效状态。
4. 暴露 fanout 状态：列表或详情展示 queued/processing/success/failed、lastError、finishedAt。
5. 优化数据库：fanout task 索引、用户扫描索引、缺失迁移、表级约束。
6. 完善弹窗配置：背景位置选择、详情展示、APP 端实际使用该配置。

## 验证记录

- 后端公告相关单测：独立审查线记录为 3 suites / 13 tests passed。
- 后端 `pnpm type-check`：超时，未取得完整诊断。
- 前端 typecheck：未成功，当前 Node `v16.20.2` / pnpm `8.15.9` 不满足项目要求 Node `^22.18.0 || ^24.0.0`、pnpm `>=11.0.0`。
- 本文档为审查记录，无代码修复。

# 消息通知模块专项审查报告

> 审查日期：2026-04-13  
> 审查对象：当前工作区代码（含未提交改动）  
> 审查方式：代码链路审查 + 业务语义审查 + 模块边界审查

## 1. 审查范围

本次不是只看 `libs/message`，而是按“通知触发源 -> 领域事件 -> 投影/投递 -> inbox 聚合 -> app/admin 入口”全链路审查，覆盖如下模块：

- `libs/message/src/chat/*`
- `libs/message/src/eventing/*`
- `libs/message/src/inbox/*`
- `libs/message/src/notification/*`
- `libs/message/src/outbox/*`
- `apps/app-api/src/modules/message/*`
- `apps/admin-api/src/modules/message/*`
- `apps/app-api/src/modules/user/user.service.ts`
- `libs/growth/src/task/*`
- `libs/app-content/src/announcement/*`
- `libs/interaction/src/comment/*`
- `libs/interaction/src/follow/*`
- `libs/interaction/src/mention/*`
- `libs/forum/src/topic/resolver/*`
- `db/schema/message/*`
- `db/schema/system/domain-event*.ts`

## 2. 总体结论

当前通知体系已经从旧 `message_outbox` 向领域事件分发迁移，但主链路还没有把“幂等、监控、读模型口径、运营操作入口”彻底闭环。最严重的问题不在单个 service 的代码风格，而在几个跨模块的业务契约没有对齐：

- 任务提醒的触发位置和投影幂等策略不匹配，正常访问读接口就可能持续制造重复领域事件。
- 通知失败状态没有被稳定沉淀到运营视图，管理端看到的“投递结果”并不是真实全量结果。
- inbox 摘要和时间线对“有效通知”的筛选口径不一致，用户端会看到不稳定结果。
- 公告 fanout 仍然跑在请求链路上，规模上来以后会同时拖垮时延和可靠性。

这组问题说明消息通知模块当前更接近“功能可跑”，还不是“业务和运维都可依赖”的状态。

## 3. 关键问题

### 3.1 [必须修复] 任务提醒链路不具备稳定幂等性，正常读请求和定时任务都会持续制造重复通知事件

**涉及文件**

- `libs/growth/src/task/task-execution.service.ts:56-79`
- `libs/growth/src/task/task.service.support.ts:1613-1656`
- `libs/growth/src/task/task-runtime.service.ts:54-119`
- `libs/message/src/eventing/notification-projection.service.ts:93-113`
- `db/schema/message/user-notification.ts:22-25`

**问题说明**

- `getAvailableTasks()` 在读接口中直接调用 `tryNotifyAvailableTasksFromPage()`，也就是用户每次打开“可领取任务”页面，都可能再次写入同一批任务提醒领域事件。
- `notifyExpiringSoonAssignments()` 的注释写着“每个 assignment 只会通过稳定 bizKey 提醒一次”，但实现并没有在发布前做任何去重判断，只是每小时扫一遍符合条件的 assignment 然后继续 `publish()`。
- 通知投影侧对 `append` 模式直接执行 `insert user_notification`，而 `user_notification` 又有 `(receiver_user_id, projection_key)` 唯一约束。这意味着重复领域事件不会被识别为“已投影”，而会在 consumer 侧撞唯一键。

**业务影响**

- 用户只是重复打开任务页，就会持续制造重复的 `task.reminder.available` 事件。
- 定时任务每轮都会重复制造 `task.reminder.expiring` 事件，和“只提醒一次”的业务承诺冲突。
- 重复事件进入 consumer 后会触发唯一约束异常，dispatch 被打成失败，运营侧看到的是“技术失败”，但根因其实是业务幂等设计缺失。
- 任务通知一旦开始积压，后续的对账、失败重试和状态筛选都会被污染。

**修复方案**

- 把“新任务可领提醒”从读链路挪到真正的状态迁移点，不要在 `page` 接口里发通知。
- 给任务提醒增加稳定的“是否已发布”事实源，至少做到“发布前判重”。
- `append` 投影必须改成显式幂等处理：命中同一 `projectionKey` 时要么直接视为成功，要么走幂等 upsert，而不是依赖数据库唯一键抛错。
- 补充覆盖以下场景的测试：
  - 同一用户重复打开可领取任务页，不应新增第二条同周期提醒。
  - 同一 assignment 重复命中过期扫描，不应新增第二条提醒。
  - consumer 重试同一 dispatch 时，应落到幂等成功，而不是报唯一键冲突。

### 3.2 [必须修复] 通知失败状态和运营监控口径失真，`FAILED/RETRYING` 基本不可见

**涉及文件**

- `libs/message/src/notification/notification-delivery.service.ts:59-100`
- `libs/message/src/eventing/notification-event.consumer.ts:245-315`
- `libs/message/src/eventing/message-domain-event-dispatch.worker.ts:32-49`
- `apps/admin-api/src/modules/message/message-monitor.service.ts:27-44`
- `libs/growth/src/task/task.service.support.ts:2175-2199`

**问题说明**

- `notification_delivery` 虽然定义了 `FAILED`、`RETRYING`、`SKIPPED_PREFERENCE` 等状态，但 `recordHandledDispatch()` 实际只会写两种结果：
  - `DELIVERED`
  - `SKIPPED_PREFERENCE`
- notification consumer 只有在 `applyCommand()`、实时推送、`getInboxSummary()` 都完成之后，才会调用 `recordHandledDispatch()`。也就是说，只要在这之前抛异常，这次失败就只会落在 `domain_event_dispatch`，不会出现在 `notification_delivery`。
- admin 侧“通知投递结果页”完全读 `notification_delivery`，而不是读 `domain_event_dispatch`。
- task 域又反过来拿 `notification_delivery.status` 做对账过滤，这样 `FAILED` / `RETRYING` 看起来被支持，实际上大概率查不到。

**业务影响**

- 运营后台看到的“通知投递结果”不是全量真实结果，很多真正失败的 dispatch 根本不会出现。
- task 对账里按 `notificationStatus` 查失败提醒会失真，排障价值不足。
- `unsupported_notification_event:*` 这种配置/代码错误，目前也会被映射成 `SKIPPED_PREFERENCE`，误导排障方向。

**修复方案**

- 明确“运营事实源”到底是 `domain_event_dispatch` 还是 `notification_delivery`，不要两张表混着承担失败语义。
- 如果保留 `notification_delivery`，就必须在 consumer 的 `try/catch/finally` 里把 `RETRYING/FAILED` 同步落表，并把真正的失败原因、skip 原因分类写清楚。
- `SKIPPED_PREFERENCE` 只能用于“用户偏好关闭”，不能把所有 `skip` 都塞到这个状态里。
- admin 监控页至少要补一个 `domain_event_dispatch` 维度的列表或摘要，否则现有“按 dispatchId 重试”入口缺少对应的查询事实源。

### 3.3 [必须修复] inbox 摘要和时间线没有按“有效通知”统一筛选，用户端会看到丢消息或页数据不足

**涉及文件**

- `libs/message/src/inbox/inbox.service.ts:31-72`
- `libs/message/src/inbox/inbox.service.ts:134-148`
- `libs/message/src/inbox/inbox.service.ts:166-205`

**问题说明**

- `getSummary()` 先按 `receiverUserId` 直接查最新一条通知，再在内存里判断这条是否过期。如果最新一条恰好已经过期，而更早一条仍然有效，`latestNotification` 就会被错误地返回为 `undefined`。
- `getTimeline()` 统计总数时使用了“有效通知”条件，但实际拉列表时只按 `receiverUserId` 取最新 `fetchTake` 条，再在内存中过滤过期数据。只要顶部堆了较多过期通知，真正有效的通知就可能被挡在 `fetchTake` 之后，导致：
  - `total` 显示还有数据；
  - `list` 却返回不满一页，甚至顺序不稳定。

**业务影响**

- 用户中心首页可能明明还有有效通知，却看不到“最新通知”卡片。
- inbox 时间线可能出现“总数大于当前可见数据”的错觉。
- 该问题会直接影响 app 端首页消息摘要、消息中心时间线和 WebSocket 推送后的汇总展示。

**修复方案**

- `getSummary()` 的 `latestNotification` 查询必须直接复用有效通知条件，不要先查再过滤。
- `getTimeline()` 的通知列表查询也要在 SQL 层应用有效通知条件，和 `notificationTotal` 保持同一口径。
- 抽出统一的 active notification where builder，避免 `MessageInboxService`、`MessageNotificationService`、`NotificationProjectionService` 三处分叉。
- 增加回归测试：
  - 最新通知已过期，但次新通知仍有效。
  - 前 30 条通知全部过期，第 31 条仍有效。

### 3.4 [必须修复] 聊天入口允许普通客户端发送 `SYSTEM` 消息，破坏消息信任边界

**涉及文件**

- `libs/message/src/chat/dto/chat.dto.ts:53-65`
- `libs/message/src/notification/notification-websocket.service.ts:543-560`
- `libs/message/src/chat/chat.service.ts:1376-1388`

**问题说明**

- `SendChatMessageDto` 直接把 `SYSTEM` 暴露给客户端入参。
- WebSocket 层 `isValidMessageType()` 把 `SYSTEM` 视为合法类型。
- chat service 的 `parseMessageType()` 也接受 `SYSTEM`。

**业务影响**

- 普通用户可以伪造系统消息，和真正平台/系统生成的消息混在同一私聊会话里。
- 一旦前端把 `SYSTEM` 消息做了特殊样式或更高信任展示，这会演变成明显的业务安全问题。

**修复方案**

- 面向客户端的发送入口只允许 `TEXT`、`IMAGE`。
- `SYSTEM` 应该保留给内部服务调用，单独暴露受控入口或内部方法，不对外开放 DTO。
- 增加接口级测试，明确断言客户端提交 `SYSTEM` 时返回 `400`。

### 3.5 [必须修复] 重要公告通知 fanout 跑在请求链路中，规模和可靠性都不可接受

**涉及文件**

- `libs/app-content/src/announcement/announcement.service.ts:341-408`
- `libs/app-content/src/announcement/announcement.service.ts:486-521`

**问题说明**

- 创建、更新、上下线公告后，服务会立即查询全部活跃用户，再逐个调用 `messageDomainEventPublisher.publish()`。
- 这段 fanout 在请求链路中串行执行，不是后台任务，也没有断点恢复。
- 一旦中途某一次 `publish()` 失败，外层 `try/catch` 会直接结束整轮 fanout，后续用户不会收到事件，也没有自动补偿。

**业务影响**

- 用户规模一大，公告发布/更新接口时延会线性放大。
- 同一轮 fanout 只要中途失败，就会出现“部分用户有通知，部分用户没有通知”的不一致状态。
- 这类问题很难靠人工定位，因为已经成功的那部分事件和失败后未执行的那部分事件混在一起。

**修复方案**

- 把公告 fanout 改成后台异步任务，不要在 admin 请求链路里逐用户发布。
- 引入稳定的 audience cursor / batch 任务表 / outbox 任务，让 fanout 支持分批执行和断点续跑。
- 每个用户-公告维度保留稳定幂等键，确保重试不会重复生成通知。
- 在运营监控里增加公告 fanout 进度和失败数量视图。

### 3.6 [建议修改] admin 模块重复声明模板服务 provider，导致模板缓存与运行时实例分叉

**涉及文件**

- `apps/admin-api/src/modules/message/message.module.ts:10-18`
- `libs/message/src/eventing/message-domain-event.module.ts:12-29`
- `libs/message/src/notification/notification-template.service.ts:32-39`

**问题说明**

- `MessageNotificationTemplateService` 内部维护了内存缓存。
- message 域 worker 通过 `MessageDomainEventModule -> MessageNotificationModule` 拿到一份实例。
- admin API 又在自己的 `MessageModule` 里直接把 `MessageNotificationTemplateService` 放进 `providers`，相当于再造了一份实例。

**业务影响**

- admin 更新模板后，只会即时失效当前 admin 实例里的缓存；worker 侧那一份缓存仍可能继续使用旧模板直到 TTL 到期。
- 这和项目规则里“业务能力应由 owner module 提供，而不是入口层直接拼 provider”也不一致。

**修复方案**

- 不要在 admin 模块里直接声明消息域 service provider。
- 抽一个不包含 gateway 的 `notification-core` / `notification-application` 模块，统一导出模板和投递相关 service。
- 模板缓存如果继续保留，至少要保证整个进程只有一份实例。

## 4. 其他观察

### 4.1 模板渲染元信息没有进入投递结果

`notification_delivery` 有 `templateId`、`usedTemplate`、`fallbackReason` 字段，但当前投影结果没有把模板渲染信息回传给 delivery 记录，`MessageNotificationDeliveryService` 也一直写死 `null/false`。这会削弱运营排障能力，建议和 3.2 一起修。

### 4.2 现有测试没有覆盖上述高风险场景

当前仓库里能看到的相关 spec 主要覆盖 DTO 校验、基础查询和部分 event handler，但没有覆盖以下高风险路径：

- 任务提醒重复发布 / consumer 重试幂等
- inbox 对过期通知的摘要与时间线口径
- 公告 fanout 的部分失败与断点恢复
- 客户端发送 `SYSTEM` 消息的拒绝路径
- delivery 与 dispatch 状态同步

## 5. 修复优先级建议

建议按以下顺序推进：

1. 先修 3.1 和 3.2，先把通知主链路从“会反复制造失败”拉回到可观测、可重试状态。
2. 再修 3.3 和 3.4，解决直接影响用户感知和信任边界的问题。
3. 然后处理 3.5，把公告 fanout 从请求链路迁出。
4. 最后处理 3.6 和 4.1，统一模块边界和监控细节。

## 6. 建议的验证清单

每个修复项完成后，至少补齐以下验证：

- `pnpm type-check`
- `pnpm test -- --runInBand --runTestsByPath libs/message/src/notification/notification.service.spec.ts libs/message/src/eventing/notification-event-consumer.spec.ts`
- `pnpm test -- --runInBand --runTestsByPath libs/app-content/src/announcement/announcement.service.spec.ts`
- `pnpm test -- --runInBand --runTestsByPath libs/growth/src/task/test/task-execution.service.spec.ts`
- `pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/mention/mention.service.spec.ts libs/forum/src/topic/forum-topic.service.spec.ts`

## 7. 本次审查附带验证记录

以下命令已在当前工作区执行，结果用于确认本次审查基线：

- `pnpm exec prettier --check docs/reviews/2026-04-13-message-notification-audit.md docs/superpowers/plans/2026-04-13-message-notification-remediation.md`
  - 结果：通过
- `pnpm type-check`
  - 结果：通过
- `pnpm test -- --runInBand --runTestsByPath libs/message/src/notification/notification.service.spec.ts libs/message/src/eventing/notification-event-consumer.spec.ts libs/app-content/src/announcement/announcement.service.spec.ts libs/growth/src/task/test/task-execution.service.spec.ts libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/mention/mention.service.spec.ts libs/interaction/src/comment/resolver/comment-like.resolver.spec.ts libs/interaction/src/follow/resolver/user-follow.resolver.spec.ts libs/forum/src/topic/forum-topic.service.spec.ts apps/app-api/src/modules/user/user.service.spec.ts`
  - 结果：10 个测试套件、37 个测试全部通过

## 8. 已落地结果（2026-04-13）

本次实现已按“无历史兼容层”原则完成以下收口：

- 已删除手动可领取任务提醒，不再保留 `task.reminder.available` 事件和 `task_available` 提醒类型。
- 已删除 legacy `message_outbox` 子系统、对应 schema/export，以及 admin `outbox` 监控入口。
- 已把通知主链路统一收口到 `domain_event` / `domain_event_dispatch` / `user_notification` / `notification_delivery`。
- 已新增 admin `dispatch` 监控分页，`delivery` 页面继续只表达业务投影结果。
- 已把模板命中信息（`templateId`、`usedTemplate`、`fallbackReason`）写入 `notification_delivery`。
- 已把重要公告 fanout 改为后台任务 + worker，不再在请求链路逐用户发布事件。
- 已删除聊天实时层旧别名方法，客户端发送入口也已禁止 `SYSTEM` 消息。

最新实现验证结果如下：

- `pnpm type-check`
  - 结果：通过
- `pnpm test -- --runInBand --runTestsByPath libs/growth/src/task/test/task-reminder-dedupe.spec.ts libs/growth/src/task/test/task-execution.service.spec.ts libs/message/src/eventing/notification-projection.service.spec.ts libs/message/src/eventing/message-domain-event-dispatch.worker.spec.ts libs/message/src/eventing/notification-event-consumer.spec.ts libs/message/src/notification/notification.service.spec.ts libs/message/src/inbox/inbox.service.spec.ts libs/message/src/chat/chat.service.spec.ts apps/app-api/src/modules/user/user.service.spec.ts apps/admin-api/src/modules/message/message.module.spec.ts apps/admin-api/src/modules/message/message-monitor.service.spec.ts libs/app-content/src/announcement/announcement.service.spec.ts libs/app-content/src/announcement/announcement-notification-fanout.service.spec.ts`
  - 结果：13 个测试套件、30 个测试全部通过

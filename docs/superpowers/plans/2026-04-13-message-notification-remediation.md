# 消息通知整改实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复消息通知链路中的幂等、监控、inbox 口径、公告 fanout 和聊天权限问题，使通知行为与业务语义一致，并让 admin 侧具备真实可用的排障视图。

**架构：** 以领域事件分发表为技术调度事实源，以 `user_notification` 为用户可见读模型，以 `notification_delivery` 为业务投影结果视图。整改分两层推进：先收口“事件只发一次 / consumer 可重试 / 失败可见”，再修复用户侧摘要口径和公告/聊天边界问题。消息域的 owner service 统一从消息域模块导出，admin/app 入口不再直接拼装跨域 provider。

**技术栈：** NestJS、Drizzle ORM、PostgreSQL、Jest

---

## 执行结果（2026-04-13）

- 已执行完成。
- 最终决策：手动可领取任务提醒直接删除，不再迁移到新的后台链路。
- 已删除 legacy `message_outbox` 和 admin `outbox` 监控入口。
- 已新增 admin `dispatch` 监控分页，并保留 `delivery` 结果页作为业务视图。
- 已把模板命中元信息写入 `notification_delivery`。
- 已把公告通知改为后台 fanout 任务 + worker。
- 已完成验证：
  - `pnpm type-check`
  - 13 个相关测试套件、30 个测试通过

### 任务 1：修复任务提醒的重复发布与通知投影幂等

**文件：**

- 修改：`D:/code/es/es-server/libs/growth/src/task/task-execution.service.ts`
- 修改：`D:/code/es/es-server/libs/growth/src/task/task.service.support.ts`
- 修改：`D:/code/es/es-server/libs/growth/src/task/task-runtime.service.ts`
- 修改：`D:/code/es/es-server/libs/message/src/eventing/notification-projection.service.ts`
- 测试：`D:/code/es/es-server/libs/growth/src/task/test/task-execution.service.spec.ts`
- 测试：`D:/code/es/es-server/libs/message/src/eventing/notification-event-consumer.spec.ts`

- [ ] **步骤 1：先补失败测试，锁住“重复触发不应重复落通知”语义**

```ts
it('重复打开可领取任务页时不会重复生成同一周期提醒', async () => {
  // 同一 user + task + cycle 连续调用两次 getAvailableTasks
  // 断言只保留一条稳定 projectionKey 的通知结果
})

it('重复消费同一 append 类通知 dispatch 时会按幂等成功处理', async () => {
  // 第一次消费成功后，再次消费同一 projectionKey
  // 断言不会抛唯一键冲突
})
```

- [ ] **步骤 2：把“新任务可领提醒”从读接口迁到真正的状态迁移点**

```ts
// task-execution.service.ts
// 删除 getAvailableTasks() 中的 tryNotifyAvailableTasksFromPage(...)
// 改为在任务首次进入可领取态时调用提醒发布逻辑
```

- [ ] **步骤 3：给 expiring/available/reward reminder 增加发布前判重或显式幂等处理**

```ts
// notification-projection.service.ts
if (command.mode === 'append') {
  const existing = await this.db.query.userNotification.findFirst({
    where: {
      receiverUserId: command.receiverUserId,
      projectionKey: command.projectionKey,
    },
  })
  if (existing) {
    return {
      action: 'append',
      receiverUserId: command.receiverUserId,
      projectionKey: command.projectionKey,
      notification: existing,
      // 额外标记为幂等命中
    }
  }
}
```

- [ ] **步骤 4：运行最小回归测试**

运行：

```bash
pnpm test -- --runInBand --runTestsByPath libs/growth/src/task/test/task-execution.service.spec.ts libs/message/src/eventing/notification-event-consumer.spec.ts
```

预期：新增幂等场景全部通过，且没有唯一键冲突相关失败。

### 任务 2：统一 dispatch 与 delivery 的失败语义，补齐 admin 监控事实源

**文件：**

- 修改：`D:/code/es/es-server/libs/message/src/eventing/notification-event.consumer.ts`
- 修改：`D:/code/es/es-server/libs/message/src/notification/notification-delivery.service.ts`
- 修改：`D:/code/es/es-server/apps/admin-api/src/modules/message/message-monitor.service.ts`
- 修改：`D:/code/es/es-server/apps/admin-api/src/modules/message/message.controller.ts`
- 修改：`D:/code/es/es-server/libs/message/src/monitor/dto/message-monitor.dto.ts`
- 修改：`D:/code/es/es-server/libs/message/src/notification/dto/notification.dto.ts`
- 测试：`D:/code/es/es-server/libs/message/src/eventing/notification-event-consumer.spec.ts`

- [ ] **步骤 1：补失败测试，锁住 `FAILED/RETRYING` 可见性**

```ts
it('notification consumer 失败时会把失败语义写入可查询视图', async () => {
  // 模拟 projection 或 summary 抛错
  // 断言 admin 查询能看到 FAILED / RETRYING 状态
})
```

- [ ] **步骤 2：重构 delivery 记录接口，区分成功、重试中、终态失败和偏好跳过**

```ts
// notification-delivery.service.ts
recordSucceededDispatch(...)
recordRetryingDispatch(...)
recordFailedDispatch(...)
recordSkippedDispatch(...)
```

- [ ] **步骤 3：在 consumer / worker 中显式落失败结果，而不是只依赖 dispatch 表**

```ts
try {
  const result = await this.notificationProjectionService.applyCommand(...)
  await this.messageNotificationDeliveryService.recordSucceededDispatch(...)
  await this.domainEventDispatchService.markDispatchSucceeded(...)
} catch (error) {
  await this.messageNotificationDeliveryService.recordRetryingOrFailedDispatch(...)
  throw error
}
```

- [ ] **步骤 4：admin 监控补齐 dispatch 维度查询或摘要**

运行：

```bash
pnpm test -- --runInBand --runTestsByPath libs/message/src/eventing/notification-event-consumer.spec.ts
```

预期：失败、重试、偏好跳过可以被区分，admin 端能查到真实状态。

### 任务 3：修复 inbox 摘要与时间线的有效通知筛选口径

**文件：**

- 修改：`D:/code/es/es-server/libs/message/src/inbox/inbox.service.ts`
- 修改：`D:/code/es/es-server/libs/message/src/notification/notification.service.ts`
- 测试：`D:/code/es/es-server/libs/message/src/notification/notification.service.spec.ts`
- 测试：`D:/code/es/es-server/apps/app-api/src/modules/user/user.service.spec.ts`

- [ ] **步骤 1：补失败测试，覆盖“最新通知已过期”的摘要场景**

```ts
it('getSummary 会回退到最近一条仍有效的通知', async () => {
  // 最新一条 expiresAt 已过期，次新一条仍有效
  // 断言 latestNotification 返回次新有效通知
})

it('getTimeline 只按有效通知分页，不会因为过期通知堆积而少页', async () => {
  // 前 N 条均为过期通知，后面有有效通知
  // 断言 list 和 total 口径一致
})
```

- [ ] **步骤 2：抽出统一的 active notification where helper**

```ts
private buildActiveNotificationWhere(userId: number, now = new Date()) {
  return and(
    eq(this.notification.receiverUserId, userId),
    or(isNull(this.notification.expiresAt), gt(this.notification.expiresAt, now)),
  )
}
```

- [ ] **步骤 3：所有 summary / timeline 通知查询都改用同一 SQL 条件**

运行：

```bash
pnpm test -- --runInBand --runTestsByPath libs/message/src/notification/notification.service.spec.ts apps/app-api/src/modules/user/user.service.spec.ts
```

预期：摘要、未读数、时间线总数与列表结果一致。

### 任务 4：把重要公告 fanout 从请求链路迁到后台异步执行

**文件：**

- 修改：`D:/code/es/es-server/libs/app-content/src/announcement/announcement.service.ts`
- 修改：`D:/code/es/es-server/libs/message/src/eventing/message-event.type.ts`
- 修改：`D:/code/es/es-server/libs/message/src/eventing/message-domain-event.publisher.ts`
- 新增或修改：`D:/code/es/es-server/libs/app-content/src/announcement/*fanout*.ts`
- 测试：`D:/code/es/es-server/libs/app-content/src/announcement/announcement.service.spec.ts`

- [ ] **步骤 1：补失败测试，锁住“部分失败可续跑”语义**

```ts
it('公告 fanout 失败后不会丢失尚未处理的用户', async () => {
  // 模拟第 3 个 receiver 发布失败
  // 断言剩余 receiver 仍可被后续任务继续处理
})
```

- [ ] **步骤 2：把公告发布动作改为写入 fanout 任务，而不是在请求里逐用户循环**

```ts
// announcement.service.ts
await this.enqueueAnnouncementNotificationFanout({
  announcementId,
  eventKey,
})
```

- [ ] **步骤 3：实现可分批、可重试、按用户幂等的 fanout worker**

```ts
// 每批只处理固定数量 receiver
// 每个 receiver + announcementId 使用稳定 projectionKey
// 失败后保留 cursor 供后续续跑
```

- [ ] **步骤 4：运行公告相关测试**

运行：

```bash
pnpm test -- --runInBand --runTestsByPath libs/app-content/src/announcement/announcement.service.spec.ts
```

预期：公告写请求不再承担全量 fanout，失败具备恢复能力。

### 任务 5：收紧聊天客户端协议，禁止客户端发送 `SYSTEM` 消息

**文件：**

- 修改：`D:/code/es/es-server/libs/message/src/chat/dto/chat.dto.ts`
- 修改：`D:/code/es/es-server/libs/message/src/notification/notification-websocket.service.ts`
- 修改：`D:/code/es/es-server/libs/message/src/chat/chat.service.ts`
- 测试：`D:/code/es/es-server/libs/message/src/eventing/chat-realtime-event.consumer.spec.ts`
- 测试：补充 `chat.service` 或 websocket 层 spec

- [ ] **步骤 1：补失败测试**

```ts
it('客户端发送 SYSTEM 消息类型时返回 400', async () => {
  // messageType = 3
  // 断言 ack.code 为 bad request 对应平台码
})
```

- [ ] **步骤 2：从 DTO 和 websocket 校验中去掉 `SYSTEM`**

```ts
// chat.dto.ts
description: '消息类型（1=文本；2=图片）'

// notification-websocket.service.ts
return value === ChatMessageTypeEnum.TEXT || value === ChatMessageTypeEnum.IMAGE
```

- [ ] **步骤 3：chat.service 内部校验同样收紧，只允许公开入口消费文本/图片**

运行：

```bash
pnpm test -- --runInBand --runTestsByPath libs/message/src/eventing/chat-realtime-event.consumer.spec.ts
```

预期：客户端协议只接受文本/图片，系统消息只能走内部受控路径。

### 任务 6：修复模板服务实例分叉，并把模板命中信息带入 delivery 结果

**文件：**

- 修改：`D:/code/es/es-server/apps/admin-api/src/modules/message/message.module.ts`
- 修改：`D:/code/es/es-server/libs/message/src/notification/notification.module.ts`
- 修改：`D:/code/es/es-server/libs/message/src/notification/notification-template.service.ts`
- 修改：`D:/code/es/es-server/libs/message/src/eventing/notification-projection.service.ts`
- 修改：`D:/code/es/es-server/libs/message/src/notification/notification-delivery.service.ts`
- 测试：`D:/code/es/es-server/libs/message/src/eventing/notification-event-consumer.spec.ts`

- [ ] **步骤 1：调整模块边界，避免 admin 入口层直接 new 一份模板服务**

```ts
// 提取只包含 template/delivery provider 的 owner module
// admin-api 与 worker 都从该 owner module 获取同一份 provider
```

- [ ] **步骤 2：扩展 projection apply result，把模板渲染元信息回传给 delivery**

```ts
type NotificationProjectionApplyResult = {
  action: 'append' | 'upsert' | 'delete' | 'skip'
  templateId?: number
  usedTemplate?: boolean
  fallbackReason?: string
}
```

- [ ] **步骤 3：delivery 落表时持久化 `templateId / usedTemplate / fallbackReason`**

运行：

```bash
pnpm test -- --runInBand --runTestsByPath libs/message/src/eventing/notification-event-consumer.spec.ts
```

预期：模板更新后的缓存行为一致，运营能看到模板是否命中与回退原因。

### 任务 7：全链路回归与基线验证

**文件：**

- 无新增业务文件
- 验证：`D:/code/es/es-server/docs/reviews/2026-04-13-message-notification-audit.md`
- 验证：`D:/code/es/es-server/docs/superpowers/plans/2026-04-13-message-notification-remediation.md`

- [ ] **步骤 1：运行类型检查**

```bash
pnpm type-check
```

- [ ] **步骤 2：运行本次整改关联测试**

```bash
pnpm test -- --runInBand --runTestsByPath libs/message/src/notification/notification.service.spec.ts libs/message/src/eventing/notification-event-consumer.spec.ts libs/message/src/eventing/chat-realtime-event.consumer.spec.ts libs/app-content/src/announcement/announcement.service.spec.ts libs/growth/src/task/test/task-execution.service.spec.ts libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/mention/mention.service.spec.ts libs/forum/src/topic/forum-topic.service.spec.ts
```

- [ ] **步骤 3：校验文档格式**

```bash
pnpm exec prettier --check docs/reviews/2026-04-13-message-notification-audit.md docs/superpowers/plans/2026-04-13-message-notification-remediation.md
```

- [ ] **步骤 4：逐项回看审查报告中的 6 个核心问题，确认都有对应改动与验证证据**

计划执行完成后，不要直接口头宣布“已完成”，先把上述命令的最新输出作为证据补到交付说明中。

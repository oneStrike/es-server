# 消息通知模块梳理（当前代码事实版）

## 1. 结论速览

- 当前消息通知模块以 `libs/message` 为中心，producer 分散在评论/提及/关注/论坛/公告/任务域，统一汇入消息域事件后投影到 `user_notification`。
- 当前共有 **10 种通知类型**，由 **13 个通知相关领域事件**驱动：
  - 8 个“一类事件对应一类通知”
  - 2 个公告事件共同驱动 `system_announcement`
  - 3 个任务提醒事件共同驱动 `task_reminder`
- App 侧对外通知接口是 `GET app/message/notification/page`，对外通知对象的事实源是：
  - `libs/message/src/notification/notification-contract.type.ts`
  - `libs/message/src/notification/dto/notification.dto.ts`
  - `apps/app-api/src/modules/message/message.controller.ts`
- `system_announcement` 是唯一 **mandatory** 通知类型，不受用户偏好关闭影响；其他类型都受通知偏好控制，且当前默认全部开启。

## 2. 模块边界与链路

### 2.1 关键模块

- `libs/message/src/eventing/message-event.constant.ts`
  - 定义“领域事件 -> 通知类型 -> projectionMode -> mandatory”的映射。
- `libs/message/src/eventing/message-domain-event.factory.ts`
  - 负责评论、提及、点赞、关注、主题互动类通知事件的 payload 组装。
- `libs/growth/src/task/task-notification.service.ts`
  - 负责任务提醒类通知事件的 payload 与文案组装。
- `libs/app-content/src/announcement/announcement-notification-fanout.service.ts`
  - 负责系统公告 fanout，向所有目标用户发布 `announcement.published` / `announcement.unpublished`。
- `libs/message/src/eventing/notification-event.consumer.ts`
  - 把领域事件转成通知投影命令。
- `libs/message/src/eventing/notification-projection.service.ts`
  - 负责偏好判断、payload 规范化/补全、模板渲染、落库 `user_notification`。
- `libs/message/src/notification/notification.service.ts`
  - 负责列表查询、未读数、标记已读。
- `libs/message/src/notification/notification-template.service.ts`
  - 负责通知模板渲染。
- `libs/message/src/notification/notification-preference.service.ts`
  - 负责用户通知偏好。
- `libs/message/src/notification/notification-delivery.service.ts`
  - 记录 notification consumer 对 dispatch 的处理结果。
- `libs/message/src/notification/notification-realtime.service.ts`
  - 负责 websocket/实时同步。

### 2.2 数据表

- `user_notification`
  - 用户可见通知读模型表。
- `notification_template`
  - 通知模板表。
- `notification_preference`
  - 用户通知偏好表。
- `notification_delivery`
  - 通知 consumer 处理结果表。

### 2.3 实际链路

1. 上游业务域产生消息相关动作。
2. Producer 组装消息域领域事件：
   - 评论/主题/关注：`MessageDomainEventFactoryService`
   - 任务提醒：`TaskNotificationService`
   - 系统公告：`AnnouncementNotificationFanoutService`
3. `NotificationEventConsumer` 根据 `eventKey` 生成投影命令。
4. `NotificationProjectionService` 执行：
   - mandatory/偏好判断
   - payload 规范化与必要补全
   - 模板渲染
   - 落库 `user_notification`
5. `MessageNotificationService` 查询列表并映射为 App 对外结构。
6. `MessageNotificationRealtimeService` 推送创建、更新、删除、已读与 inbox 摘要同步。

## 3. 通知类型总表

| 通知类型              | 中文标签 | 来源领域事件                                                                              | projectionMode      | mandatory | 当前 `data` 结构                               |
| --------------------- | -------- | ----------------------------------------------------------------------------------------- | ------------------- | --------- | ---------------------------------------------- |
| `comment_reply`       | 评论回复 | `comment.replied`                                                                         | `append`            | 否        | `NotificationCommentActionData`                |
| `comment_mention`     | 评论提及 | `comment.mentioned`                                                                       | `append`            | 否        | `NotificationCommentActionData`                |
| `comment_like`        | 评论点赞 | `comment.liked`                                                                           | `append`            | 否        | `NotificationCommentActionData`                |
| `topic_like`          | 主题点赞 | `topic.liked`                                                                             | `append`            | 否        | `{ object: NotificationTopicSnapshot }`        |
| `topic_favorited`     | 主题收藏 | `topic.favorited`                                                                         | `append`            | 否        | `{ object: NotificationTopicSnapshot }`        |
| `topic_commented`     | 主题评论 | `topic.commented`                                                                         | `append`            | 否        | `NotificationTopicCommentedData`               |
| `topic_mentioned`     | 主题提及 | `topic.mentioned`                                                                         | `append`            | 否        | `{ object: NotificationTopicSnapshot }`        |
| `user_followed`       | 用户关注 | `user.followed`                                                                           | `append`            | 否        | `null`                                         |
| `system_announcement` | 系统公告 | `announcement.published` / `announcement.unpublished`                                     | `upsert` / `delete` | 是        | `{ object: NotificationAnnouncementSnapshot }` |
| `task_reminder`       | 任务提醒 | `task.reminder.auto_assigned` / `task.reminder.expiring` / `task.reminder.reward_granted` | `append`            | 否        | `NotificationTaskReminderData`                 |

说明：

- 通知类型是对外 `type`，不是底层 `eventKey`。
- `system_announcement` 只有一个通知类型，但发布和下线分别由两个事件控制：
  - `announcement.published`：创建或覆盖通知
  - `announcement.unpublished`：删除通知
- `task_reminder` 只有一个通知类型，但内部再细分 3 种提醒子类型：
  - `auto_assigned`
  - `expiring_soon`
  - `reward_granted`

## 4. 对外顶层通知对象

### 4.1 当前对外结构

```ts
type MessageNotificationPublicView = {
  id: number
  type: MessageNotificationCategoryKey
  actor?: {
    id: number
    nickname?: string
    avatarUrl?: string
  }
  message: {
    title: string
    body: string
  }
  data: MessageNotificationData | null
  isRead: boolean
  readAt?: Date
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

### 4.2 顶层字段说明

| 字段            | 含义                   | 来源/备注                                                                        |
| --------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `id`            | 通知读模型主键 ID      | 来自 `user_notification.id`                                                      |
| `type`          | 通知类型键             | 来自 `user_notification.categoryKey`，对外改名为 `type`                          |
| `actor`         | 触发这条通知的用户信息 | 不是从 `payload` 冻结出来的，而是查询时根据 `actorUserId` 动态 join `appUser`    |
| `message.title` | 最终展示标题           | 来自 `user_notification.title`；先尝试命中模板渲染，失败时回退事件上下文标题     |
| `message.body`  | 最终展示正文           | 来自 `user_notification.content`；先尝试命中模板渲染，失败时回退事件上下文正文   |
| `data`          | 结构化业务事实         | 来自 `user_notification.payload`；不同 `type` 对应不同结构                       |
| `isRead`        | 是否已读               | 来自 `user_notification.isRead`                                                  |
| `readAt`        | 已读时间               | 来自 `user_notification.readAt`                                                  |
| `expiresAt`     | 过期时间               | 来自 `user_notification.expiresAt`；列表查询只返回 `null` 或“大于当前时间”的记录 |
| `createdAt`     | 通知创建时间           | 来自 `user_notification.createdAt`                                               |
| `updatedAt`     | 通知更新时间           | 来自 `user_notification.updatedAt`                                               |

补充说明：

- TypeScript 类型里是 `Date`，但 API 序列化到 JSON 后会表现为 ISO 时间字符串。
- `actor` 可能不存在，典型场景：
  - 系统公告没有 actor
  - 任务提醒没有 actor
  - 有 `actorUserId` 但动态 join 未查到用户记录时，`actor` 也会被省略

### 4.3 数据库存储到 API 的映射

| 存储层                                         | 对外层          |
| ---------------------------------------------- | --------------- |
| `user_notification.categoryKey`                | `type`          |
| `user_notification.title`                      | `message.title` |
| `user_notification.content`                    | `message.body`  |
| `user_notification.payload`                    | `data`          |
| `user_notification.actorUserId + appUser join` | `actor`         |

## 5. 共享结构与字段语义

### 5.1 `NotificationUserSnapshot`

```ts
{
  id: number
  nickname?: string
  avatarUrl?: string
}
```

- `id`
  - 触发用户 ID。
  - 当前实现来自 `actorUserId -> appUser.id`。
- `nickname`
  - 触发用户昵称。
  - 当前实现是**读取时动态值**，不是冻结在通知 payload 里的历史昵称。
- `avatarUrl`
  - 触发用户头像地址。
  - 同样是读取时动态值。

### 5.2 `NotificationMessageBlock`

```ts
{
  title: string
  body: string
}
```

- `title`
  - 通知列表/详情要展示的标题。
- `body`
  - 通知列表/详情要展示的正文。

说明：

- 两者都是“最终展示文案”。
- 当前模板渲染优先读取 `notification_template` 中的启用模板。
- 如果模板缺失、关闭或渲染失败，则回退到事件上下文中的 `title` / `content`。

### 5.3 `NotificationCommentSnapshot`

```ts
{
  kind: 'comment'
  id: number
  snippet?: string
}
```

- `kind`
  - 固定为 `'comment'`，用于判别联合类型。
- `id`
  - 评论 ID。
- `snippet`
  - 评论摘要/评论正文片段。
  - 对 `comment_reply` / `comment_mention` / `comment_like`：
    - 如果 producer 未填，projection 会尝试从 `userComment.content` 回填。
  - 对 `topic_commented`：
    - 当前主要依赖 producer 在事件创建时直接写入。

### 5.4 `NotificationTopicSnapshot`

```ts
{
  kind: 'topic'
  id: number
  title?: string
  cover?: string
  sectionId?: number
}
```

- `kind`
  - 固定为 `'topic'`。
- `id`
  - 主题 ID。
- `title`
  - 主题标题。
- `cover`
  - 主题封面；如果需要从论坛主题回填，当前 comment 类 projection 会优先取 `forumTopic.images` 的第一张。
- `sectionId`
  - 论坛板块 ID。

实现注意：

- 类型允许 `cover` / `sectionId`。
- 但 `topic_like`、`topic_favorited`、`topic_mentioned`、`topic_commented` 的当前 producer 不会主动补齐这两个字段，projection 也不会为这些类型做 topic snapshot 回填。
- 所以对“当前新生成数据”来说，这几个字段通常只保证 `kind/id/title`。

### 5.5 `NotificationWorkSnapshot`

```ts
{
  kind: 'work'
  id: number
  title?: string
  cover?: string
  workType?: number
}
```

- `kind`
  - 固定为 `'work'`。
- `id`
  - 作品 ID。
- `title`
  - 作品标题；当前 projection 会从 `work.name` 回填。
- `cover`
  - 作品封面；当前 projection 会从 `work.cover` 回填。
- `workType`
  - 作品类型。
  - 当前值域：
    - `1=漫画`
    - `2=小说`

### 5.6 `NotificationChapterSnapshot`

```ts
{
  kind: 'chapter'
  id: number
  title?: string
  subtitle?: string
  cover?: string
  workId?: number
  workType?: number
}
```

- `kind`
  - 固定为 `'chapter'`。
- `id`
  - 章节 ID。
- `title`
  - 章节标题。
- `subtitle`
  - 章节副标题。
- `cover`
  - 章节封面；如果章节自身没有，当前 projection 还会尝试用所属作品封面兜底。
- `workId`
  - 所属作品 ID。
- `workType`
  - 所属作品类型：
    - `1=漫画`
    - `2=小说`

### 5.7 `NotificationAnnouncementSnapshot`

```ts
{
  kind: 'announcement'
  id: number
  title?: string
  summary?: string
  announcementType?: number
  priorityLevel?: number
}
```

- `kind`
  - 固定为 `'announcement'`。
- `id`
  - 公告 ID。
- `title`
  - 公告标题。
- `summary`
  - 当前写入通知 payload 的“公告摘要文本”。
  - 注意：它不是强保证等于公告表原始 `summary` 字段。
  - 当前实现逻辑是：
    - 优先取公告 `summary`
    - 否则取公告 `content`
    - 再否则回退默认文案
    - 最后截断到 180 字以内
- `announcementType`
  - 公告类型：
    - `0=平台公告`
    - `1=活动公告`
    - `2=维护公告`
    - `3=更新公告`
    - `4=政策公告`
- `priorityLevel`
  - 公告优先级：
    - `0=低`
    - `1=中`
    - `2=高`
    - `3=紧急`

### 5.8 `NotificationTaskSnapshot`

```ts
{
  kind: 'task'
  id: number
  code?: string
  title?: string
  cover?: string
  sceneType?: number
}
```

- `kind`
  - 固定为 `'task'`。
- `id`
  - 任务 ID。
- `code`
  - 任务业务编码。
  - 当前实现中如果上游任务没有 `code`，会回退为 `task-${id}`。
- `title`
  - 任务标题。
- `cover`
  - 任务封面。
  - 类型上允许，但当前 `TaskNotificationService` 不会主动填这个字段。
- `sceneType`
  - 任务场景类型，当前来自 `normalizeTaskType(task.type)`：
    - `1=新手引导任务`
    - `2=日常任务`
    - `4=活动/运营任务`
  - 如果原始类型为空或不在允许范围内，会被归一化成 `1`。

### 5.9 `NotificationTaskReminderInfo`

```ts
{
  kind: 'auto_assigned' | 'expiring_soon' | 'reward_granted'
  assignmentId?: number
  cycleKey?: string
  expiredAt?: string
}
```

- `kind`
  - 任务提醒子类型：
    - `auto_assigned`：任务已自动分配给当前用户
    - `expiring_soon`：任务将在 24 小时内过期
    - `reward_granted`：任务奖励已到账
- `assignmentId`
  - 当前用户对应的任务领取/分配记录 ID。
- `cycleKey`
  - 周期任务的业务周期标识；仅在上游提供时出现。
- `expiredAt`
  - 任务过期时间，ISO 字符串。
  - 当前主要用于 `expiring_soon`。

### 5.10 `NotificationTaskRewardSnapshot`

```ts
{
  items: Array<{
    assetType: 1 | 2 | 3 | 4 | 5
    amount: number
  }>
  ledgerRecordIds: number[]
}
```

- `items`
  - 奖励项列表。
- `items[].assetType`
  - 奖励资产类型：
    - `1=积分`
    - `2=经验`
    - `3=道具`
    - `4=虚拟货币`
    - `5=等级`
- `items[].amount`
  - 本次到账数量。
  - 当前 producer 会过滤掉 `amount <= 0` 的奖励项。
- `ledgerRecordIds`
  - 与本次奖励落账相关的 ledger 记录 ID 列表。

## 6. 每种通知类型的数据结构与字段说明

### 6.1 `comment_reply`

来源事件：`comment.replied`

```ts
data = {
  object: NotificationCommentSnapshot
  container: NotificationWorkSnapshot | NotificationChapterSnapshot | NotificationTopicSnapshot
  parentContainer?: NotificationWorkSnapshot
}
```

- `object`
  - 被回复后的那条评论快照。
  - `snippet` 表示“回复内容摘要”。
- `container`
  - 该评论直接挂载的目标对象。
  - 可能是作品、章节或论坛主题。
- `parentContainer`
  - 只在 `container.kind === 'chapter'` 时有意义。
  - 表示该章节所属作品，用于补齐“章节 -> 作品”的跳转信息。

当前实现细节：

- producer 先写基础结构。
- projection 会对这类评论动作通知做补全：
  - `object.snippet` 可从评论表回填
  - `container` 可从 `work` / `workChapter` / `forumTopic` 回填更多快照字段
  - 章节场景会自动补出 `parentContainer`

### 6.2 `comment_mention`

来源事件：`comment.mentioned`

```ts
data = {
  object: NotificationCommentSnapshot
  container: NotificationWorkSnapshot | NotificationChapterSnapshot | NotificationTopicSnapshot
  parentContainer?: NotificationWorkSnapshot
}
```

- `object`
  - 包含 @ 提及用户的那条评论快照。
- `container`
  - 该评论所在的直接容器。
- `parentContainer`
  - 章节场景下的上级作品。

实现语义与 `comment_reply` 基本一致，只是业务含义变成“在评论中提到了你”。

### 6.3 `comment_like`

来源事件：`comment.liked`

```ts
data = {
  object: NotificationCommentSnapshot
  container: NotificationWorkSnapshot | NotificationChapterSnapshot | NotificationTopicSnapshot
  parentContainer?: NotificationWorkSnapshot
}
```

- `object`
  - 被点赞的评论快照。
  - 这是当前合同相对旧版最重要的增强点：现在会尽量把评论摘要也带出来。
- `container`
  - 被点赞评论所在的直接目标对象。
- `parentContainer`
  - 章节场景下的作品快照。

当前实现细节：

- `MessageDomainEventFactoryService` 会先把 `object.kind/id/snippet` 和 `container.kind/id` 写入 payload。
- `NotificationProjectionService` 再负责补全作品/章节/主题容器字段。

### 6.4 `topic_like`

来源事件：`topic.liked`

```ts
data = {
  object: NotificationTopicSnapshot,
}
```

- `object.kind`
  - 固定为 `'topic'`。
- `object.id`
  - 被点赞主题 ID。
- `object.title`
  - 被点赞主题标题。
- `object.cover`
  - 类型允许，但当前 producer 不填，projection 也不会为本类型补齐。
- `object.sectionId`
  - 类型允许，但当前 producer 不填，projection 也不会为本类型补齐。

### 6.5 `topic_favorited`

来源事件：`topic.favorited`

```ts
data = {
  object: NotificationTopicSnapshot,
}
```

- `object`
  - 被收藏主题的快照。
- 字段语义与 `topic_like` 一致。

### 6.6 `topic_commented`

来源事件：`topic.commented`

```ts
data = {
  object: NotificationCommentSnapshot
  container: NotificationTopicSnapshot
}
```

- `object`
  - 评论快照。
  - `snippet` 表示评论摘要。
- `container`
  - 被评论的主题快照。
  - 当前新生成数据通常保证 `kind/id/title`。

实现注意：

- 这个类型虽然也带 `comment` 与 `topic`，但**不走** `comment_reply/comment_mention/comment_like` 那套 projection 补全逻辑。
- 也就是说：
  - `object.snippet` 主要依赖 producer 在发事件时直接写入
  - `container.cover` / `sectionId` 当前不会自动补齐

### 6.7 `topic_mentioned`

来源事件：`topic.mentioned`

```ts
data = {
  object: NotificationTopicSnapshot,
}
```

- `object`
  - 提及用户的主题快照。
- 当前实现通常只保证：
  - `kind`
  - `id`
  - `title`

### 6.8 `user_followed`

来源事件：`user.followed`

```ts
data = null
```

- `data`
  - 固定为 `null`。
- 这类通知的结构化事实不再重复塞一份“被关注用户对象”。
- 触发人信息统一只从顶层 `actor` 读取。

实现注意：

- `MessageDomainEventFactoryService` 显式把 follow 通知的 `payload` 写成 `null`。
- `NotificationEventConsumer` 也保留了这个 `null`，不会额外转换成空对象。

### 6.9 `system_announcement`

来源事件：

- `announcement.published`
- `announcement.unpublished`

对外通知只在“发布态”存在，下线事件会删除对应通知。

```ts
data = {
  object: NotificationAnnouncementSnapshot,
}
```

- `object.id`
  - 公告 ID。
- `object.title`
  - 公告标题。
- `object.summary`
  - 通知中心要展示的公告摘要文本。
  - 当前来自 `summary || content || 默认文案` 后再截断到 180 字。
- `object.announcementType`
  - 公告类型。
- `object.priorityLevel`
  - 公告优先级。

实现注意：

- 当前公告通知的 `projectionMode` 是：
  - 发布：`upsert`
  - 下线：`delete`
- 当前公告通知是 `mandatory=true`，即使用户关闭偏好也不会跳过。
- 当前公告通知通常没有 `actor`，因为 producer 使用的是 `subjectType: 'system'`。

### 6.10 `task_reminder`

来源事件：

- `task.reminder.auto_assigned`
- `task.reminder.expiring`
- `task.reminder.reward_granted`

```ts
data = {
  object: NotificationTaskSnapshot
  reminder: NotificationTaskReminderInfo
  reward?: NotificationTaskRewardSnapshot
}
```

- `object`
  - 任务快照。
  - 当前新生成数据通常会包含：
    - `kind`
    - `id`
    - `code`
    - `title`
    - `sceneType`
  - `cover` 目前只是类型预留，当前 producer 不写。
- `reminder.kind`
  - 任务提醒子类型：
    - `auto_assigned`
    - `expiring_soon`
    - `reward_granted`
- `reminder.assignmentId`
  - 当前用户对应 assignment 的 ID。
- `reminder.cycleKey`
  - 周期任务的周期标识。
- `reminder.expiredAt`
  - 任务过期时间，主要在即将过期提醒场景出现。
- `reward`
  - 仅奖励到账场景有意义。
- `reward.items`
  - 本次到账奖励项列表。
- `reward.ledgerRecordIds`
  - 本次奖励对应的 ledger 记录 ID 集合。

实现注意：

- `TaskNotificationService` 会根据不同提醒子类型生成不同默认文案：
  - `auto_assigned`：你有新的任务待完成
  - `expiring_soon`：任务即将过期
  - `reward_granted`：任务奖励已到账
- `reward_granted` 下：
  - 仅保留 `amount > 0` 的奖励项
  - `assetType` 仅允许 `1/2/3/4/5`
- `expiring_soon` 下：
  - 顶层 `expiresAt` 与 `data.reminder.expiredAt` 都可能出现
  - 前者用于通知生命周期过滤
  - 后者用于业务展示/跳转理解

## 7. 当前接口面

App 侧与通知直接相关的接口位于 `apps/app-api/src/modules/message/message.controller.ts`：

- `GET app/message/notification/page`
  - 分页查询站内通知
- `GET app/message/notification/unread-count`
  - 获取未读通知数
- `GET app/message/notification/preference/list`
  - 获取通知偏好
- `POST app/message/notification/preference/update`
  - 更新通知偏好
- `POST app/message/notification/read`
  - 标记单条通知已读
- `POST app/message/notification/read-all`
  - 标记全部通知已读

## 8. 重要实现注意点

### 8.1 `actor` 不是冻结快照

虽然对外结构长得像“用户快照”，但当前实现并不是把昵称/头像冻结进 `payload`，而是查询列表或推送实时消息时，根据 `actorUserId` 动态查 `appUser`。

这意味着：

- 用户改昵称/头像后，旧通知里的 `actor` 也可能跟着变化。
- `actor` 与 `data` 中的其他快照字段，不完全是同一种冻结策略。

### 8.2 只有评论动作类通知会做 projection 补全

当前 `NotificationProjectionService.normalizeNotificationPayload()` 只对以下类型做专门补全：

- `comment_reply`
- `comment_mention`
- `comment_like`
- `task_reminder` 只做结构裁剪，不做实体快照补查

这意味着：

- 评论动作类通知的 `comment/container/parentContainer` 更完整
- 主题类通知的 `cover` / `sectionId` 当前通常不会被自动补齐

### 8.3 类型允许，不等于当前 producer 一定会写

当前最值得注意的几个例子：

- `NotificationTopicSnapshot.cover`
  - 类型允许
  - 但 `topic_like` / `topic_favorited` / `topic_mentioned` / `topic_commented` 的当前 producer 不写
- `NotificationTopicSnapshot.sectionId`
  - 同上
- `NotificationTaskSnapshot.cover`
  - 类型允许
  - 当前 `TaskNotificationService` 不写

### 8.4 公告通知的 `summary` 是通知摘要，不是原公告长文

当前公告通知写入 payload 时，`summary` 字段代表“通知中心要展示的摘要文本”，不是公告详情全文，也不强保证等于公告表原始 `summary` 字段。

### 8.5 过期通知不会出现在列表里

`MessageNotificationService.queryUserNotificationList()` 和 `getUnreadCount()` 都会过滤：

- `expiresAt is null`
- 或 `expiresAt > now`

所以：

- 数据库里可能还保留行
- 但过期通知不会再通过对外列表返回

## 9. 最终结论

- 当前消息通知模块对外只有 **10 种通知类型**。
- 对外结构已经统一成 **`type + actor + message + data`**。
- 真正需要联调时，最关键的是区分三层：
  - 顶层通知对象字段
  - 共享快照结构字段
  - 每种 `type` 对应的 `data` 结构字段
- 如果需要判断“某个字段是不是一定有”，不能只看类型定义，还要结合 producer 与 projection 的当前实现：
  - 评论动作类通知最完整
  - 主题类通知当前最容易出现“类型允许但实际未填”
  - `actor` 是动态 join，不是冻结快照

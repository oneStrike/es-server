# 消息通知合同重构设计（破坏性更新）

## 1. 背景

当前消息通知链路已经把对外主体逐步收敛到了 `payload.subject` / `payload.parentSubject`，但仍存在以下问题：

- producer 侧 payload 与 consumer/API 侧 payload 不是同一份合同，存在二次规范化成本。
- 评论类通知仍然围绕“挂载目标”建模，缺少“被操作评论本身”的一等表达，例如 `comment_like` 无法稳定返回评论内容摘要。
- 同一语义分散在顶层字段、`payload` 历史字段、`subject.extra` 中，重复较多，客户端需要猜测真正事实源。
- `payload` 目前对外仍是 `Record<string, unknown>`，无法形成稳定的可判别联合类型。

本设计允许破坏性更新，不保留旧字段兼容层，目标是一次性收敛通知合同。

## 2. 设计目标

1. 让每一种通知类型都具备稳定、可判别、可类型推导的数据结构。
2. 保留服务端模板渲染能力，同时为客户端提供结构化跳转与展示数据。
3. 去掉重复字段，只保留“渲染文案”和“结构化事实”两层，不再保留第三套历史兼容字段。
4. 让评论、点赞、提及、回复都能稳定返回“被操作内容摘要”。
5. 让通知成为不可变快照，尽量避免 consumer 阶段二次查库补结构。

## 3. 非目标

- 不保留旧版 `payload.subject` / `payload.parentSubject` 兼容输出。
- 不保留 `topicTitle`、`targetType`、`targetId`、`taskTitle`、`payloadVersion` 等历史字段。
- 不在本轮设计中扩展新通知类型，仅重做现有 10 种类型的数据合同。

## 4. 总体方案

新的通知对象拆成两层：

- `message`：最终展示文案，由服务端模板渲染后直接返回。
- `data`：结构化业务事实，按通知 `type` 形成严格判别联合。

这样做允许前端：

- 直接使用 `message.title` / `message.body` 渲染列表。
- 使用 `data` 做跳转、局部展示、埋点、详情补充。

也允许服务端：

- 继续统一模板渲染。
- 用一份稳定结构贯通 producer、projection、API DTO。

## 5. 顶层合同

```ts
export type NotificationType =
  | 'comment_reply'
  | 'comment_mention'
  | 'comment_like'
  | 'topic_like'
  | 'topic_favorited'
  | 'topic_commented'
  | 'topic_mentioned'
  | 'user_followed'
  | 'system_announcement'
  | 'task_reminder'

export interface NotificationUserSnapshot {
  id: number
  nickname: string
  avatarUrl?: string
}

export interface NotificationMessageBlock {
  title: string
  body: string
}

export interface NotificationBase<TType extends NotificationType, TData> {
  id: number
  type: TType
  actor?: NotificationUserSnapshot
  message: NotificationMessageBlock
  data: TData
  isRead: boolean
  readAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}
```

## 6. 基础快照类型

### 6.1 内容快照

```ts
export interface CommentSnapshot {
  kind: 'comment'
  id: number
  snippet?: string
}

export interface TopicSnapshot {
  kind: 'topic'
  id: number
  title: string
  cover?: string
  sectionId?: number
}

export interface WorkSnapshot {
  kind: 'work'
  id: number
  title: string
  cover?: string
  workType?: number
}

export interface ChapterSnapshot {
  kind: 'chapter'
  id: number
  title: string
  subtitle?: string
  cover?: string
  workId: number
  workType?: number
}

export interface AnnouncementSnapshot {
  kind: 'announcement'
  id: number
  title: string
  summary?: string
  announcementType: number
  priorityLevel: number
}

export interface TaskSnapshot {
  kind: 'task'
  id: number
  code: string
  title: string
  cover?: string
  sceneType: number
}
```

### 6.2 设计说明

- `comment` 被提升为一等快照，解决 `comment_like`、`comment_reply`、`comment_mention` 缺少内容摘要的问题。
- 不再使用 `subject.extra` 这种松散对象；每种快照的专属字段直接体现在自己的类型里。
- `title` 只保留在真正属于实体标题的场景，评论内容用 `snippet` 表达，避免语义混淆。

## 7. 10 种通知类型定义

### 7.1 评论回复

```ts
export type CommentReplyNotification = NotificationBase<
  'comment_reply',
  {
    object: CommentSnapshot
    container: WorkSnapshot | TopicSnapshot | ChapterSnapshot
    parentContainer?: WorkSnapshot
  }
>
```

字段说明：

- `object`：回复后的评论快照，`snippet` 为回复内容摘要。
- `container`：该评论直接挂载的主体。
- `parentContainer`：仅当 `container.kind = 'chapter'` 时返回所属作品。

### 7.2 评论提及

```ts
export type CommentMentionNotification = NotificationBase<
  'comment_mention',
  {
    object: CommentSnapshot
    container: WorkSnapshot | TopicSnapshot | ChapterSnapshot
    parentContainer?: WorkSnapshot
  }
>
```

字段说明：

- `object`：包含 @ 的评论快照，`snippet` 为评论内容摘要。
- `container` / `parentContainer` 规则与 `comment_reply` 一致。

### 7.3 评论点赞

```ts
export type CommentLikeNotification = NotificationBase<
  'comment_like',
  {
    object: CommentSnapshot
    container: WorkSnapshot | TopicSnapshot | ChapterSnapshot
    parentContainer?: WorkSnapshot
  }
>
```

字段说明：

- `object`：被点赞评论快照，`snippet` 为被点赞评论内容摘要。
- 这是本次设计刻意补强的重点，替代旧版只有 `commentId` 没有评论内容的问题。

### 7.4 主题点赞

```ts
export type TopicLikeNotification = NotificationBase<
  'topic_like',
  {
    object: TopicSnapshot
  }
>
```

### 7.5 主题收藏

```ts
export type TopicFavoritedNotification = NotificationBase<
  'topic_favorited',
  {
    object: TopicSnapshot
  }
>
```

### 7.6 主题评论

```ts
export type TopicCommentedNotification = NotificationBase<
  'topic_commented',
  {
    object: CommentSnapshot
    container: TopicSnapshot
  }
>
```

字段说明：

- `object`：评论快照，`snippet` 为评论摘要。
- `container`：被评论主题快照。

### 7.7 主题提及

```ts
export type TopicMentionedNotification = NotificationBase<
  'topic_mentioned',
  {
    object: TopicSnapshot
  }
>
```

### 7.8 用户关注

```ts
export type UserFollowedNotification = NotificationBase<'user_followed', null>
```

字段说明：

- `actor` 是展示触发者的唯一事实源。
- `data` 固定为 `null`，避免再重复返回一份仅含 `user id` 的对象。

### 7.9 系统公告

```ts
export type SystemAnnouncementNotification = NotificationBase<
  'system_announcement',
  {
    object: AnnouncementSnapshot
  }
>
```

### 7.10 任务提醒

```ts
export interface TaskRewardSnapshot {
  items: Array<{
    assetType: 1 | 2 | 3 | 4 | 5
    amount: number
  }>
  ledgerRecordIds: number[]
}

export type TaskReminderNotification = NotificationBase<
  'task_reminder',
  {
    object: TaskSnapshot
    reminder: {
      kind: 'auto_assigned' | 'expiring_soon' | 'reward_granted'
      assignmentId?: number
      cycleKey?: string
      expiredAt?: string
    }
    reward?: TaskRewardSnapshot
  }
>
```

字段说明：

- `object`：任务快照。
- `reminder.kind`：提醒子类型。
- `reward`：仅奖励到账提醒返回。
- `reward.items[].assetType` 直接复用数据库奖励资产枚举值域：`1=积分`、`2=经验`、`3=道具`、`4=虚拟货币`、`5=等级`。
- 当前 task 奖励业务校验仍主要产出 `1/2`，但通知合同层不再把类型收窄到该子集。
- `actionUrl` 不再作为 payload 字段对外暴露，由客户端根据 `type + reminder.kind + object.id` 自行路由，避免协议层把页面路径写死在数据层。

## 8. 总联合类型

```ts
export type UserNotification =
  | CommentReplyNotification
  | CommentMentionNotification
  | CommentLikeNotification
  | TopicLikeNotification
  | TopicFavoritedNotification
  | TopicCommentedNotification
  | TopicMentionedNotification
  | UserFollowedNotification
  | SystemAnnouncementNotification
  | TaskReminderNotification
```

## 9. 跳转规则

统一不再依赖零散历史字段，也不新增顶层 `target` 第三事实源；跳转只由 `type + data` 推导。

推荐规则：

- `comment_reply` / `comment_mention` / `comment_like`
  - 跳转目标取 `container`
  - 锚点评论取 `object.id`
  - 若 `parentContainer` 存在，则视为章节场景，使用 `parentContainer.id + container.id + object.id` 组合定位
- `topic_commented` / `topic_like` / `topic_favorited` / `topic_mentioned`
  - 跳转目标为主题 ID
  - `topic_commented` 取 `container.id`
  - 其他三类取 `object.id`
- `user_followed`
  - 跳转目标取 `actor.id`
- `system_announcement`
  - 跳转目标取 `data.object.id`
- `task_reminder`
  - 跳转目标取 `data.object.id`

## 10. 为什么这套结构比现状更好

### 10.1 去重

删掉以下重复表达：

- `actorUserId` + `payload.actorNickname`
- `payload.subject` + `payload.parentSubject` + `targetType/targetId`
- `payload.title/content/taskTitle`

保留的仅有两层：

- `message`：最终渲染结果。
- `data`：结构化事实。

刻意去掉顶层 `target`，避免它和 `data.object/container` 再形成第三套跳转事实源。

### 10.2 评论类表达更自然

评论类本质上是“某人对一条评论进行了某种动作”，而不是“某个作品/主题发生了某种评论事件”。

因此评论类统一用：

- `object = comment`
- `container = work/topic/chapter`
- `parentContainer = work?`

这比旧版只返回 `commentId + subject` 更接近真实业务语义。

### 10.3 类型系统友好

客户端和服务端都可以直接通过 `type` 做类型收窄，不再需要对 `payload` 做字符串 key 猜测。

### 10.4 关注通知不再重复

`user_followed` 不再同时返回 `actor` 和 `data.object.userId` 两份等价信息，`actor` 成为唯一事实源。

## 11. 破坏性变更清单

以下字段删除：

- `categoryKey`
- `categoryLabel`
- `actorUserId`
- `actorUser`
- `payload`
- `payload.actorNickname`
- `payload.subject`
- `payload.parentSubject`
- `payload.topicTitle`
- `payload.topicId`
- `payload.targetType`
- `payload.targetId`
- `payload.targetDisplayTitle`
- `payload.replyCommentId`
- `payload.title`
- `payload.content`
- `payload.taskTitle`
- `payload.payloadVersion`
- `payload.actionUrl`
- `payload.points`
- `payload.experience`

以下字段重命名：

- `categoryKey -> type`
- `title -> message.title`
- `content -> message.body`
- `expiresAt -> expiresAt`（保留，但语义收口到顶层）

## 12. 新旧字段映射

### 12.1 旧到新

| 旧字段                                            | 新字段                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `categoryKey`                                     | `type`                                                                |
| `title`                                           | `message.title`                                                       |
| `content`                                         | `message.body`                                                        |
| `actorUser.id/nickname/avatarUrl`                 | `actor.id/nickname/avatarUrl`                                         |
| `payload.commentId`                               | `data.object.id`（评论类）                                            |
| `payload.commentExcerpt` / `payload.replyExcerpt` | `data.object.snippet`                                                 |
| `payload.subject`                                 | `data.object`、`data.container` 或 `data.parentContainer`，按类型拆分 |
| `payload.parentSubject`                           | `data.parentContainer`                                                |
| `payload.announcementId`                          | `data.object.id`（公告类）                                            |
| `payload.taskId`                                  | `data.object.id`（任务类）                                            |
| `payload.taskCode`                                | `data.object.code`                                                    |
| `payload.sceneType`                               | `data.object.sceneType`                                               |
| `payload.reminderKind`                            | `data.reminder.kind`                                                  |
| `payload.rewardSummary`                           | `data.reward`                                                         |

### 12.2 无保留映射

以下旧字段不再保留独立映射：

- `payload.actorNickname`
- `payload.topicTitle`
- `payload.targetType`
- `payload.targetId`
- `payload.targetDisplayTitle`
- `payload.taskTitle`
- `payload.payloadVersion`
- `payload.actionUrl`

## 13. 服务端落地建议

### 13.1 producer

- producer 直接产出最终 `data` 快照，不再产出半成品旧 payload。
- 评论相关事件在创建通知事件时就带上评论摘要。
- 主题、作品、章节、任务、公告快照在 producer 阶段冻结。

### 13.2 projection

- projection 不再负责将旧 payload 二次归一化成 `subject` 结构。
- projection 仅负责：
  - 偏好判断
  - 模板渲染
  - 落库
  - 实时同步

### 13.3 DTO

- 对外 DTO 直接使用 `UserNotification` 联合。
- Swagger 侧若无法良好表达联合类型，可按 `type` 拆为 `oneOf` 或提供补充文档说明。

## 14. 风险与取舍

### 14.1 风险

- 这是一轮纯破坏性更新，所有客户端通知读取逻辑都要同步重写。
- 若现有 producer 暂时无法冻结完整快照，则短期内需要补查询逻辑。
- `actionUrl` 删除后，前端必须建立新的本地路由映射表。

### 14.2 取舍

- 本设计选择“更强类型 + 更少重复 + 更自然语义”，接受短期迁移成本。
- 本设计保留 `message` 与 `data` 的双层结构，这是有意为之，不视为重复。

## 15. 推荐实施顺序

1. 定义新联合类型与 DTO。
2. 改造 producer，使其直接输出新 `data` 结构。
3. 改造 projection / persistence，停止写旧 payload。
4. 改造 app API 输出。
5. 编写破坏性更新文档并同步客户端。
6. 删除旧字段、旧模板引用与旧归一化逻辑。

## 16. 决策结论

采用“`message + data` 双层 + `type` 判别联合 + `comment/object/container` 显式建模”的新通知合同。

这是当前最适合消息通知域的长期结构：

- 能表达点赞/评论/提及的真实业务对象。
- 能消灭旧 payload 中的大量重复字段。
- 能让类型系统真正发挥作用。
- 能把通知从“历史兼容拼装结果”变成“稳定用户可见快照”。

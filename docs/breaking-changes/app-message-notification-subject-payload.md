# App Message Notification Contract Breaking Change

## Scope

- API: `GET app/message/notification/page`
- Domain: 消息通知对外读模型
- Change type: 破坏性更新，无兼容层

## What Changed

通知列表返回结构从旧版：

```ts
{
  categoryKey
  categoryLabel
  actorUserId
  title
  content
  payload
  actorUser
}
```

切换为新版：

```ts
{
  id
  type
  actor?
  message: {
    title
    body
  }
  data
  isRead
  readAt?
  expiresAt?
  createdAt
  updatedAt
}
```

## Core Principles

- `message` 只负责最终展示文案。
- `data` 只负责结构化业务事实。
- 不再返回顶层 `target`。
- `user_followed` 的 `data` 固定为 `null`。
- 评论相关通知统一返回“被操作评论本身”的快照，`comment_like` 会返回评论摘要。

## Removed Fields

- `categoryKey`
- `categoryLabel`
- `actorUserId`
- `title`
- `content`
- `payload`
- `actorUser`
- 所有旧 payload 兼容字段：
  - `actorNickname`
  - `subject`
  - `parentSubject`
  - `topicTitle`
  - `topicId`
  - `targetType`
  - `targetId`
  - `targetDisplayTitle`
  - `replyCommentId`
  - `taskTitle`
  - `payloadVersion`
  - `actionUrl`

## New Top-Level Structure

```ts
type NotificationType =
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

type Notification = {
  id: number
  type: NotificationType
  actor?: {
    id: number
    nickname?: string
    avatarUrl?: string
  }
  message: {
    title: string
    body: string
  }
  data: Record<string, unknown> | null
  isRead: boolean
  readAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}
```

## Category Structures

### Comment notifications

- `comment_reply`
- `comment_mention`
- `comment_like`

```ts
data = {
  object: {
    kind: 'comment'
    id: number
    snippet?: string
  }
  container: {
    kind: 'work' | 'chapter' | 'topic'
    id: number
    title?: string
    subtitle?: string
    cover?: string
    workId?: number
    workType?: number
    sectionId?: number
  }
  parentContainer?: {
    kind: 'work'
    id: number
    title?: string
    cover?: string
    workType?: number
  }
}
```

说明：

- `comment_like` 现在会返回被点赞评论的 `snippet`。
- 当 `container.kind = 'chapter'` 时，额外返回 `parentContainer`。

### Topic notifications

- `topic_like`
- `topic_favorited`
- `topic_mentioned`

```ts
data = {
  object: {
    kind: 'topic'
    id: number
    title?: string
    cover?: string
    sectionId?: number
  }
}
```

### Topic commented

```ts
data = {
  object: {
    kind: 'comment'
    id: number
    snippet?: string
  }
  container: {
    kind: 'topic'
    id: number
    title?: string
    cover?: string
    sectionId?: number
  }
}
```

### Follow notification

- `user_followed`

```ts
data = null
```

说明：

- 关注人信息只从顶层 `actor` 读取。

### Announcement notification

- `system_announcement`

```ts
data = {
  object: {
    kind: 'announcement'
    id: number
    title?: string
    summary?: string
    announcementType?: number
    priorityLevel?: number
  }
}
```

### Task reminder

- `task_reminder`

```ts
data = {
  object: {
    kind: 'task'
    id: number
    code?: string
    title?: string
    cover?: string
    sceneType?: number
  }
  reminder: {
    kind: 'auto_assigned' | 'expiring_soon' | 'reward_granted'
    assignmentId?: number
    cycleKey?: string
    expiredAt?: string
  }
  reward?: {
    items: Array<{
      assetType: 1 | 2 | 3 | 4 | 5
      amount: number
    }>
    ledgerRecordIds: number[]
  }
}
```

说明：

- `reward.items[].assetType` 直接复用数据库奖励资产枚举值域。
- `1=积分`
- `2=经验`
- `3=道具`
- `4=虚拟货币`
- `5=等级`
- 当前 task 奖励链路的业务校验仍主要产出 `1/2`，但合同层不再收窄为该子集，便于后续扩展。

## Migration Guidance

### Render text

旧：

```ts
item.title
item.content
```

新：

```ts
item.message.title
item.message.body
```

### Actor

旧：

```ts
item.actorUser
item.actorUserId
payload.actorNickname
```

新：

```ts
item.actor
```

### Comment jump / render

旧：

```ts
payload.commentId
payload.subject
payload.parentSubject
payload.targetType
payload.targetId
```

新：

```ts
data.object
data.container
data.parentContainer
```

### Task reminder

旧：

```ts
payload.taskId
payload.taskCode
payload.taskTitle
payload.actionUrl
payload.reminderKind
payload.rewardSummary
```

新：

```ts
data.object
data.reminder
data.reward
```

## Notes

- 本次为破坏性更新，不提供旧字段兼容层。
- 服务端历史 `user_notification.payload` 已要求同轮回填到新结构。

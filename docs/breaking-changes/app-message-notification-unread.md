# App Message Notification Unread Breaking Change

## Scope

- API: `GET app/message/notification/unread-count`
- API: 用户中心 `message`
- API: 收件箱摘要
- Realtime: `inbox.summary.updated`
- Change type: 破坏性更新，无兼容层

## What Changed

通知未读数合同从“单一总数字段”切换为“共享 unread 结构”：

```ts
type NotificationUnread = {
  total: number
  byCategory: {
    comment_reply: number
    comment_mention: number
    comment_like: number
    topic_like: number
    topic_favorited: number
    topic_commented: number
    topic_mentioned: number
    user_followed: number
    system_announcement: number
    task_reminder: number
  }
}
```

其中 `byCategory` 当前按已有通知类型逐字段返回，零值也显式返回 `0`。若后续新增通知类型，需要同步更新这份契约与文档。

## Removed Fields

- `GET app/message/notification/unread-count`
  - `count`
- 用户中心 `message`
  - `notificationUnreadCount`
- 收件箱摘要
  - `notificationUnreadCount`
- `inbox.summary.updated`
  - `notificationUnreadCount`

## New Structures

### 1. `GET app/message/notification/unread-count`

旧：

```ts
{
  count: number
}
```

新：

```ts
{
  total: number
  byCategory: {
    comment_reply: number
    comment_mention: number
    comment_like: number
    topic_like: number
    topic_favorited: number
    topic_commented: number
    topic_mentioned: number
    user_followed: number
    system_announcement: number
    task_reminder: number
  }
}
```

### 2. 用户中心 `message`

旧：

```ts
{
  notificationUnreadCount: number
  totalUnreadCount: number
}
```

新：

```ts
{
  notificationUnread: {
    total: number
    byCategory: {
      comment_reply: number
      comment_mention: number
      comment_like: number
      topic_like: number
      topic_favorited: number
      topic_commented: number
      topic_mentioned: number
      user_followed: number
      system_announcement: number
      task_reminder: number
    }
  }
  totalUnreadCount: number
}
```

### 3. 收件箱摘要 / `inbox.summary.updated`

旧：

```ts
{
  notificationUnreadCount: number
  chatUnreadCount: number
  totalUnreadCount: number
  latestNotification?: unknown
  latestChat?: unknown
}
```

新：

```ts
{
  notificationUnread: {
    total: number
    byCategory: {
      comment_reply: number
      comment_mention: number
      comment_like: number
      topic_like: number
      topic_favorited: number
      topic_commented: number
      topic_mentioned: number
      user_followed: number
      system_announcement: number
      task_reminder: number
    }
  }
  chatUnreadCount: number
  totalUnreadCount: number
  latestNotification?: unknown
  latestChat?: unknown
}
```

## Example

```json
{
  "notificationUnread": {
    "total": 3,
    "byCategory": {
      "comment_reply": 2,
      "comment_mention": 0,
      "comment_like": 0,
      "topic_like": 1,
      "topic_favorited": 0,
      "topic_commented": 0,
      "topic_mentioned": 0,
      "user_followed": 0,
      "system_announcement": 0,
      "task_reminder": 0
    }
  },
  "chatUnreadCount": 5,
  "totalUnreadCount": 8
}
```

## Migration Guidance

### Notification total

旧：

```ts
response.count
response.notificationUnreadCount
```

新：

```ts
response.total
response.notificationUnread.total
```

### Per-category badge

旧：

```ts
// 无法直接读取
```

新：

```ts
response.byCategory.comment_reply
response.notificationUnread.byCategory.comment_reply
```

### Total inbox badge

旧：

```ts
response.totalUnreadCount
```

新：

```ts
response.totalUnreadCount
```

说明：

- `totalUnreadCount` 仍然表示通知未读总数 + 聊天未读总数。
- `notificationUnread.total` 只表示通知未读总数。

## Notes

- 本次为破坏性更新，不提供旧字段兼容层。
- 客户端如果还依赖旧 `count` / `notificationUnreadCount` 字段，需要同轮切换。

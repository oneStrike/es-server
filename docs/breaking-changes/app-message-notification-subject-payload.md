# App Message Notification Payload Breaking Change

## Scope

- API: `GET app/message/notification/page`
- Domain: 消息通知 `payload`
- Change type: 破坏性更新，无兼容层

## What Changed

通知主体统一收敛为共享结构：

```ts
payload.subject
payload.parentSubject
```

- `subject`：通知直接关联的业务主体
- `parentSubject`：仅章节类通知返回，表示所属作品

## Removed Keys

以下旧字段不再作为客户端读取入口：

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

说明：

- 这些字段在 canonical payload 中已被 `subject` / `parentSubject` 覆盖。
- 客户端不得再依赖这些字段完成跳转或渲染。

## Canonical Structure

```ts
type NotificationPayloadSubject = {
  kind: 'work' | 'chapter' | 'topic' | 'announcement' | 'task'
  id: number
  title?: string
  subtitle?: string
  cover?: string
  extra?: Record<string, unknown>
}
```

## Category Rules

### Comment notifications

- `comment_reply`
- `comment_mention`
- `comment_like`

规则：

- 作品评论：`payload.subject.kind = 'work'`
- 帖子评论：`payload.subject.kind = 'topic'`
- 章节评论：
  - `payload.subject.kind = 'chapter'`
  - `payload.parentSubject.kind = 'work'`

### Topic notifications

- `topic_like`
- `topic_favorited`
- `topic_commented`
- `topic_mentioned`

规则：

- 统一读取 `payload.subject.kind = 'topic'`

### Announcement notifications

- `system_announcement`

规则：

- 读取 `payload.subject.kind = 'announcement'`

### Task notifications

- `task_reminder`

规则：

- 读取 `payload.subject.kind = 'task'`

### No-subject notifications

- `user_followed`

规则：

- 不返回 `payload.subject`

## Migration Guidance

### Topic title

旧：

```ts
payload.topicTitle
payload.topicId
```

新：

```ts
payload.subject?.title
```

### Comment target jump

旧：

```ts
payload.targetType
payload.targetId
payload.targetDisplayTitle
payload.replyCommentId
```

新：

```ts
payload.subject?.kind
payload.subject?.id
payload.parentSubject?.kind
payload.parentSubject?.id
```

### Chapter target rendering

旧：

- 客户端无法直接拿到所属作品摘要

新：

```ts
payload.subject // chapter
payload.parentSubject // work
```

## Notes

- 本次为破坏性更新，不提供旧字段兼容层。
- 服务端历史 `user_notification.payload` 已要求同轮回填到新结构。

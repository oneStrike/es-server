# 用户通知契约破坏性更新说明（App 侧）

## 生效范围

- HTTP：`GET /app/message/notification/page`
- 实时事件：`notification.created`、`notification.updated`、`notification.deleted`

## 变更内容

### 1. 删除字段

- `projectionKey`
  - 旧行为：通知列表与部分实时事件中可能带出内部投影键
  - 新行为：用户可见通知契约不再返回该字段

### 2. 字段类型变更

- `payload`
  - 旧类型：`string`（JSON 字符串）
  - 新类型：`object | null`
  - 说明：`payload` 现在直接返回结构化对象，不需要客户端再手动 `JSON.parse`

### 3. 实时删除事件变更

- `notification.deleted`
  - 旧载荷：依赖 `projectionKey`，并可能附带 `notificationId`
  - 新载荷：`{ id: number }`
  - 说明：客户端应直接按通知 `id` 删除，不再按 `projectionKey` 对账

## 示例

### 通知列表项

```json
{
  "id": 101,
  "receiverUserId": 7,
  "categoryKey": "comment_reply",
  "categoryLabel": "评论回复",
  "actorUserId": 9,
  "title": "有人回复了你的评论",
  "content": "回复内容",
  "payload": {
    "replyCommentId": 101
  },
  "isRead": false,
  "readAt": null,
  "expiresAt": null,
  "createdAt": "2026-04-13T00:00:00.000Z",
  "updatedAt": "2026-04-13T00:00:00.000Z",
  "actorUser": {
    "id": 9,
    "nickname": "回复者"
  }
}
```

### 删除事件

```json
{
  "id": 101
}
```

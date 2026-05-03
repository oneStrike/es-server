# Message Native WS Adapter Cutover

## Scope

消息实时链路已从 Socket.IO 切换为 Nest 官方 `WsAdapter` 承载的原生 WebSocket。

## Breaking Changes

### 1. Socket.IO `/message` namespace 下线

旧行为：

- 客户端通过 Socket.IO namespace `/message` 建连。
- 客户端使用 Socket.IO 的 `emit` 发送 `chat.send` / `chat.read`。
- 服务端可通过 Socket.IO room 向用户推送实时事件。

新行为：

- 客户端必须使用原生 WebSocket 连接 `/message` path。
- 入站消息统一使用 `{ event, data }` envelope。
- 服务端只维护原生 WebSocket 连接集合，不再提供 Socket.IO namespace、room 或 `client.emit()` 语义。

为什么允许 breaking：

- 前端无法使用 Socket.IO。
- 服务端改为使用 Nest 官方 `@nestjs/platform-ws` 的 `WsAdapter`，避免继续维护 Socket.IO 与手写 WebSocket 双栈。

### 2. 鉴权改为 `auth` 事件

连接建立后，服务端会发送：

```json
{
  "event": "ws.auth.required",
  "data": {
    "message": "Authentication required"
  }
}
```

客户端随后发送：

```json
{
  "event": "auth",
  "data": {
    "token": "<access-token>"
  }
}
```

鉴权成功后，服务端返回：

```json
{
  "event": "ws.auth.ok",
  "data": {
    "userId": 7
  }
}
```

鉴权失败时，服务端返回：

```json
{
  "event": "ws.auth.error",
  "data": {
    "code": 40101,
    "message": "Authentication failed"
  }
}
```

不再把 Socket.IO handshake token、URL query token 或握手 `Authorization` header 作为正式合同。

### 3. 聊天命令 envelope 改为 `{ event, data }`

发送聊天消息：

```json
{
  "event": "chat.send",
  "data": {
    "requestId": "req-1",
    "payload": {
      "conversationId": 10,
      "messageType": 1,
      "content": "hello"
    }
  }
}
```

标记会话已读：

```json
{
  "event": "chat.read",
  "data": {
    "requestId": "req-2",
    "payload": {
      "conversationId": 10,
      "messageId": "100"
    }
  }
}
```

ack 返回：

```json
{
  "event": "chat.ack",
  "data": {
    "requestId": "req-1",
    "code": 0,
    "message": "ok",
    "data": {
      "id": "100"
    }
  }
}
```

### 4. 推送事件名保持不变

以下业务事件名保持不变，只是 transport 改为原生 WebSocket：

- `notification.created`
- `notification.updated`
- `notification.deleted`
- `notification.read.sync`
- `chat.message.new`
- `chat.conversation.update`
- `inbox.summary.updated`

示例：

```json
{
  "event": "inbox.summary.updated",
  "data": {
    "notificationUnread": {
      "total": 1,
      "byCategory": {}
    },
    "chatUnreadCount": 0,
    "totalUnreadCount": 1
  }
}
```

## Frontend Migration Checklist

1. 移除 Socket.IO client。
2. 使用浏览器原生 `WebSocket` 连接 `/message`。
3. 收到 `ws.auth.required` 后发送 `auth` 事件。
4. 所有客户端发送消息统一改成 `{ event, data }`。
5. 读取 `chat.ack` 时，从 `data` 中取 `requestId`、`code`、`message` 与业务结果。
6. 继续监听原有业务推送事件名，并从 `data` 读取 payload。

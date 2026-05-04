# Chat Media Message Contract Hard Cutover

## Scope

聊天消息合同一次性切换为图片、语音、视频一等消息类型，并保留系统消息的内部值域。

公共发送入口是原生 WebSocket `chat.send`。The current controller/API surface has no HTTP chat-send endpoint；仓库内若存在历史审计 seed path 文本，不代表当前控制器暴露了 HTTP chat-send 路由。

## Breaking Changes

### 1. `message_type=3` 从系统消息改为语音消息

旧行为：

- `chat_message.message_type=3` 表示系统消息。
- 客户端发送值域只显式覆盖文本和图片。

新行为：

- `1` 表示文本消息。
- `2` 表示图片消息。
- `3` 表示语音消息。
- `4` 表示视频消息。
- `99` 表示系统消息，仅供服务端内部写入。

迁移会先删除旧 check 约束，再执行历史数据更新：old `message_type=3` rows are migrated to `99`，最后重建允许 `(1, 2, 3, 4, 99)` 的 check 约束。

### 2. `chat.send` payload is object-only

旧行为：

- 旧客户端可以发送字符串化 JSON payload。
- 发送边界会尝试解析 JSON 字符串。

新行为：

- `chat.send` payload is object-only。
- JSON strings are rejected。
- 文本消息 payload 可省略，或传普通 JSON 对象。
- 图片、语音、视频消息必须传对应媒体 payload 对象，并且文件路径必须来自 `scene=chat` 的上传结果。

### 3. 系统消息只能服务端内部写入

旧客户端不能继续发送 `messageType=99`，也不能把 `messageType=3` 当作系统消息发送。

`SendChatMessageDto` 和 `WsSendPayload` 只接受 `1, 2, 3, 4`。读取输出仍可能出现 `99`，用于展示历史或未来服务端写入的系统消息。

### 4. 混合版本部署风险

This is a mixed-version unsafe cutover.

在新旧服务混跑期间：

- 旧服务可能把新写入的 `message_type=3` 误读为系统消息。
- 新服务会把旧系统消息值迁移为 `99` 后读取。
- 旧客户端继续发送字符串 payload 会收到 `400`。

部署时必须先升级服务端与数据库迁移，再发布已适配对象 payload 和语音/视频值域的新客户端。避免旧服务继续写入或读取聊天消息。

## Client Migration Checklist

1. 发送聊天消息时只使用 `messageType` 值 `1, 2, 3, 4`。
2. 不再发送字符串化 JSON payload。
3. 文本 payload 改为普通 JSON 对象，或省略。
4. 图片、语音、视频 payload 使用上传接口返回的 `filePath`、`fileCategory`、`mimeType`、`fileSize` 等字段。
5. 处理读取响应中的 `messageType=99`，将其视为系统消息。

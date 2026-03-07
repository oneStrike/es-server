# 私聊协议草案 v1（WS 收发 + HTTP 查询补偿）

## 0. 文档信息

- 日期：2026-03-08
- 最后更新：2026-03-08（后端已实现版）
- 适用范围：`es-server`（`app-api` + `libs/message`）
- 目标：
  - 私聊消息收发走 WebSocket
  - 历史查询、断线补偿走 HTTP
  - 保证可追溯、可补偿、可幂等

---

## 0.1 当前实现状态（2026-03-08）

已完成：

1. WS 连接鉴权与房间管理已完成（`/message` + `user:{userId}`）。
2. `chat.send` 已完成：
   - 统一 `chat.ack` 应答
   - 支持 `clientMessageId`
   - 发送成功 ack 返回 `conversationId/messageId/messageSeq/createdAt`
3. `chat.read` 已完成：
   - 统一 `chat.ack` 应答
   - ack 返回 `readUptoMessageId`（兼容保留 `messageId`）
4. 服务端实时推送已完成：
   - `chat.message.new`
   - `chat.conversation.update`
   - `inbox.summary.update`
5. 发送幂等已落地：
   - 服务端按 `clientMessageId` 去重
   - 会话级事务锁（`pg_advisory_xact_lock`）避免并发重复写入
6. HTTP 补偿查询已落地：
   - `GET /app/message/chat/conversation/messages` 支持 `afterSeq`

未完成：

1. 数据库唯一约束 `(conversationId, senderId, clientMessageId)` 尚未在 Prisma 模型中显式化。
2. WS 监控指标（请求量、ack 成功率、ack 延迟、重连/补偿统计）尚未接入存储和看板。
3. HTTP 发送/已读接口尚未下线（当前仍保留，便于回滚和兼容）。
4. 自动化测试未补充（按当前约定暂不做测试）。

---

## 1. 总体原则

1. **传输层**：实时动作（发送、已读）走 WS。
2. **一致性层**：历史拉取、断线补偿走 HTTP。
3. **排序基准**：以服务端 `messageSeq` 为准，不以前端本地时间为准。
4. **幂等**：客户端发送必须携带 `clientMessageId`；请求必须携带 `requestId`。
5. **可观测**：所有 WS 请求都必须有 ack。

---

## 2. 连接与鉴权

### 2.1 Namespace

- `/message`

### 2.2 客户端连接参数

- `auth.token` 或 `query.token` 或 `Authorization: Bearer <token>`

### 2.3 服务端连接校验

1. 校验 JWT（access token）。
2. 校验通过后加入房间：`user:{userId}`。
3. 校验失败则断开连接。

---

## 3. 协议包结构

## 3.1 客户端请求包（C2S）

```json
{
  "requestId": "7f2c4d8e-1f29-4f54-b8a8-1ff0a63f0d37",
  "timestamp": 1772863200000,
  "payload": {}
}
```

字段要求：

1. `requestId`：必填，UUID，单连接内唯一。
2. `timestamp`：可选，毫秒时间戳。
3. `payload`：业务参数。

## 3.2 服务端 ack 包（S2C）

事件名：`chat.ack`

```json
{
  "requestId": "7f2c4d8e-1f29-4f54-b8a8-1ff0a63f0d37",
  "code": 0,
  "message": "ok",
  "data": {}
}
```

字段要求：

1. `requestId`：回传原值。
2. `code`：0=成功，非 0=失败。
3. `message`：可读错误信息。
4. `data`：业务返回。

---

## 4. 事件定义

## 4.1 C2S：发送消息

事件：`chat.send`

```json
{
  "requestId": "uuid",
  "payload": {
    "conversationId": 123,
    "clientMessageId": "cmsg_9d7a4a0b",
    "messageType": 1,
    "content": "你好",
    "payload": {}
  }
}
```

服务端处理：

1. 校验会话成员关系与内容。
2. 事务写入 `chat_message`，分配 `messageSeq`。
3. 更新会话快照与成员未读计数。
4. ack 成功后，向成员推送 `chat.message.new` / `chat.conversation.update` / `inbox.summary.update`。

ack `data` 建议：

```json
{
  "conversationId": 123,
  "messageId": "456789",
  "messageSeq": "1001",
  "clientMessageId": "cmsg_9d7a4a0b",
  "createdAt": "2026-03-08T10:00:00.000Z"
}
```

## 4.2 C2S：会话已读

事件：`chat.read`

```json
{
  "requestId": "uuid",
  "payload": {
    "conversationId": 123,
    "messageId": "456789"
  }
}
```

ack `data` 建议：

```json
{
  "conversationId": 123,
  "readUptoMessageId": "456789"
}
```

## 4.3 S2C：新消息推送

事件：`chat.message.new`

```json
{
  "conversationId": 123,
  "message": {
    "id": "456789",
    "conversationId": 123,
    "messageSeq": "1001",
    "senderId": 10001,
    "messageType": 1,
    "content": "你好",
    "payload": {},
    "createdAt": "2026-03-08T10:00:00.000Z"
  }
}
```

## 4.4 S2C：会话摘要更新

事件：`chat.conversation.update`

字段沿用当前实现（`unreadCount` / `lastMessageId` / `lastMessageAt` / `lastSenderId` / `lastMessageContent` / `lastReadAt` 等）。

## 4.5 S2C：消息中心摘要更新

事件：`inbox.summary.update`

字段沿用当前实现（通知未读、聊天未读、总未读、最新摘要）。

---

## 5. 幂等、去重、顺序

## 5.1 幂等键

1. 请求幂等：`requestId`（链路级，避免同次请求重复处理）。
2. 业务幂等：`clientMessageId`（消息级，避免断线重发导致重复入库）。
3. 建议唯一约束：`(conversationId, senderId, clientMessageId)`。

## 5.2 客户端去重

1. 首选 `message.id` 去重。
2. 发送中状态可用 `clientMessageId -> message.id` 映射回填。

## 5.3 顺序与缺口检测

1. 每会话维护 `lastAppliedSeq`。
2. 收到新消息时：
   - `seq == lastAppliedSeq + 1`：直接应用；
   - `seq <= lastAppliedSeq`：判重丢弃；
   - `seq > lastAppliedSeq + 1`：判定缺口，触发 HTTP 补偿。

---

## 6. HTTP 查询与补偿

继续保留以下接口：

1. `GET /app/message/chat/conversation/list`
2. `GET /app/message/chat/conversation/messages`
3. `GET /app/message/inbox/summary`

## 6.1 补偿建议

优先推荐新增 `afterSeq` 参数（或单独新增补偿接口）：

1. `GET /app/message/chat/conversation/messages?conversationId=123&afterSeq=1001&limit=200`

若暂未支持 `afterSeq`，降级方案：

1. 拉取最近 N 条；
2. 客户端按 `message.id` 去重合并；
3. 重排后回填 `lastAppliedSeq`。

---

## 7. 重连状态机（客户端）

1. `DISCONNECTED`：连接断开，暂停发送。
2. `CONNECTING`：重连中，等待鉴权成功。
3. `RESYNCING`：连接已恢复，按会话执行 HTTP 补偿。
4. `READY`：补偿完成，恢复实时消费与发送。

重连流程：

1. WS 重连成功。
2. 对每个活跃会话执行补偿拉取（基于 `lastAppliedSeq`）。
3. 补偿期间收到的 WS 消息先入缓冲队列。
4. 补偿完成后合并“补偿结果 + 缓冲队列”，按 `messageSeq` 排序应用。
5. 状态切换为 `READY`。

---

## 8. 错误码建议

1. `0`：成功
2. `40001`：参数错误
3. `40101`：未认证或 token 失效
4. `40301`：无会话权限
5. `40401`：会话不存在
6. `40402`：消息不存在
7. `40901`：幂等冲突（已处理）
8. `42901`：发送频率超限
9. `50001`：内部错误

---

## 9. 服务端落地清单

1. 新增 WS 订阅处理：
   - `@SubscribeMessage('chat.send')`
   - `@SubscribeMessage('chat.read')`
2. 服务端返回统一 `chat.ack`。
3. `chat.send` 路径接入 `clientMessageId` 幂等。
4. 保留现有 HTTP 查询接口用于补偿。
5. 补充监控：
   - ws 请求量、ack 成功率、ack 延时
   - 重连次数、补偿触发次数、补偿成功率

---

## 10. 迁移建议（从当前实现演进）

1. 第一步：保留现有 HTTP 发送接口，新增 WS `chat.send` 并灰度客户端。
2. 第二步：客户端稳定后，默认改 WS 发送，HTTP 发送保留一段观察期。
3. 第三步：若无回退需求，再下线 HTTP 发送；查询补偿接口继续保留。

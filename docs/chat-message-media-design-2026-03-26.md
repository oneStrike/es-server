# ES 聊天消息类型重构与媒体消息方案（2026-03-26）

## 1. 背景与结论

### 1.1 背景
- 当前聊天消息类型定义为 `TEXT=1`、`IMAGE=2`、`SYSTEM=3`。
- 业务上要新增语音、视频、图标（贴纸）消息。
- 你提出 `SYSTEM` 占用 `3` 不合适，并希望系统消息做到“仅服务端可发”。

### 1.2 结论（建议采用）
- 将消息类型重构为：
  - `1 TEXT`
  - `2 IMAGE`
  - `3 AUDIO`
  - `4 VIDEO`
  - `5 STICKER`（图标/贴纸）
  - `99 SYSTEM`（仅服务端可发）
- 客户端发送入口只允许 `TEXT/IMAGE/AUDIO/VIDEO/STICKER`，拒绝 `SYSTEM`。
- 系统消息改为服务端内部能力（例如 `sendSystemMessage`），不暴露给客户端传参。
- 媒体消息采用“上传与发消息分离”：
  - 先拿上传凭证
  - 直传对象存储
  - 服务端确认并产出媒体资产
  - 再发送消息引用资产

## 2. 当前项目现状（代码核对）

- 消息类型定义：[`libs/message/src/chat/chat.constant.ts`](../libs/message/src/chat/chat.constant.ts)
- WebSocket `chat.send` 校验允许 `SYSTEM`：[`libs/message/src/notification/notification-websocket.service.ts`](../libs/message/src/notification/notification-websocket.service.ts)
- 聊天服务 `parseMessageType` 允许 `SYSTEM`：[`libs/message/src/chat/chat.service.ts`](../libs/message/src/chat/chat.service.ts)
- 聊天消息表 `messageType` 注释仍是 `1/2/3`：[`db/schema/message/chat-message.ts`](../db/schema/message/chat-message.ts)
- 仓库内未发现业务侧主动发送 `ChatMessageTypeEnum.SYSTEM` 的代码；seed 仅有 `1/2`。

## 3. 设计目标与非目标

### 3.1 目标
- 支持语音、视频、图标（贴纸）消息。
- 系统消息只能由服务端发送。
- 与现有 `clientMessageId` 幂等能力兼容。
- 兼容现有会话未读/已读机制。
- 上线风险可控，可分阶段灰度。

### 3.2 非目标
- 本期不做实时音视频通话（WebRTC Call）。
- 本期不做端到端加密改造。

## 4. 消息协议设计

### 4.1 消息类型

| 类型 | 值 | 可由客户端发送 | 说明 |
|---|---:|---|---|
| TEXT | 1 | 是 | 文本 |
| IMAGE | 2 | 是 | 图片 |
| AUDIO | 3 | 是 | 语音 |
| VIDEO | 4 | 是 | 视频 |
| STICKER | 5 | 是 | 图标/贴纸 |
| SYSTEM | 99 | 否 | 系统消息，服务端内部生成 |

### 4.2 `chat.send` 建议请求结构（统一）

```json
{
  "requestId": "req-xxx",
  "timestamp": 1710000000000,
  "payload": {
    "conversationId": 123,
    "messageType": 3,
    "content": "可选文案/描述",
    "clientMessageId": "client-xxx",
    "payload": {
      "mediaAssetId": "m_abc123",
      "durationMs": 5600
    }
  }
}
```

### 4.3 各类型 `payload` 约定（建议）

- `TEXT`
  - `payload`: 可选（mentions、ext）。
- `IMAGE`
  - `payload`: `mediaAssetId`、`width`、`height`、`thumbnailUrl`。
- `AUDIO`
  - `payload`: `mediaAssetId`、`durationMs`、`waveform`、`codec`。
- `VIDEO`
  - `payload`: `mediaAssetId`、`durationMs`、`width`、`height`、`thumbnailUrl`、`playbackUrl`。
- `STICKER`
  - `payload`: `stickerId`、`packId`、`url`、`width`、`height`、`alt`。
- `SYSTEM`
  - `payload`: `templateKey`、`args`、`bizType`、`bizId`、`operatorId`。

### 4.4 `content` 字段策略

- 当前表结构 `content` 为 `NOT NULL`，建议本期不改字段，保持兼容。
- 非文本消息约定：
  - 有用户输入文案则存文案
  - 无文案则由服务端填默认占位（如 `[语音]`、`[视频]`、`[贴纸]`）

## 5. 仅服务端可发 SYSTEM 的实现策略

### 5.1 网关层限制
- 在 WebSocket 入站校验中区分“客户端可发类型”：
  - 允许 `1/2/3/4/5`
  - 拒绝 `99`

### 5.2 服务层限制
- `MessageChatService.sendMessage()` 增加来源控制参数（或拆分接口）：
  - `sendClientMessage()`：仅允许客户端类型
  - `sendSystemMessage()`：仅服务端模块调用

### 5.3 API 与审计
- 对系统消息入库记录 `operatorId` / `source`（如 `task`, `moderation`, `purchase`）。
- 审计日志中可追溯系统消息来源。

## 6. 媒体上传与发送流程（最佳实践版）

### 6.1 流程
1. 客户端申请上传凭证（服务端鉴权）。
2. 服务端返回预签名上传 URL（短时有效）。
3. 客户端直传对象存储（减少 API 带宽压力）。
4. 客户端调用“上传完成确认”接口。
5. 服务端校验对象并创建 `media_asset` 记录。
6. 客户端发送 `chat.send`，只传 `mediaAssetId` 与必要元数据。

### 6.2 为什么这么做
- 减少聊天 API 服务器传输压力。
- 上传失败与消息发送解耦，状态更清晰。
- 更适合后续转码、审核、缩略图、CDN。

## 7. 数据模型建议

### 7.1 新增 `chat_media_asset`（建议）
- 字段建议：
  - `id`、`uploaderUserId`
  - `mediaType`（image/audio/video/sticker）
  - `storageKey`、`url`
  - `mimeType`、`sizeBytes`
  - `width`、`height`、`durationMs`、`waveform`
  - `thumbnailKey`、`thumbnailUrl`
  - `transcodeStatus`（pending/processing/ready/failed）
  - `virusScanStatus`
  - `createdAt`、`updatedAt`

### 7.2 `chat_message` 仅保留轻引用
- `payload.mediaAssetId` 指向资产表（或加显式字段 `mediaAssetId`）。
- 避免在消息行重复大块媒体元数据。

## 8. 可靠性与一致性

### 8.1 发送可靠性
- 继续使用 `clientMessageId`（项目已有）做幂等去重。
- 客户端侧可启用 ack 超时重试（谨慎设置，避免重复风暴）。

### 8.2 本地回显与失败态
- 建议恢复“本地回显 + 待确认态”，但必须使用 `clientMessageId` 与服务端回包对账。
- 失败后支持手动重发；自动重试需退避策略。

## 9. 安全与风控

### 9.1 上传安全控制
- 扩展名/MIME/文件签名三重校验，拒绝仅信任 `Content-Type`。
- 限制大小、时长、分辨率、帧率。
- 文件重命名并与业务 ID 解耦。
- 对象存储权限最小化、私有桶优先、下载使用受控 URL。
- 恶意内容扫描（病毒扫描/违规内容识别）后再对外可见。

### 9.2 URL 与访问控制
- 预签名 URL 视作临时凭证，短时有效、最小权限。
- 日志脱敏签名参数，避免泄漏。

## 10. 语音/视频编码与播放建议

### 10.1 语音
- 上传格式优先 `webm/opus` 或 `m4a/aac`。
- 服务端统一转码一份播放友好格式（按终端能力选）。

### 10.2 视频
- 短视频可直接 MP4（H.264/AAC）回放。
- 较大视频建议转 HLS（分片+自适应码率）并生成封面图。

## 11. 图标（贴纸）消息建议

- 贴纸独立为 `STICKER` 类型，不与普通图片混用。
- 贴纸资源建议限制：
  - 推荐尺寸不超过 512x512
  - 提供缩略图或直接复用主图
- 客户端展示应“轻交互”，适合时间线快速反馈。

## 12. 迁移与发布计划

### 阶段 A：兼容准备（无破坏）
- 增加新类型定义与解析逻辑（先不对外开启）。
- 系统消息新增 `99`，读取时兼容历史 `3`。
- 新增上传凭证接口与媒体资产表。

### 阶段 B：客户端切换
- 客户端启用 `AUDIO/VIDEO/STICKER` 发送。
- `SYSTEM` 从客户端入口彻底禁用。
- 观测失败率、重试率、转码耗时。

### 阶段 C：收敛
- 若确认无历史依赖，将 `3` 完整转为 `AUDIO` 语义。
- 清理 `SYSTEM=3` 兼容分支。

## 13. 需要改动的主要文件（实现参考）

- `libs/message/src/chat/chat.constant.ts`
- `libs/message/src/chat/chat.service.ts`
- `libs/message/src/chat/chat.type.ts`
- `libs/message/src/chat/dto/chat.dto.ts`
- `libs/message/src/notification/notification-websocket.service.ts`
- `libs/message/src/notification/notification-websocket.types.ts`
- `db/schema/message/chat-message.ts`（注释/约束）
- 新增 `db/schema/message/chat-media-asset.ts`
- `apps/app-api/src/modules/message/*`（上传凭证与完成确认接口）

## 14. 风险点与决策项

- 是否立即把 `3` 改为 `AUDIO`（需要确认生产是否存在 `SYSTEM=3` 历史数据）。
- 媒体是否强制转码后才能可见（体验 vs 成本）。
- 贴纸是否走独立资源包体系（运营能力要求更高）。
- 视频先 MP4 还是直接 HLS（研发复杂度 vs 播放稳定性）。

## 15. 互联网最佳实践参考

- OWASP 文件上传安全清单（扩展名/MIME/签名校验、最小权限、恶意扫描）
  https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

- AWS S3 预签名上传（临时授权、过期时间、权限边界）
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html

- AWS 预签名 URL 安全建议（最小权限、临时凭证、日志脱敏）
  https://docs.aws.amazon.com/prescriptive-guidance/latest/presigned-url-best-practices/foundational-best-practices.html
  https://docs.aws.amazon.com/prescriptive-guidance/latest/presigned-url-best-practices/logging-interactions.html

- Socket.IO 可靠性模型（默认 at-most-once、ack/retries、超时）
  https://socket.io/docs/v4/delivery-guarantees/
  https://socket.io/docs/v4/emitting-events/
  https://socket.io/docs/v4/tutorial/step-8

- Matrix 即时消息规范（`m.image/m.audio/m.video`、本地回显、重试建议、贴纸 `m.sticker`）
  https://spec.matrix.org/v1.15/client-server-api/

- 浏览器录音录像能力约束（`getUserMedia` 需 HTTPS/权限；`MediaRecorder` 分片）
  https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
  https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event

- HLS 协议标准（大视频分片与流式分发可选）
  https://www.rfc-editor.org/rfc/rfc8216

import type { ChatMediaOriginPolicy } from './chat-media-origin-policy.type'
import type {
  ChatTextMessagePayload,
  ImageChatMessagePayload,
  VideoChatMessagePayload,
  VoiceChatMessagePayload,
} from './chat-media-payload.type'
import type { ChatSendMessageType } from './chat-message-type.type'
import type {
  ChatMessageSendBoundaryInput,
  ChatMessageSendBoundaryResult,
  NormalizeClientMessageIdResult,
  NormalizeMediaPayloadResult,
  NormalizePayloadObjectResult,
  NormalizePayloadResult,
} from './chat.type'
import { Buffer } from 'node:buffer'
import { BadRequestException } from '@nestjs/common'
import {
  CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH,
  CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  CHAT_MESSAGE_PAYLOAD_MAX_BYTES,
  CHAT_MESSAGE_PAYLOAD_MAX_DEPTH,
  CHAT_SENDABLE_MESSAGE_TYPES,
  ChatSendMessageTypeEnum,
} from './chat.constant'

// 校验并规范化聊天消息发送输入，供 WS ack 分支复用非抛错结果。
export function normalizeChatMessageSendInput(
  input: ChatMessageSendBoundaryInput,
  originPolicy?: ChatMediaOriginPolicy,
): ChatMessageSendBoundaryResult {
  const conversationId = Number(input.conversationId)
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return invalid('conversationId 必须是正整数')
  }

  const messageType = Number(input.messageType)
  if (!isChatSendMessageType(messageType)) {
    return invalid('messageType 无效')
  }

  const contentResult = normalizeContent(input.content, messageType)
  if (!contentResult.ok) {
    return contentResult
  }

  const clientMessageIdResult = normalizeClientMessageId(input.clientMessageId)
  if (!clientMessageIdResult.ok) {
    return clientMessageIdResult
  }

  const payloadResult = normalizePayload(
    input.payload,
    messageType,
    originPolicy,
  )
  if (!payloadResult.ok) {
    return payloadResult
  }

  return {
    ok: true,
    value: {
      conversationId,
      messageType,
      content: contentResult.value,
      clientMessageId: clientMessageIdResult.value,
      payload: payloadResult.value?.payload,
    },
  }
}

// 校验并规范化聊天消息发送输入，供 service 入口复用 Nest 异常语义。
export function assertChatMessageSendInput(
  input: ChatMessageSendBoundaryInput,
  originPolicy?: ChatMediaOriginPolicy,
) {
  const result = normalizeChatMessageSendInput(input, originPolicy)
  if (!result.ok) {
    throw new BadRequestException(result.message)
  }
  return result.value
}

// 规范化客户端幂等键，并保持可选字段缺省语义。
function normalizeClientMessageId(
  value: unknown,
): NormalizeClientMessageIdResult {
  if (value === undefined) {
    return { ok: true }
  }

  if (typeof value !== 'string' || !value.trim()) {
    return invalid('clientMessageId 必须是非空字符串')
  }

  const normalized = value.trim()
  if (normalized.length > CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH) {
    return invalid(
      `clientMessageId 最长不能超过 ${CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH} 个字符`,
    )
  }

  return { ok: true, value: normalized }
}

// 根据消息类型规范化正文内容，媒体消息允许缺省并落库为空字符串。
function normalizeContent(value: unknown, messageType: ChatSendMessageType) {
  if (value === undefined || value === null) {
    if (messageType === ChatSendMessageTypeEnum.TEXT) {
      return invalid('消息内容不能为空')
    }
    return { ok: true, value: '' } as const
  }

  if (typeof value !== 'string') {
    return invalid('消息内容不能为空')
  }

  const content = value.trim()
  if (messageType === ChatSendMessageTypeEnum.TEXT && !content) {
    return invalid('消息内容不能为空')
  }

  if (content.length > CHAT_MESSAGE_CONTENT_MAX_LENGTH) {
    return invalid(
      `消息内容最长不能超过 ${CHAT_MESSAGE_CONTENT_MAX_LENGTH} 个字符`,
    )
  }

  return { ok: true, value: content } as const
}

// 按消息类型规范化扩展载荷，禁止 chat send 继续解析 JSON 字符串。
function normalizePayload(
  payload: unknown,
  messageType: ChatSendMessageType,
  originPolicy: ChatMediaOriginPolicy | undefined,
): NormalizePayloadResult {
  if (messageType === ChatSendMessageTypeEnum.TEXT) {
    const textPayloadResult = normalizeTextPayload(payload)
    if (!textPayloadResult.ok) {
      return textPayloadResult
    }
    return {
      ok: true,
      value: textPayloadResult.value
        ? { payload: textPayloadResult.value }
        : undefined,
    }
  }

  const mediaPayloadResult = normalizeMediaPayload(
    payload,
    messageType,
    originPolicy,
  )
  if (!mediaPayloadResult.ok) {
    return mediaPayloadResult
  }
  return { ok: true, value: { payload: mediaPayloadResult.value } }
}

// 校验扩展载荷对象的 JSON 安全性、嵌套深度和序列化大小。
function normalizeTextPayload(payload: unknown): NormalizePayloadObjectResult {
  if (payload === undefined) {
    return { ok: true, value: undefined }
  }

  if (!isPlainObject(payload)) {
    return invalid('payload 必须是 JSON 对象')
  }

  if (!isJsonSafeValue(payload, 1, new WeakSet<object>())) {
    return invalid(
      `payload 深度不能超过 ${CHAT_MESSAGE_PAYLOAD_MAX_DEPTH} 且必须是 JSON 可序列化值`,
    )
  }

  const sizeResult = ensurePayloadSize(payload)
  if (!sizeResult.ok) {
    return sizeResult
  }

  return {
    ok: true,
    value: payload as ChatTextMessagePayload,
  }
}

// 校验并收敛媒体消息载荷。
function normalizeMediaPayload(
  payload: unknown,
  messageType: ChatSendMessageType,
  originPolicy: ChatMediaOriginPolicy | undefined,
): NormalizeMediaPayloadResult {
  if (!originPolicy) {
    return invalid('媒体文件来源无效')
  }

  if (!isPlainObject(payload)) {
    return invalid('媒体消息 payload 必须是对象')
  }

  if (!isJsonSafeValue(payload, 1, new WeakSet<object>())) {
    return invalid(
      `payload 深度不能超过 ${CHAT_MESSAGE_PAYLOAD_MAX_DEPTH} 且必须是 JSON 可序列化值`,
    )
  }

  const sizeResult = ensurePayloadSize(payload)
  if (!sizeResult.ok) {
    return sizeResult
  }

  switch (messageType) {
    case 2:
      return normalizeImagePayload(payload, originPolicy)
    case 3:
      return normalizeVoicePayload(payload, originPolicy)
    case 4:
      return normalizeVideoPayload(payload, originPolicy)
    case 1:
      return invalid('messageType 无效')
  }
}

// 校验图片消息载荷字段。
function normalizeImagePayload(
  payload: Record<string, unknown>,
  originPolicy: ChatMediaOriginPolicy,
): NormalizeMediaPayloadResult {
  const keyResult = ensureAllowedPayloadKeys(payload, [
    'filePath',
    'fileCategory',
    'mimeType',
    'fileSize',
    'width',
    'height',
    'originalName',
  ])
  if (!keyResult.ok) {
    return keyResult
  }

  const commonResult = normalizeCommonMediaPayload(payload, 'image', 'image/')
  if (!commonResult.ok) {
    return commonResult
  }
  if (!originPolicy.accepts(commonResult.value.filePath, 'image')) {
    return invalid('媒体文件来源无效')
  }

  const widthResult = normalizeOptionalPositiveSafeInteger(
    payload.width,
    'width',
  )
  if (!widthResult.ok) {
    return widthResult
  }
  const heightResult = normalizeOptionalPositiveSafeInteger(
    payload.height,
    'height',
  )
  if (!heightResult.ok) {
    return heightResult
  }

  const normalized: ImageChatMessagePayload = {
    ...commonResult.value,
    fileCategory: 'image',
    ...(widthResult.value === undefined ? {} : { width: widthResult.value }),
    ...(heightResult.value === undefined ? {} : { height: heightResult.value }),
  }
  return { ok: true, value: normalized }
}

// 校验语音消息载荷字段。
function normalizeVoicePayload(
  payload: Record<string, unknown>,
  originPolicy: ChatMediaOriginPolicy,
): NormalizeMediaPayloadResult {
  const keyResult = ensureAllowedPayloadKeys(payload, [
    'filePath',
    'fileCategory',
    'mimeType',
    'fileSize',
    'durationSeconds',
    'originalName',
  ])
  if (!keyResult.ok) {
    return keyResult
  }

  const commonResult = normalizeCommonMediaPayload(payload, 'audio', 'audio/')
  if (!commonResult.ok) {
    return commonResult
  }
  if (!originPolicy.accepts(commonResult.value.filePath, 'audio')) {
    return invalid('媒体文件来源无效')
  }

  const durationResult = normalizePositiveFiniteNumber(
    payload.durationSeconds,
    'durationSeconds',
  )
  if (!durationResult.ok) {
    return durationResult
  }

  const normalized: VoiceChatMessagePayload = {
    ...commonResult.value,
    fileCategory: 'audio',
    durationSeconds: durationResult.value,
  }
  return { ok: true, value: normalized }
}

// 校验视频消息载荷字段。
function normalizeVideoPayload(
  payload: Record<string, unknown>,
  originPolicy: ChatMediaOriginPolicy,
): NormalizeMediaPayloadResult {
  const keyResult = ensureAllowedPayloadKeys(payload, [
    'filePath',
    'fileCategory',
    'mimeType',
    'fileSize',
    'durationSeconds',
    'width',
    'height',
    'originalName',
  ])
  if (!keyResult.ok) {
    return keyResult
  }

  const commonResult = normalizeCommonMediaPayload(payload, 'video', 'video/')
  if (!commonResult.ok) {
    return commonResult
  }
  if (!originPolicy.accepts(commonResult.value.filePath, 'video')) {
    return invalid('媒体文件来源无效')
  }

  const durationResult = normalizeOptionalPositiveFiniteNumber(
    payload.durationSeconds,
    'durationSeconds',
  )
  if (!durationResult.ok) {
    return durationResult
  }
  const widthResult = normalizeOptionalPositiveSafeInteger(
    payload.width,
    'width',
  )
  if (!widthResult.ok) {
    return widthResult
  }
  const heightResult = normalizeOptionalPositiveSafeInteger(
    payload.height,
    'height',
  )
  if (!heightResult.ok) {
    return heightResult
  }

  const normalized: VideoChatMessagePayload = {
    ...commonResult.value,
    fileCategory: 'video',
    ...(durationResult.value === undefined
      ? {}
      : { durationSeconds: durationResult.value }),
    ...(widthResult.value === undefined ? {} : { width: widthResult.value }),
    ...(heightResult.value === undefined ? {} : { height: heightResult.value }),
  }
  return { ok: true, value: normalized }
}

// 校验媒体载荷通用字段。
function normalizeCommonMediaPayload(
  payload: Record<string, unknown>,
  fileCategory: 'image' | 'audio' | 'video',
  mimePrefix: 'image/' | 'audio/' | 'video/',
) {
  if (payload.fileCategory !== fileCategory) {
    return invalid('媒体文件分类无效')
  }
  if (typeof payload.filePath !== 'string' || !payload.filePath.trim()) {
    return invalid('媒体文件路径不能为空')
  }
  if (typeof payload.mimeType !== 'string' || !payload.mimeType.trim()) {
    return invalid('媒体 MIME 类型不能为空')
  }
  const mimeType = payload.mimeType.trim().toLowerCase()
  if (!mimeType.startsWith(mimePrefix)) {
    return invalid('媒体 MIME 类型无效')
  }
  const fileSizeResult = normalizePositiveSafeInteger(
    payload.fileSize,
    'fileSize',
  )
  if (!fileSizeResult.ok) {
    return fileSizeResult
  }
  const originalNameResult = normalizeOptionalString(
    payload.originalName,
    'originalName',
  )
  if (!originalNameResult.ok) {
    return originalNameResult
  }

  return {
    ok: true,
    value: {
      filePath: payload.filePath.trim(),
      mimeType,
      fileSize: fileSizeResult.value,
      ...(originalNameResult.value === undefined
        ? {}
        : { originalName: originalNameResult.value }),
    },
  } as const
}

// 校验扩展载荷序列化大小。
function ensurePayloadSize(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload)
  if (Buffer.byteLength(json, 'utf8') > CHAT_MESSAGE_PAYLOAD_MAX_BYTES) {
    return invalid(
      `payload 序列化后不能超过 ${CHAT_MESSAGE_PAYLOAD_MAX_BYTES} 字节`,
    )
  }
  return { ok: true } as const
}

// 校验媒体载荷顶层字段白名单。
function ensureAllowedPayloadKeys(
  payload: Record<string, unknown>,
  allowedKeys: string[],
) {
  const allowedKeySet = new Set(allowedKeys)
  const unknownKey = Object.keys(payload).find((key) => !allowedKeySet.has(key))
  if (unknownKey) {
    return invalid(`payload 包含不支持的字段: ${unknownKey}`)
  }
  return { ok: true } as const
}

// 校验必填正安全整数。
function normalizePositiveSafeInteger(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return invalid(`${fieldName} 必须是正整数`)
  }
  return { ok: true, value } as const
}

// 校验可选正安全整数。
function normalizeOptionalPositiveSafeInteger(
  value: unknown,
  fieldName: string,
) {
  if (value === undefined) {
    return { ok: true, value: undefined } as const
  }
  return normalizePositiveSafeInteger(value, fieldName)
}

// 校验必填正有限数。
function normalizePositiveFiniteNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return invalid(`${fieldName} 必须是正数`)
  }
  return { ok: true, value } as const
}

// 校验可选正有限数。
function normalizeOptionalPositiveFiniteNumber(
  value: unknown,
  fieldName: string,
) {
  if (value === undefined) {
    return { ok: true, value: undefined } as const
  }
  return normalizePositiveFiniteNumber(value, fieldName)
}

// 校验可选字符串字段。
function normalizeOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return { ok: true, value: undefined } as const
  }
  if (typeof value !== 'string') {
    return invalid(`${fieldName} 必须是字符串`)
  }
  return { ok: true, value: value.trim() } as const
}

// 递归判断值是否可安全序列化为聊天消息 JSON 载荷。
function isJsonSafeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): boolean {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (depth > CHAT_MESSAGE_PAYLOAD_MAX_DEPTH) {
    return false
  }

  if (!Array.isArray(value) && !isPlainObject(value)) {
    return false
  }

  if (seen.has(value)) {
    return false
  }

  seen.add(value)
  const children = Array.isArray(value) ? value : Object.values(value)
  return children.every((item) => isJsonSafeValue(item, depth + 1, seen))
}

// 判断值是否为普通对象，排除数组、null 和类实例。
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// 判断数字值是否属于客户端可发送消息类型。
function isChatSendMessageType(value: number): value is ChatSendMessageType {
  return (CHAT_SENDABLE_MESSAGE_TYPES as readonly number[]).includes(value)
}

// 构造边界校验失败结果。
function invalid(message: string) {
  return {
    ok: false,
    message,
  } as const
}

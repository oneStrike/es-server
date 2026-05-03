import type {
  ChatMessageSendBoundaryInput,
  ChatMessageSendBoundaryResult,
  NormalizeClientMessageIdResult,
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
  ChatMessageTypeEnum,
} from './chat.constant'

// 校验并规范化聊天消息发送输入，供 WS ack 分支复用非抛错结果。
export function normalizeChatMessageSendInput(
  input: ChatMessageSendBoundaryInput,
): ChatMessageSendBoundaryResult {
  const conversationId = Number(input.conversationId)
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return invalid('conversationId 必须是正整数')
  }

  const messageType = Number(input.messageType)
  if (
    messageType !== ChatMessageTypeEnum.TEXT &&
    messageType !== ChatMessageTypeEnum.IMAGE
  ) {
    return invalid('messageType 无效')
  }

  if (typeof input.content !== 'string') {
    return invalid('消息内容不能为空')
  }

  const content = input.content.trim()
  if (!content) {
    return invalid('消息内容不能为空')
  }

  if (content.length > CHAT_MESSAGE_CONTENT_MAX_LENGTH) {
    return invalid(
      `消息内容最长不能超过 ${CHAT_MESSAGE_CONTENT_MAX_LENGTH} 个字符`,
    )
  }

  const clientMessageIdResult = normalizeClientMessageId(input.clientMessageId)
  if (!clientMessageIdResult.ok) {
    return clientMessageIdResult
  }

  const payloadResult = normalizePayload(input.payload)
  if (!payloadResult.ok) {
    return payloadResult
  }

  return {
    ok: true,
    value: {
      conversationId,
      messageType,
      content,
      clientMessageId: clientMessageIdResult.value,
      payloadObject: payloadResult.value?.object,
      payloadJson: payloadResult.value?.json,
    },
  }
}

// 校验并规范化聊天消息发送输入，供 service 入口复用 Nest 异常语义。
export function assertChatMessageSendInput(
  input: ChatMessageSendBoundaryInput,
) {
  const result = normalizeChatMessageSendInput(input)
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

// 规范化字符串或对象形式的扩展载荷。
function normalizePayload(payload: unknown): NormalizePayloadResult {
  if (payload === undefined) {
    return { ok: true }
  }

  if (typeof payload === 'string') {
    if (!payload.trim()) {
      return { ok: true }
    }

    try {
      return normalizePayloadObject(JSON.parse(payload) as unknown)
    } catch {
      return invalid('payload 不是有效的 JSON 格式')
    }
  }

  return normalizePayloadObject(payload)
}

// 校验扩展载荷对象的 JSON 安全性、嵌套深度和序列化大小。
function normalizePayloadObject(
  payload: unknown,
): NormalizePayloadObjectResult {
  if (!isPlainObject(payload)) {
    return invalid('payload 必须是 JSON 对象')
  }

  if (!isJsonSafeValue(payload, 1, new WeakSet<object>())) {
    return invalid(
      `payload 深度不能超过 ${CHAT_MESSAGE_PAYLOAD_MAX_DEPTH} 且必须是 JSON 可序列化值`,
    )
  }

  const json = JSON.stringify(payload)
  if (Buffer.byteLength(json, 'utf8') > CHAT_MESSAGE_PAYLOAD_MAX_BYTES) {
    return invalid(
      `payload 序列化后不能超过 ${CHAT_MESSAGE_PAYLOAD_MAX_BYTES} 字节`,
    )
  }

  return {
    ok: true,
    value: {
      object: payload,
      json,
    },
  }
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

// 构造边界校验失败结果。
function invalid(message: string) {
  return {
    ok: false,
    message,
  } as const
}

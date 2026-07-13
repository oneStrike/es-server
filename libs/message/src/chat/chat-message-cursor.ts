import type {
  ChatMessageCursorPayload,
  ChatMessageCursorScope,
  DecodeChatMessageCursorInput,
  EncodeChatMessageCursorInput,
} from './chat-message-cursor.type'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'
import { CHAT_READABLE_MESSAGE_STATUSES } from './chat.constant'

const CHAT_MESSAGE_CURSOR_VERSION = 1
const CHAT_MESSAGE_CURSOR_ENDPOINT =
  'GET /app/message/chat/conversation/messages'
const CHAT_MESSAGE_CURSOR_DIRECTION = 'before'
const CHAT_MESSAGE_CURSOR_ORDER_TUPLE = [
  'conversationId',
  'messageSeq',
] as const
const CHAT_MESSAGE_CURSOR_MAX_LENGTH = 512
const BASE64URL_SEGMENT_REGEX = /^[\w-]+$/
const MESSAGE_SEQUENCE_REGEX = /^\d+$/

/**
 * 会话历史分页游标。
 *
 * token 的可见 payload 只包含边界 messageSeq；签名额外绑定当前用户、会话、
 * 可读状态、排序方向和端点，因此不能跨用户、会话或查询语义重放。
 */
export class ChatMessageCursor {
  // 使用服务端专用密钥生成并验证游标签名。
  constructor(private readonly secret: string) {}

  // 将边界消息序号编码为绑定当前会话查询语义的防篡改游标。
  encode(input: EncodeChatMessageCursorInput): string {
    if (input.boundaryMessageSeq < 0n) {
      throw new Error('chat message cursor boundary must be non-negative')
    }

    const encodedPayload = Buffer.from(
      JSON.stringify({
        boundaryMessageSeq: input.boundaryMessageSeq.toString(),
      } satisfies ChatMessageCursorPayload),
      'utf8',
    ).toString('base64url')
    const signature = this.createSignature(encodedPayload, input)

    return `${encodedPayload}.${signature}`
  }

  // 验证游标完整性并还原下一页查询的边界消息序号。
  decode(input: DecodeChatMessageCursorInput): bigint {
    const cursor = input.cursor.trim()
    if (cursor.length === 0 || cursor.length > CHAT_MESSAGE_CURSOR_MAX_LENGTH) {
      return this.invalidCursor()
    }

    const segments = cursor.split('.')
    if (
      segments.length !== 2 ||
      !BASE64URL_SEGMENT_REGEX.test(segments[0]) ||
      !BASE64URL_SEGMENT_REGEX.test(segments[1])
    ) {
      return this.invalidCursor()
    }

    const [encodedPayload, receivedSignature] = segments
    const expectedSignature = this.createSignature(encodedPayload, input)
    if (!this.signaturesMatch(expectedSignature, receivedSignature)) {
      return this.invalidCursor()
    }

    return this.decodeBoundaryMessageSeq(encodedPayload)
  }

  // 将 payload 与查询范围共同纳入签名，防止游标跨会话或查询语义重放。
  private createSignature(
    encodedPayload: string,
    scope: ChatMessageCursorScope,
  ) {
    return createHmac('sha256', this.secret)
      .update(
        [
          CHAT_MESSAGE_CURSOR_VERSION,
          encodedPayload,
          this.createContextFingerprint(scope),
        ].join('.'),
        'utf8',
      )
      .digest('base64url')
  }

  // 固定会影响结果集的查询语义，作为签名输入的一部分。
  private createContextFingerprint(scope: ChatMessageCursorScope) {
    return JSON.stringify({
      version: CHAT_MESSAGE_CURSOR_VERSION,
      endpoint: CHAT_MESSAGE_CURSOR_ENDPOINT,
      authenticatedUserId: scope.authenticatedUserId,
      conversationId: scope.conversationId,
      readableStatusFilter: CHAT_READABLE_MESSAGE_STATUSES,
      direction: CHAT_MESSAGE_CURSOR_DIRECTION,
      orderTuple: CHAT_MESSAGE_CURSOR_ORDER_TUPLE,
    })
  }

  // 使用恒定时间比较相同长度的签名，避免泄露有效签名的前缀信息。
  private signaturesMatch(expected: string, received: string) {
    const expectedBuffer = Buffer.from(expected, 'base64url')
    const receivedBuffer = Buffer.from(received, 'base64url')

    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    )
  }

  // 仅接受预期的单字段 payload，避免畸形或扩展字段改变分页语义。
  private decodeBoundaryMessageSeq(encodedPayload: string): bigint {
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      )
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return this.invalidCursor()
      }
      const payload = parsed as Record<string, unknown>
      if (
        Object.keys(payload).length !== 1 ||
        !Object.hasOwn(payload, 'boundaryMessageSeq') ||
        typeof payload.boundaryMessageSeq !== 'string' ||
        !MESSAGE_SEQUENCE_REGEX.test(payload.boundaryMessageSeq)
      ) {
        return this.invalidCursor()
      }

      return BigInt(payload.boundaryMessageSeq)
    } catch {
      return this.invalidCursor()
    }
  }

  // 统一向调用方暴露不可区分的无效游标错误。
  private invalidCursor(): never {
    throw new BadRequestException('cursor 无效或已失效')
  }
}

import type { JsonValue } from '@libs/platform/utils/jsonParse'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { PickType } from '@nestjs/swagger'
import {
  ChatMessageTypeEnum,
} from '../chat.constant'

export class OpenDirectConversationDto {
  @NumberProperty({
    description: '目标用户 ID',
    example: 10002,
  })
  targetUserId!: number
}

class BaseChatConversationMessagesQueryDto {
  @NumberProperty({
    description: '会话 ID',
    example: 1,
  })
  conversationId!: number

  @StringProperty({
    description: '分页游标，使用上一页最小 messageSeq',
    example: '120',
    required: false,
  })
  cursor?: string

  @StringProperty({
    description: '补偿游标，获取 messageSeq > afterSeq 的消息',
    example: '120',
    required: false,
  })
  afterSeq?: string

  @NumberProperty({
    description: '分页大小',
    example: 20,
    required: false,
    min: 1,
    max: 100,
    default: 20,
  })
  limit?: number
}

export class QueryChatConversationMessagesDto extends PickType(
  BaseChatConversationMessagesQueryDto,
  ['conversationId', 'cursor', 'afterSeq', 'limit'] as const,
) {}

export class SendChatMessageDto {
  @NumberProperty({
    description: '会话 ID',
    example: 1,
  })
  conversationId!: number

  @EnumProperty({
    description: '消息类型（1=文本；2=图片）',
    example: ChatMessageTypeEnum.TEXT,
    enum: ChatMessageTypeEnum,
  })
  messageType!: ChatMessageTypeEnum

  @StringProperty({
    description: '消息内容',
    example: 'hello',
    maxLength: 5000,
  })
  content!: string

  @StringProperty({
    description: '客户端幂等键',
    example: 'cmsg_9d7a4a0b',
    required: false,
    maxLength: 64,
  })
  clientMessageId?: string

  @JsonProperty({
    description: '扩展载荷',
    example: '{"image":"https://example.com/a.png"}',
    required: false,
  })
  payload?: string
}

export class MarkConversationReadDto {
  @NumberProperty({
    description: '会话 ID',
    example: 1,
  })
  conversationId!: number

  @StringProperty({
    description: '已读消息 ID（BigInt 字符串）',
    example: '123456789',
  })
  messageId!: string
}

/** 聊天对方用户基础信息 */
export class BaseChatPeerDto {
  @NumberProperty({
    description: '用户ID',
    example: 10002,
  })
  id!: number

  @StringProperty({
    description: '昵称',
    example: 'Tom',
    required: false,
    maxLength: 100,
  })
  nickname?: string

  @StringProperty({
    description: '头像地址',
    example: 'https://example.com/avatar.png',
    required: false,
    maxLength: 500,
  })
  avatar?: string
}

/** 聊天消息基础数据传输对象 */
export class BaseChatMessageDto {
  @StringProperty({
    description: '消息ID（BigInt）',
    example: '123456789',
  })
  id!: string

  @NumberProperty({
    description: '会话ID',
    example: 1,
  })
  conversationId!: number

  @StringProperty({
    description: '会话消息序列号（BigInt）',
    example: '1',
  })
  messageSeq!: string

  @NumberProperty({
    description: '发送者用户ID',
    example: 10001,
  })
  senderId!: number

  @EnumProperty({
    description: '消息类型（1=文本,2=图片）',
    example: ChatMessageTypeEnum.TEXT,
    enum: ChatMessageTypeEnum,
  })
  messageType!: ChatMessageTypeEnum

  @StringProperty({
    description: '消息内容',
    example: 'hello',
    maxLength: 5000,
  })
  content!: string

  @JsonProperty({
    description: '消息正文解析 token（EmojiParser 输出）',
    required: false,
    validation: false,
    example: [
      { type: 'text', text: 'hello ' },
      { type: 'emojiUnicode', unicodeSequence: '😀', emojiAssetId: 1001 },
    ],
  })
  bodyTokens?: JsonValue

  @StringProperty({
    description: '客户端幂等键',
    example: 'cmsg_9d7a4a0b',
    required: false,
    maxLength: 64,
  })
  clientMessageId?: string

  @JsonProperty({
    description: '扩展载荷',
    example: '{"image":"https://example.com/a.png"}',
    required: false,
  })
  payload?: string

  @DateProperty({
    description: '创建时间',
    example: '2026-03-07T12:00:00.000Z',
  })
  createdAt!: Date
}

/** 聊天会话基础数据传输对象 */
export class BaseChatConversationDto {
  @NumberProperty({
    description: '会话ID',
    example: 1,
  })
  id!: number

  @StringProperty({
    description: '业务键',
    example: 'direct:10001:10002',
    maxLength: 100,
    contract: false,
  })
  bizKey!: string

  @NumberProperty({
    description: '未读消息数',
    example: 2,
  })
  unreadCount!: number

  @StringProperty({
    description: '最后消息ID（BigInt）',
    example: '123456',
    required: false,
  })
  lastMessageId?: string

  @DateProperty({
    description: '最后消息时间',
    example: '2026-03-07T12:00:00.000Z',
    required: false,
  })
  lastMessageAt?: Date

  @NumberProperty({
    description: '最后发送者ID',
    example: 10001,
    required: false,
  })
  lastSenderId?: number

  @StringProperty({
    description: '最后消息内容',
    example: 'hello',
    required: false,
    maxLength: 5000,
  })
  lastMessageContent?: string

  @DateProperty({
    description: '当前用户最后阅读时间',
    example: '2026-03-07T12:00:00.000Z',
    required: false,
  })
  lastReadAt?: Date

  @StringProperty({
    description: '当前用户最后阅读消息ID（BigInt）',
    example: '123455',
    required: false,
  })
  lastReadMessageId?: string

  peerUser?: BaseChatPeerDto
}

/**
 * 会话 DTO。
 */
export class ChatConversationDto extends BaseChatConversationDto {
  @NestedProperty({
    description: '对端用户',
    type: BaseChatPeerDto,
    required: false,
    validation: false,
    nullable: false,
  })
  declare peerUser: BaseChatPeerDto
}

/**
 * 会话消息分页响应 DTO。
 */
export class ChatConversationMessagesResponseDto {
  @ArrayProperty({
    description: '消息列表',
    itemClass: BaseChatMessageDto,
    validation: false,
  })
  list!: BaseChatMessageDto[]

  @StringProperty({
    description: '下一页游标',
    example: '120',
    required: false,
    validation: false,
  })
  nextCursor?: string | null

  @BooleanProperty({
    description: '是否还有更多消息',
    example: true,
    validation: false,
  })
  hasMore!: boolean
}

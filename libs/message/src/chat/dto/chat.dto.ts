import {
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  ChatMessageTypeEnum,
} from '../chat.constant'

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
    description: '消息类型（1=文本,2=图片,3=系统）',
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
      { type: 'emojiUnicode', unicodeSequence: '😀' },
    ],
  })
  bodyTokens?: unknown

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

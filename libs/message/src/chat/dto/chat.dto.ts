import type { ReferenceObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  PickType,
} from '@nestjs/swagger'
import {
  CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH,
  CHAT_MESSAGE_CONTENT_MAX_LENGTH,
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
    maxLength: CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  })
  content!: string

  @StringProperty({
    description: '客户端幂等键',
    example: 'cmsg_9d7a4a0b',
    required: false,
    maxLength: CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH,
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

/** 聊天消息普通文本 token */
export class ChatMessageBodyTextTokenDto {
  @StringProperty({
    description: 'token 类型',
    example: 'text',
    validation: false,
  })
  type!: 'text'

  @StringProperty({
    description: '文本内容',
    example: 'hello ',
    validation: false,
  })
  text!: string
}

/** 聊天消息用户提及 token */
export class ChatMessageBodyMentionUserTokenDto {
  @StringProperty({
    description: 'token 类型',
    example: 'mentionUser',
    validation: false,
  })
  type!: 'mentionUser'

  @NumberProperty({
    description: '被提及用户 ID',
    example: 10002,
    validation: false,
  })
  userId!: number

  @StringProperty({
    description: '被提及用户昵称',
    example: 'Tom',
    validation: false,
  })
  nickname!: string

  @StringProperty({
    description: '原始提及文本',
    example: '@Tom',
    validation: false,
  })
  text!: string
}

/** 聊天消息 Unicode 表情 token */
export class ChatMessageBodyEmojiUnicodeTokenDto {
  @StringProperty({
    description: 'token 类型',
    example: 'emojiUnicode',
    validation: false,
  })
  type!: 'emojiUnicode'

  @StringProperty({
    description: 'Unicode 表情序列',
    example: '😀',
    validation: false,
  })
  unicodeSequence!: string

  @NumberProperty({
    description: '关联表情资源 ID',
    example: 1001,
    required: false,
    validation: false,
  })
  emojiAssetId?: number
}

/** 聊天消息自定义表情 token */
export class ChatMessageBodyEmojiCustomTokenDto {
  @StringProperty({
    description: 'token 类型',
    example: 'emojiCustom',
    validation: false,
  })
  type!: 'emojiCustom'

  @StringProperty({
    description: '自定义表情 shortcode',
    example: 'party',
    validation: false,
  })
  shortcode!: string

  @NumberProperty({
    description: '关联表情资源 ID',
    example: 1002,
    required: false,
    validation: false,
  })
  emojiAssetId?: number

  @StringProperty({
    description: '表情包编码',
    example: 'default',
    required: false,
    validation: false,
  })
  packCode?: string

  @StringProperty({
    description: '动图地址',
    example: 'https://example.com/emoji/party.gif',
    required: false,
    validation: false,
  })
  imageUrl?: string

  @StringProperty({
    description: '静态图地址',
    example: 'https://example.com/emoji/party.png',
    required: false,
    validation: false,
  })
  staticUrl?: string

  @BooleanProperty({
    description: '是否为动图',
    example: true,
    required: false,
    validation: false,
  })
  isAnimated?: boolean

  @StringProperty({
    description: '无障碍文本',
    example: 'party',
    required: false,
    validation: false,
  })
  ariaLabel?: string
}

/** 聊天消息论坛话题 token */
export class ChatMessageBodyForumHashtagTokenDto {
  @StringProperty({
    description: 'token 类型',
    example: 'forumHashtag',
    validation: false,
  })
  type!: 'forumHashtag'

  @NumberProperty({
    description: '话题 ID',
    example: 20001,
    validation: false,
  })
  hashtagId!: number

  @StringProperty({
    description: '话题 slug',
    example: 'weekly-reading',
    validation: false,
  })
  slug!: string

  @StringProperty({
    description: '话题展示名称',
    example: '每周阅读',
    validation: false,
  })
  displayName!: string

  @StringProperty({
    description: '原始话题文本',
    example: '#每周阅读',
    validation: false,
  })
  text!: string
}

// 生成聊天消息 bodyTokens 的 Swagger oneOf schema 引用。
function createChatMessageBodyTokenOneOfSchemas() {
  return [
    { $ref: getSchemaPath(ChatMessageBodyTextTokenDto) },
    { $ref: getSchemaPath(ChatMessageBodyMentionUserTokenDto) },
    { $ref: getSchemaPath(ChatMessageBodyEmojiUnicodeTokenDto) },
    { $ref: getSchemaPath(ChatMessageBodyEmojiCustomTokenDto) },
    { $ref: getSchemaPath(ChatMessageBodyForumHashtagTokenDto) },
  ] satisfies ReferenceObject[]
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
@ApiExtraModels(
  ChatMessageBodyTextTokenDto,
  ChatMessageBodyMentionUserTokenDto,
  ChatMessageBodyEmojiUnicodeTokenDto,
  ChatMessageBodyEmojiCustomTokenDto,
  ChatMessageBodyForumHashtagTokenDto,
)
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
    maxLength: CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  })
  content!: string

  @ApiProperty({
    description:
      '消息正文语义 token；用于渲染普通文本、提及、话题与表情。当前聊天发送链路主要产生 text/emoji token，历史空值会被省略。',
    required: false,
    type: 'array',
    items: {
      oneOf: createChatMessageBodyTokenOneOfSchemas(),
    },
    example: [
      { type: 'text', text: 'hello ' },
      { type: 'emojiUnicode', unicodeSequence: '😀', emojiAssetId: 1001 },
    ],
  })
  bodyTokens?: Array<
    | ChatMessageBodyTextTokenDto
    | ChatMessageBodyMentionUserTokenDto
    | ChatMessageBodyEmojiUnicodeTokenDto
    | ChatMessageBodyEmojiCustomTokenDto
    | ChatMessageBodyForumHashtagTokenDto
  >

  @StringProperty({
    description: '客户端幂等键',
    example: 'cmsg_9d7a4a0b',
    required: false,
    maxLength: CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH,
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
    maxLength: CHAT_MESSAGE_CONTENT_MAX_LENGTH,
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

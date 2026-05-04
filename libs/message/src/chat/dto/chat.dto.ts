import type { JsonObject } from '@libs/platform/utils'
import type { ReferenceObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
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
  CHAT_SENDABLE_MESSAGE_TYPES,
  ChatMessageTypeEnum,
  ChatSendMessageTypeEnum,
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

/** 图片聊天消息载荷 */
export class ImageChatMessagePayloadDto {
  @StringProperty({
    description: '上传接口返回的文件路径',
    example: '/files/chat/image/2026-05-04/photo-1200x800.png',
    validation: false,
  })
  filePath!: string

  @StringProperty({
    description: '文件分类，图片固定为 image',
    example: 'image',
    validation: false,
  })
  fileCategory!: 'image'

  @StringProperty({
    description: '文件 MIME 类型',
    example: 'image/png',
    validation: false,
  })
  mimeType!: string

  @NumberProperty({
    description: '文件大小',
    example: 102400,
    validation: false,
  })
  fileSize!: number

  @NumberProperty({
    description: '图片宽度',
    example: 1200,
    required: false,
    validation: false,
  })
  width?: number

  @NumberProperty({
    description: '图片高度',
    example: 800,
    required: false,
    validation: false,
  })
  height?: number

  @StringProperty({
    description: '原始文件名',
    example: 'photo.png',
    required: false,
    validation: false,
  })
  originalName?: string
}

/** 语音聊天消息载荷 */
export class VoiceChatMessagePayloadDto {
  @StringProperty({
    description: '上传接口返回的文件路径',
    example: '/files/chat/audio/2026-05-04/voice.mp3',
    validation: false,
  })
  filePath!: string

  @StringProperty({
    description: '文件分类，语音固定为 audio',
    example: 'audio',
    validation: false,
  })
  fileCategory!: 'audio'

  @StringProperty({
    description: '文件 MIME 类型',
    example: 'audio/mpeg',
    validation: false,
  })
  mimeType!: string

  @NumberProperty({
    description: '文件大小',
    example: 204800,
    validation: false,
  })
  fileSize!: number

  @NumberProperty({
    description: '语音时长（秒）',
    example: 12.5,
    validation: false,
  })
  durationSeconds!: number

  @StringProperty({
    description: '原始文件名',
    example: 'voice.mp3',
    required: false,
    validation: false,
  })
  originalName?: string
}

/** 视频聊天消息载荷 */
export class VideoChatMessagePayloadDto {
  @StringProperty({
    description: '上传接口返回的文件路径',
    example: '/files/chat/video/2026-05-04/clip.mp4',
    validation: false,
  })
  filePath!: string

  @StringProperty({
    description: '文件分类，视频固定为 video',
    example: 'video',
    validation: false,
  })
  fileCategory!: 'video'

  @StringProperty({
    description: '文件 MIME 类型',
    example: 'video/mp4',
    validation: false,
  })
  mimeType!: string

  @NumberProperty({
    description: '文件大小',
    example: 4096000,
    validation: false,
  })
  fileSize!: number

  @NumberProperty({
    description: '视频时长（秒）',
    example: 30.5,
    required: false,
    validation: false,
  })
  durationSeconds?: number

  @NumberProperty({
    description: '视频宽度',
    example: 1920,
    required: false,
    validation: false,
  })
  width?: number

  @NumberProperty({
    description: '视频高度',
    example: 1080,
    required: false,
    validation: false,
  })
  height?: number

  @StringProperty({
    description: '原始文件名',
    example: 'clip.mp4',
    required: false,
    validation: false,
  })
  originalName?: string
}

// 生成聊天消息 payload 的 Swagger anyOf schema 引用。
function createChatMessagePayloadAnyOfSchemas() {
  return [
    { type: 'object', additionalProperties: true },
    { $ref: getSchemaPath(ImageChatMessagePayloadDto) },
    { $ref: getSchemaPath(VoiceChatMessagePayloadDto) },
    { $ref: getSchemaPath(VideoChatMessagePayloadDto) },
  ]
}

@ApiExtraModels(
  ImageChatMessagePayloadDto,
  VoiceChatMessagePayloadDto,
  VideoChatMessagePayloadDto,
)
export class SendChatMessageDto {
  @NumberProperty({
    description: '会话 ID',
    example: 1,
  })
  conversationId!: number

  @EnumProperty({
    description: '客户端可发送消息类型（1=文本；2=图片；3=语音；4=视频）',
    example: ChatSendMessageTypeEnum.TEXT,
    enum: ChatSendMessageTypeEnum,
  })
  messageType!: (typeof CHAT_SENDABLE_MESSAGE_TYPES)[number]

  @StringProperty({
    description: '消息内容；文本必填，图片/语音/视频可省略并规范化为空字符串',
    example: 'hello',
    required: false,
    maxLength: CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  })
  content?: string

  @StringProperty({
    description: '客户端幂等键',
    example: 'cmsg_9d7a4a0b',
    required: false,
    maxLength: CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH,
  })
  clientMessageId?: string

  @ApiProperty({
    description:
      '扩展载荷；文本消息可传普通 JSON 对象，图片/语音/视频必须传对应媒体载荷对象且来自 scene=chat 上传结果。',
    anyOf: createChatMessagePayloadAnyOfSchemas(),
    example: {
      filePath: '/files/chat/image/2026-05-04/photo-1200x800.png',
      fileCategory: 'image',
      mimeType: 'image/png',
      fileSize: 102400,
      width: 1200,
      height: 800,
      originalName: 'photo.png',
    },
    required: false,
  })
  payload?:
    | JsonObject
    | ImageChatMessagePayloadDto
    | VoiceChatMessagePayloadDto
    | VideoChatMessagePayloadDto
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

// 生成聊天消息 bodyTokens 的 Swagger oneOf schema 引用。
function createChatMessageBodyTokenOneOfSchemas() {
  return [
    { $ref: getSchemaPath(ChatMessageBodyTextTokenDto) },
    { $ref: getSchemaPath(ChatMessageBodyEmojiUnicodeTokenDto) },
    { $ref: getSchemaPath(ChatMessageBodyEmojiCustomTokenDto) },
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
  ChatMessageBodyEmojiUnicodeTokenDto,
  ChatMessageBodyEmojiCustomTokenDto,
  ImageChatMessagePayloadDto,
  VoiceChatMessagePayloadDto,
  VideoChatMessagePayloadDto,
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
    description: '消息类型（1=文本；2=图片；3=语音；4=视频；99=系统）',
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
      '文本消息正文语义 token；用于渲染普通文本与表情。媒体消息和历史空值会被省略。',
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
    | ChatMessageBodyEmojiUnicodeTokenDto
    | ChatMessageBodyEmojiCustomTokenDto
  >

  @StringProperty({
    description: '客户端幂等键',
    example: 'cmsg_9d7a4a0b',
    required: false,
    maxLength: CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH,
  })
  clientMessageId?: string

  @ApiProperty({
    description:
      '扩展载荷；文本/系统消息为普通 JSON 对象，媒体消息为图片/语音/视频载荷对象。',
    anyOf: createChatMessagePayloadAnyOfSchemas(),
    example: {
      filePath: '/files/chat/image/2026-05-04/photo-1200x800.png',
      fileCategory: 'image',
      mimeType: 'image/png',
      fileSize: 102400,
      width: 1200,
      height: 800,
      originalName: 'photo.png',
    },
    required: false,
  })
  payload?:
    | JsonObject
    | ImageChatMessagePayloadDto
    | VoiceChatMessagePayloadDto
    | VideoChatMessagePayloadDto

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

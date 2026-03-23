import {
  BaseChatConversationDto,
  BaseChatMessageDto,
  BaseChatPeerDto,
} from '@libs/message/chat'
import {
  BaseUserNotificationDto,
  MessageNotificationTypeEnum,
} from '@libs/message/notification'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'

export class OpenDirectConversationDto {
  @NumberProperty({
    description: '目标用户ID',
    example: 10002,
  })
  targetUserId!: number
}

export class QueryChatConversationListDto extends PageDto {}

export class QueryChatConversationMessagesDto {
  @NumberProperty({
    description: '会话ID',
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

export class QueryUserNotificationListDto extends PageDto {
  @BooleanProperty({
    description: '是否已读',
    required: false,
    example: false,
  })
  isRead?: boolean

  @EnumProperty({
    description: '通知类型',
    required: false,
    example: MessageNotificationTypeEnum.COMMENT_REPLY,
    enum: MessageNotificationTypeEnum,
  })
  type?: MessageNotificationTypeEnum
}

export class QueryInboxTimelineDto extends PageDto {}

export class ChatPeerDto extends BaseChatPeerDto {}

export class ChatConversationDto extends BaseChatConversationDto {
  @NestedProperty({
    description: '对端用户',
    type: ChatPeerDto,
    required: false,
    validation: false,
  })
  declare peerUser?: ChatPeerDto
}

export class ChatConversationMessagesResponseDto {
  @ArrayProperty({
    description: '消息列表',
    itemClass: BaseChatMessageDto,
    itemType: 'object',
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

export class NotificationActorDto {
  @NumberProperty({ description: '用户ID', example: 1, validation: false })
  id!: number

  @StringProperty({
    description: '昵称',
    example: '测试用户',
    required: false,
    validation: false,
  })
  nickname?: string

  @StringProperty({
    description: '头像地址',
    example: 'https://example.com/avatar.png',
    required: false,
    validation: false,
  })
  avatarUrl?: string
}

export class UserNotificationDto extends BaseUserNotificationDto {
  @NestedProperty({
    description: '触发用户信息',
    type: NotificationActorDto,
    required: false,
    validation: false,
  })
  actorUser?: NotificationActorDto
}

export class NotificationUnreadCountDto {
  @NumberProperty({
    description: '未读通知数量',
    example: 3,
    validation: false,
  })
  count!: number
}

export class InboxNotificationBriefDto {
  @NumberProperty({ description: '通知ID', example: 1, validation: false })
  id!: number

  @StringProperty({ description: '通知类型', example: '1', validation: false })
  type!: string

  @StringProperty({ description: '通知标题', example: '收到新的评论回复', validation: false })
  title!: string

  @StringProperty({ description: '通知内容', example: '你收到了一条新的评论回复', validation: false })
  content!: string

  @DateProperty({
    description: '创建时间',
    example: '2026-03-07T12:00:00.000Z',
    validation: false,
  })
  createdAt!: Date
}

export class InboxChatBriefDto {
  @NumberProperty({ description: '会话ID', example: 1, validation: false })
  conversationId!: number

  @StringProperty({
    description: '最后消息ID',
    example: '123456',
    required: false,
    validation: false,
  })
  lastMessageId?: string

  @DateProperty({
    description: '最后消息时间',
    example: '2026-03-07T12:00:00.000Z',
    required: false,
    validation: false,
  })
  lastMessageAt?: Date

  @StringProperty({
    description: '最后消息内容',
    example: 'hello',
    required: false,
    validation: false,
  })
  lastMessageContent?: string

  @NumberProperty({
    description: '最后发送者ID',
    example: 1,
    required: false,
    validation: false,
  })
  lastSenderId?: number
}

export class InboxSummaryDto {
  @NumberProperty({ description: '通知未读数', example: 1, validation: false })
  notificationUnreadCount!: number

  @NumberProperty({ description: '聊天未读数', example: 2, validation: false })
  chatUnreadCount!: number

  @NumberProperty({ description: '总未读数', example: 3, validation: false })
  totalUnreadCount!: number

  @NestedProperty({
    description: '最新通知',
    type: InboxNotificationBriefDto,
    required: false,
    validation: false,
  })
  latestNotification?: InboxNotificationBriefDto

  @NestedProperty({
    description: '最新聊天',
    type: InboxChatBriefDto,
    required: false,
    validation: false,
  })
  latestChat?: InboxChatBriefDto
}

export class InboxTimelineItemDto {
  @StringProperty({
    description: '来源类型',
    example: 'notification',
  })
  sourceType!: 'notification' | 'chat'

  @DateProperty({
    description: '时间',
    example: '2026-03-07T12:00:00.000Z',
  })
  createdAt!: Date

  @StringProperty({
    description: '标题',
    example: '收到新的评论回复',
  })
  title!: string

  @StringProperty({
    description: '摘要',
    example: '你收到了一条新的评论回复',
    required: false,
  })
  content?: string

  @StringProperty({
    description: '业务ID',
    example: 'n:1',
  })
  bizId!: string
}

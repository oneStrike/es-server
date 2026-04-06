import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
/**
 * 收件箱通知摘要 DTO。
 */
export class InboxNotificationBriefDto {
  @NumberProperty({ description: '通知ID', example: 1, validation: false })
  id!: number

  @StringProperty({ description: '通知类型', example: '1', validation: false })
  type!: string

  @StringProperty({
    description: '通知标题',
    example: '收到新的评论回复',
    validation: false,
  })
  title!: string

  @StringProperty({
    description: '通知内容',
    example: '你收到了一条新的评论回复',
    validation: false,
  })
  content!: string

  @DateProperty({
    description: '创建时间',
    example: '2026-03-07T12:00:00.000Z',
    validation: false,
  })
  createdAt!: Date
}

/**
 * 收件箱聊天摘要 DTO。
 */
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

/**
 * 收件箱摘要 DTO。
 */
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
    nullable: false,
  })
  latestNotification!: InboxNotificationBriefDto

  @NestedProperty({
    description: '最新聊天',
    type: InboxChatBriefDto,
    required: false,
    validation: false,
    nullable: false,
  })
  latestChat!: InboxChatBriefDto
}

/**
 * 收件箱时间线项 DTO。
 */
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

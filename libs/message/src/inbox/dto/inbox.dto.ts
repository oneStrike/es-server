import {
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'

export class InboxSummaryDto {
  @NumberProperty({
    description: '通知未读数',
    example: 1,
  })
  notificationUnreadCount: number

  @NumberProperty({
    description: '聊天未读数',
    example: 2,
  })
  chatUnreadCount: number

  @NumberProperty({
    description: '总未读数',
    example: 3,
  })
  totalUnreadCount: number

  latestNotification?: {
    id: number
    type: string
    title: string
    content: string
    createdAt: Date
  }

  latestChat?: {
    conversationId: number
    lastMessageId?: string
    lastMessageAt?: Date
    lastMessageContent?: string
    lastSenderId?: number
  }
}

export class QueryInboxTimelineDto extends PageDto {}

export class InboxTimelineItemDto {
  @StringProperty({
    description: '来源类型',
    example: 'notification',
  })
  sourceType: 'notification' | 'chat'

  @DateProperty({
    description: '时间',
    example: '2026-03-07T12:00:00.000Z',
  })
  createdAt: Date

  @StringProperty({
    description: '标题',
    example: '收到新的评论回复',
  })
  title: string

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
  bizId: string
}

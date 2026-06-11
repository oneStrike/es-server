import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto/page.dto'
import { PickType } from '@nestjs/swagger'

import {
  MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  MessageNotificationCategoryKey,
} from '../../notification/notification.constant'
import { BaseNotificationUnreadDto } from '../../notification/dto/notification-unread.dto'
/**
 * 收件箱通知摘要 DTO。
 */
export class InboxNotificationBriefDto {
  @NumberProperty({ description: '通知ID', example: 1, validation: false })
  id!: number

  @EnumProperty({
    description: '通知分类键，表示通知所属业务分类',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
    validation: false,
  })
  categoryKey!: MessageNotificationCategoryKey

  @StringProperty({
    description: '通知分类中文标签',
    example: '评论回复',
    validation: false,
  })
  categoryLabel!: string

  @StringProperty({
    description: '通知标题',
    example: '收到新的评论回复',
    validation: false,
  })
  title!: string

  @StringProperty({
    description: '通知内容',
    example: '你收到了一条新的评论回复',
    nullable: true,
    validation: false,
  })
  content!: string | null

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
    nullable: true,
    validation: false,
  })
  lastMessageId!: string | null

  @DateProperty({
    description: '最后消息时间',
    example: '2026-03-07T12:00:00.000Z',
    nullable: true,
    validation: false,
  })
  lastMessageAt!: Date | null

  @StringProperty({
    description: '最后消息内容',
    example: 'hello',
    nullable: true,
    validation: false,
  })
  lastMessageContent!: string | null

  @NumberProperty({
    description: '最后发送者ID',
    example: 1,
    nullable: true,
    validation: false,
  })
  lastSenderId!: number | null
}

/**
 * 收件箱摘要 DTO。
 */
export class InboxSummaryDto {
  @NestedProperty({
    description: '通知未读摘要',
    type: BaseNotificationUnreadDto,
    validation: false,
    nullable: false,
  })
  notificationUnread!: BaseNotificationUnreadDto

  @NumberProperty({ description: '聊天未读数', example: 2, validation: false })
  chatUnreadCount!: number

  @NumberProperty({ description: '总未读数', example: 3, validation: false })
  totalUnreadCount!: number

  @NestedProperty({
    description: '最新通知',
    type: InboxNotificationBriefDto,
    validation: false,
    nullable: true,
  })
  latestNotification!: InboxNotificationBriefDto | null

  @NestedProperty({
    description: '最新聊天',
    type: InboxChatBriefDto,
    validation: false,
    nullable: true,
  })
  latestChat!: InboxChatBriefDto | null
}

/**
 * 收件箱时间线项 DTO。
 */
export class InboxTimelineItemDto {
  @StringProperty({
    description: '来源类型',
    example: 'notification',
    validation: false,
  })
  sourceType!: 'notification' | 'chat'

  @DateProperty({
    description: '时间',
    example: '2026-03-07T12:00:00.000Z',
    validation: false,
  })
  createdAt!: Date

  @StringProperty({
    description: '标题',
    example: '收到新的评论回复',
    validation: false,
  })
  title!: string

  @StringProperty({
    description: '摘要',
    example: '你收到了一条新的评论回复',
    validation: false,
  })
  content!: string

  @StringProperty({
    description: '业务ID',
    example: 'n:1',
    validation: false,
  })
  bizId!: string
}

/**
 * 收件箱时间线查询 DTO。
 * 使用 keyset 游标翻页，避免深页跳页扫描。
 */
export class QueryInboxTimelineDto extends PickType(PageDto, [
  'pageSize',
] as const) {
  @StringProperty({
    description: '下一页游标',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAzLTA3VDEyOjAwOjAwLjAwMFoiLCJiaXpJZCI6Im46MSJ9',
    required: false,
  })
  cursor?: string
}

/**
 * 收件箱时间线游标分页响应 DTO。
 */
export class InboxTimelineResponseDto {
  @ArrayProperty({
    description: '时间线列表',
    itemClass: InboxTimelineItemDto,
    validation: false,
  })
  list!: InboxTimelineItemDto[]

  @StringProperty({
    description: '下一页游标',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAzLTA3VDEyOjAwOjAwLjAwMFoiLCJiaXpJZCI6Im46MSJ9',
    nullable: true,
    validation: false,
  })
  nextCursor!: string | null

  @BooleanProperty({
    description: '是否还有更多消息',
    example: true,
    validation: false,
  })
  hasMore!: boolean

  @NumberProperty({
    description: '本次请求单页大小',
    example: 15,
    validation: false,
  })
  pageSize!: number
}

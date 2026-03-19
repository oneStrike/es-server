import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import {
  ForumNotificationPriorityEnum,
  ForumNotificationTypeEnum,
} from '../forum-notification.constant'

/**
 * 论坛通知基础 DTO。
 * 严格对应 forum_notification 表字段。
 */
export class BaseForumNotificationDto extends IdDto {
  @NumberProperty({
    description: '接收用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @NumberProperty({
    description: '关联主题ID',
    example: 1,
    required: false,
    min: 1,
  })
  topicId?: number | null

  @NumberProperty({
    description: '关联回复ID',
    example: 1,
    required: false,
    min: 1,
  })
  replyId?: number | null

  @EnumProperty({
    description: '通知类型',
    example: ForumNotificationTypeEnum.SYSTEM,
    enum: ForumNotificationTypeEnum,
    required: true,
  })
  type!: ForumNotificationTypeEnum

  @EnumProperty({
    description: '优先级',
    example: ForumNotificationPriorityEnum.LOW,
    enum: ForumNotificationPriorityEnum,
    required: true,
  })
  priority!: ForumNotificationPriorityEnum

  @StringProperty({
    description: '通知标题',
    example: '系统通知',
    required: true,
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '通知内容',
    example: '你有一条新的论坛通知',
    required: true,
    maxLength: 1000,
  })
  content!: string

  @BooleanProperty({
    description: '是否已读',
    example: false,
    required: true,
  })
  isRead!: boolean

  @DateProperty({
    description: '已读时间',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
  })
  readAt?: Date | null

  @DateProperty({
    description: '过期时间',
    example: '2026-03-26T12:00:00.000Z',
    required: false,
  })
  expiredAt?: Date | null

  @DateProperty({
    description: '创建时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import {
  MessageNotificationDispatchStatusEnum,
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from '../notification.constant'

/**
 * 用户通知基础数据传输对象
 */
export class BaseUserNotificationDto {
  @NumberProperty({
    description: '通知ID',
    example: 1,
  })
  id!: number

  @NumberProperty({
    description: '接收用户ID',
    example: 10001,
  })
  userId!: number

  @EnumProperty({
    description: '通知类型',
    example: MessageNotificationTypeEnum.COMMENT_REPLY,
    enum: MessageNotificationTypeEnum,
  })
  type!: MessageNotificationTypeEnum

  @StringProperty({
    description: '业务幂等键',
    example: 'comment:reply:123:to:10001',
    maxLength: 160,
  })
  bizKey!: string

  @NumberProperty({
    description: '触发用户ID',
    example: 10002,
    required: false,
  })
  actorUserId?: number

  @NumberProperty({
    description: '目标类型',
    example: 5,
    required: false,
  })
  targetType?: number

  @NumberProperty({
    description: '目标ID',
    example: 99,
    required: false,
  })
  targetId?: number

  @EnumProperty({
    description: '主体类型',
    example: MessageNotificationSubjectTypeEnum.COMMENT,
    enum: MessageNotificationSubjectTypeEnum,
    required: false,
  })
  subjectType?: MessageNotificationSubjectTypeEnum

  @NumberProperty({
    description: '主体ID',
    example: 123,
    required: false,
  })
  subjectId?: number

  @StringProperty({
    description: '通知标题',
    example: '收到新的评论回复',
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '通知内容',
    example: '你收到了一条新的评论回复',
    maxLength: 1000,
  })
  content!: string

  @JsonProperty({
    description: '扩展载荷',
    example: '{"extra":"value"}',
    required: false,
  })
  payload?: string

  @StringProperty({
    description: '聚合键',
    example: 'comment_like:to:10001:target:5:99',
    maxLength: 160,
    required: false,
  })
  aggregateKey?: string

  @NumberProperty({
    description: '聚合计数',
    example: 1,
  })
  aggregateCount!: number

  @BooleanProperty({
    description: '是否已读',
    example: false,
  })
  isRead!: boolean

  @DateProperty({
    description: '已读时间',
    example: '2026-03-07T12:00:00.000Z',
    required: false,
  })
  readAt?: Date

  @DateProperty({
    description: '过期时间',
    example: '2026-03-14T12:00:00.000Z',
    required: false,
  })
  expiredAt?: Date

  @DateProperty({
    description: '创建时间',
    example: '2026-03-07T12:00:00.000Z',
  })
  createdAt!: Date
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

export class UpdateUserNotificationPreferenceItemDto {
  @EnumProperty({
    description: '通知类型',
    example: MessageNotificationTypeEnum.COMMENT_REPLY,
    enum: MessageNotificationTypeEnum,
  })
  notificationType!: MessageNotificationTypeEnum

  @BooleanProperty({
    description: '是否启用该通知类型',
    example: false,
  })
  isEnabled!: boolean
}

export class UpdateUserNotificationPreferencesDto {
  @ArrayProperty({
    description: '通知偏好更新项列表',
    itemClass: UpdateUserNotificationPreferenceItemDto,
    itemType: 'object',
    required: true,
    minLength: 1,
  })
  preferences!: UpdateUserNotificationPreferenceItemDto[]
}

export class QueryNotificationDeliveryPageDto extends PageDto {
  @StringProperty({
    description: '业务投递结果（DELIVERED / FAILED / RETRYING / SKIPPED_DUPLICATE / SKIPPED_SELF / SKIPPED_PREFERENCE）',
    example: MessageNotificationDispatchStatusEnum.FAILED,
    required: false,
  })
  status?: MessageNotificationDispatchStatusEnum

  @NumberProperty({
    description: '通知类型（1=评论回复,2=评论点赞,3=内容收藏,4=用户关注,5=系统公告,6=聊天消息,7=任务提醒,8=主题点赞,9=主题收藏,10=主题评论）',
    example: MessageNotificationTypeEnum.COMMENT_REPLY,
    required: false,
  })
  notificationType?: MessageNotificationTypeEnum

  @NumberProperty({
    description: '接收用户 ID',
    example: 1001,
    required: false,
  })
  receiverUserId?: number

  @StringProperty({
    description: '业务幂等键模糊匹配',
    example: 'comment:reply:1:to:1001',
    required: false,
    maxLength: 180,
  })
  bizKey?: string

  @StringProperty({
    description: 'outbox 事件 ID',
    example: '10001',
    required: false,
    maxLength: 32,
  })
  outboxId?: string

  @StringProperty({
    description: '任务提醒子类型（如 task_available / task_expiring_soon / task_reward_granted）',
    example: 'task_reward_granted',
    required: false,
    maxLength: 40,
  })
  reminderKind?: string

  @NumberProperty({
    description: '任务 ID',
    example: 18,
    required: false,
  })
  taskId?: number

  @NumberProperty({
    description: '任务分配 ID',
    example: 88,
    required: false,
  })
  assignmentId?: number
}

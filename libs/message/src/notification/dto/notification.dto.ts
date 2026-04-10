import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  getMessageNotificationTypeLabel,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationPreferenceSourceEnum,
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
    contract: false,
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

/**
 * 通知触发用户 DTO。
 */
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

/**
 * 用户通知 DTO。
 */
export class UserNotificationDto extends BaseUserNotificationDto {
  @NestedProperty({
    description: '触发用户信息',
    type: NotificationActorDto,
    required: false,
    validation: false,
    nullable: false,
  })
  actorUser!: NotificationActorDto
}

/**
 * 未读通知数 DTO。
 */
export class NotificationUnreadCountDto {
  @NumberProperty({
    description: '未读通知数量',
    example: 3,
    validation: false,
  })
  count!: number
}

/**
 * 用户通知偏好项 DTO。
 */
export class UserNotificationPreferenceItemDto {
  @EnumProperty({
    description: '通知类型',
    example: MessageNotificationTypeEnum.COMMENT_REPLY,
    enum: MessageNotificationTypeEnum,
  })
  notificationType!: MessageNotificationTypeEnum

  @StringProperty({
    description: '通知类型中文标签',
    example: getMessageNotificationTypeLabel(
      MessageNotificationTypeEnum.COMMENT_REPLY,
    ),
  })
  notificationTypeLabel!: string

  @BooleanProperty({
    description: '当前是否启用',
    example: true,
  })
  isEnabled!: boolean

  @BooleanProperty({
    description: '该通知类型的默认启用状态',
    example: true,
  })
  defaultEnabled!: boolean

  @EnumProperty({
    description: '当前状态来源，default=默认策略，explicit=用户显式覆盖',
    example: MessageNotificationPreferenceSourceEnum.DEFAULT,
    enum: MessageNotificationPreferenceSourceEnum,
  })
  source!: MessageNotificationPreferenceSourceEnum

  @DateProperty({
    description: '最近一次显式覆盖更新时间',
    example: '2026-03-28T12:00:00.000Z',
    required: false,
  })
  updatedAt?: Date
}

/**
 * 用户通知偏好列表 DTO。
 */
export class UserNotificationPreferenceListDto {
  @ArrayProperty({
    description: '通知偏好列表',
    itemClass: UserNotificationPreferenceItemDto,
    validation: false,
  })
  list!: UserNotificationPreferenceItemDto[]
}

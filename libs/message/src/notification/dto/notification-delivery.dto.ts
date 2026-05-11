import type { MessageNotificationCategoryKey } from '../notification.constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  RegexProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IntersectionType } from '@nestjs/swagger'
import {
  POSITIVE_BIGINT_QUERY_ID_MESSAGE_SUFFIX,
  POSITIVE_BIGINT_QUERY_ID_REGEX,
} from '../notification-query-id.constant'
import {
  MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  MessageNotificationDispatchStatusEnum,
} from '../notification.constant'

/** 通知投递 dispatch ID 字段来源。 */
export class NotificationDeliveryDispatchIdFieldDto {
  @RegexProperty({
    description: 'dispatch ID（正整数字符串）',
    example: '10088',
    required: true,
    regex: POSITIVE_BIGINT_QUERY_ID_REGEX,
    message: `dispatchId ${POSITIVE_BIGINT_QUERY_ID_MESSAGE_SUFFIX}`,
  })
  dispatchId!: string
}

/** 通知投递 bigint ID 字段来源。 */
export class NotificationDeliveryIdFieldsDto extends NotificationDeliveryDispatchIdFieldDto {
  @RegexProperty({
    description: '关联的领域事件 ID（正整数字符串）',
    example: '10001',
    required: true,
    regex: POSITIVE_BIGINT_QUERY_ID_REGEX,
    message: `eventId ${POSITIVE_BIGINT_QUERY_ID_MESSAGE_SUFFIX}`,
  })
  eventId!: string
}

/** 通知投递查询与输出共享字段来源。 */
export class NotificationDeliveryLookupFieldsDto {
  @StringProperty({
    description: '领域事件键',
    example: 'comment.replied',
  })
  eventKey!: string

  @EnumProperty({
    description: '通知分类键，表示通知所属业务分类',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    required: false,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  categoryKey!: MessageNotificationCategoryKey | null

  @NumberProperty({
    description: '接收用户 ID',
    example: 1001,
    required: false,
  })
  receiverUserId!: number | null

  @StringProperty({
    description: '通知投影键',
    example: 'announcement:notify:42:user:7',
    required: false,
    maxLength: 180,
  })
  projectionKey!: string | null
}

/** 通知投递对外 API 字段来源。 */
export class BaseNotificationDeliveryDto extends IntersectionType(
  NotificationDeliveryIdFieldsDto,
  NotificationDeliveryLookupFieldsDto,
) {
  @NumberProperty({
    description: '投递结果 ID',
    example: 1,
    validation: false,
  })
  id!: number

  @NumberProperty({
    description: '任务 ID',
    example: 3,
    required: false,
    validation: false,
  })
  taskId!: number | null

  @NumberProperty({
    description: '任务实例 ID',
    example: 88,
    required: false,
    validation: false,
  })
  instanceId!: number | null

  @StringProperty({
    description: '任务提醒子类型',
    example: 'reward_granted',
    required: false,
    maxLength: 40,
    validation: false,
  })
  reminderKind!: string | null

  @NumberProperty({
    description: '关联的站内通知 ID',
    example: 88,
    required: false,
    validation: false,
  })
  notificationId!: number | null

  @EnumProperty({
    description:
      '业务投递状态（1=已投递；2=投递失败；3=重试中；4=因偏好关闭而跳过）',
    example: MessageNotificationDispatchStatusEnum.FAILED,
    enum: MessageNotificationDispatchStatusEnum,
  })
  status!: MessageNotificationDispatchStatusEnum

  @NumberProperty({
    description: '命中的模板 ID',
    example: 3,
    required: false,
    validation: false,
  })
  templateId!: number | null

  @BooleanProperty({
    description: '是否命中启用模板',
    example: true,
    validation: false,
  })
  usedTemplate!: boolean

  @StringProperty({
    description: '模板回退原因',
    example: 'missing_or_disabled',
    required: false,
    maxLength: 64,
    validation: false,
  })
  fallbackReason!: string | null

  @StringProperty({
    description: '最近一次失败原因',
    example: 'notification template render failed',
    required: false,
    maxLength: 500,
    validation: false,
  })
  failureReason!: string | null

  @DateProperty({
    description: '最近一次业务投递尝试时间',
    example: '2026-03-28T15:34:33.000Z',
    validation: false,
  })
  lastAttemptAt!: Date

  @DateProperty({
    description: '创建时间',
    example: '2026-03-28T15:34:33.000Z',
    validation: false,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-03-28T15:35:10.000Z',
    validation: false,
  })
  updatedAt!: Date
}

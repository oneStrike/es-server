import { NotificationDeliveryLookupFilterDto } from '@libs/message/notification/dto/notification-delivery-filter.dto'
import {
  getMessageNotificationCategoryLabel,
  getMessageNotificationDispatchStatusLabel,
  MessageNotificationDispatchStatusEnum,
} from '@libs/message/notification/notification.constant'
import { BooleanProperty, DateProperty, EnumProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { DomainEventDispatchStatusEnum } from '@libs/platform/modules/eventing/eventing.constant'
import { IntersectionType, PartialType } from '@nestjs/swagger'

export class QueryMessageDispatchPageDto extends IntersectionType(
  PageDto,
  PartialType(NotificationDeliveryLookupFilterDto),
) {
  @EnumProperty({
    description:
      '领域事件 dispatch 技术状态（0=待处理；1=处理中；2=成功；3=失败）',
    example: DomainEventDispatchStatusEnum.FAILED,
    required: false,
    enum: DomainEventDispatchStatusEnum,
  })
  dispatchStatus?: DomainEventDispatchStatusEnum

  @EnumProperty({
    description:
      '通知投影业务状态（1=已投递；2=投递失败；3=重试中；4=因偏好关闭而跳过）',
    example: MessageNotificationDispatchStatusEnum.FAILED,
    required: false,
    enum: MessageNotificationDispatchStatusEnum,
  })
  deliveryStatus?: MessageNotificationDispatchStatusEnum

  @StringProperty({
    description: '事件域',
    example: 'message',
    required: false,
    maxLength: 40,
  })
  domain?: string
}

export class QueryMessageWsMonitorDto {
  @NumberProperty({
    description: '统计窗口（小时）',
    example: 24,
    required: false,
    default: 24,
    min: 1,
    max: 168,
  })
  windowHours?: number
}

export class MessageWsMonitorSummaryDto {
  @DateProperty({
    description: '快照时间',
    example: '2026-03-07T12:00:00.000Z',
  })
  snapshotAt!: Date

  @DateProperty({
    description: '统计窗口起始时间',
    example: '2026-03-06T12:00:00.000Z',
  })
  windowStartAt!: Date

  @NumberProperty({
    description: '统计窗口（小时）',
    example: 24,
  })
  windowHours!: number

  @NumberProperty({
    description: 'WS 请求总数',
    example: 1200,
  })
  requestCount!: number

  @NumberProperty({
    description: 'ack 成功数量',
    example: 1180,
  })
  ackSuccessCount!: number

  @NumberProperty({
    description: 'ack 失败数量',
    example: 20,
  })
  ackErrorCount!: number

  @NumberProperty({
    description: 'ack 成功率（0~1）',
    example: 0.9833,
  })
  ackSuccessRate!: number

  @NumberProperty({
    description: '平均 ack 延迟（毫秒）',
    example: 12.4,
  })
  avgAckLatencyMs!: number

  @NumberProperty({
    description: '连接/重连次数',
    example: 85,
  })
  reconnectCount!: number

  @NumberProperty({
    description: '补偿触发次数',
    example: 16,
  })
  resyncTriggerCount!: number

  @NumberProperty({
    description: '补偿成功次数',
    example: 15,
  })
  resyncSuccessCount!: number

  @NumberProperty({
    description: '补偿成功率（0~1）',
    example: 0.9375,
  })
  resyncSuccessRate!: number
}

export class RetryMessageNotificationDeliveryDto {
  @StringProperty({
    description: '通知 dispatch ID',
    example: '10088',
    required: true,
    maxLength: 32,
  })
  dispatchId!: string
}

export class MessageNotificationDeliveryItemDto {
  @NumberProperty({
    description: '投递结果 ID',
    example: 1,
  })
  id!: number

  @StringProperty({
    description: '关联的领域事件 ID',
    example: '10001',
  })
  eventId!: string

  @StringProperty({
    description: 'dispatch ID',
    example: '10088',
  })
  dispatchId!: string

  @StringProperty({
    description: '领域事件键',
    example: 'comment.replied',
    required: false,
  })
  eventKey!: string

  @StringProperty({
    description: '通知分类键',
    example: 'comment_reply',
    required: false,
  })
  categoryKey?: string

  @StringProperty({
    description: '通知分类中文标签',
    example: getMessageNotificationCategoryLabel('comment_reply'),
    required: false,
  })
  categoryLabel?: string

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
  })
  projectionKey!: string | null

  @NumberProperty({
    description: '关联的站内通知 ID',
    example: 88,
    required: false,
  })
  notificationId!: number | null

  @EnumProperty({
    description:
      '业务投递状态（1=已投递；2=投递失败；3=重试中；4=因偏好关闭而跳过）',
    example: MessageNotificationDispatchStatusEnum.FAILED,
    enum: MessageNotificationDispatchStatusEnum,
  })
  status!: MessageNotificationDispatchStatusEnum

  @StringProperty({
    description: '业务投递结果中文标签',
    example: getMessageNotificationDispatchStatusLabel(
      MessageNotificationDispatchStatusEnum.FAILED,
    ),
  })
  statusLabel!: string

  @NumberProperty({
    description: '命中的模板 ID',
    example: 3,
    required: false,
  })
  templateId!: number | null

  @BooleanProperty({
    description: '是否命中启用模板',
    example: true,
  })
  usedTemplate!: boolean

  @StringProperty({
    description: '模板回退原因',
    example: 'missing_or_disabled',
    required: false,
  })
  fallbackReason!: string | null

  @StringProperty({
    description: '最近一次失败原因',
    example: 'notification template render failed',
    required: false,
    maxLength: 500,
  })
  failureReason!: string | null

  @DateProperty({
    description: '最近一次业务投递尝试时间',
    example: '2026-03-28T15:34:33.000Z',
  })
  lastAttemptAt!: Date

  @DateProperty({
    description: '创建时间',
    example: '2026-03-28T15:34:33.000Z',
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-03-28T15:35:10.000Z',
  })
  updatedAt!: Date
}

export class MessageDispatchPageItemDto {
  @StringProperty({
    description: 'dispatch ID',
    example: '10088',
  })
  dispatchId!: string

  @StringProperty({
    description: '领域事件 ID',
    example: '10001',
  })
  eventId!: string

  @StringProperty({
    description: 'consumer',
    example: 'notification',
  })
  consumer!: string

  @EnumProperty({
    description:
      '领域事件 dispatch 技术状态（0=待处理；1=处理中；2=成功；3=失败）',
    example: DomainEventDispatchStatusEnum.FAILED,
    enum: DomainEventDispatchStatusEnum,
  })
  dispatchStatus!: DomainEventDispatchStatusEnum

  @NumberProperty({
    description: '重试次数',
    example: 2,
  })
  retryCount!: number

  @StringProperty({
    description: '最后一次技术失败原因',
    example: 'notification-consumer-boom',
    required: false,
  })
  lastError!: string | null

  @DateProperty({
    description: '下次重试时间',
    example: '2026-04-13T12:35:00.000Z',
    required: false,
  })
  nextRetryAt!: Date | null

  @DateProperty({
    description: '处理完成时间',
    example: '2026-04-13T12:34:50.000Z',
    required: false,
  })
  processedAt!: Date | null

  @StringProperty({
    description: '领域事件键',
    example: 'comment.replied',
  })
  eventKey!: string

  @StringProperty({
    description: '领域事件域',
    example: 'message',
  })
  domain!: string

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
  })
  projectionKey!: string | null

  @EnumProperty({
    description:
      '通知投影业务状态（1=已投递；2=投递失败；3=重试中；4=因偏好关闭而跳过）',
    example: MessageNotificationDispatchStatusEnum.RETRYING,
    enum: MessageNotificationDispatchStatusEnum,
    required: false,
  })
  deliveryStatus!: MessageNotificationDispatchStatusEnum | null
}

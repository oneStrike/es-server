import { NotificationDeliveryLookupFilterDto } from '@libs/message/notification/dto/notification-delivery-filter.dto'
import {
  BaseNotificationDeliveryDto,
  NotificationDeliveryDispatchIdFieldDto,
  NotificationDeliveryIdFieldsDto,
  NotificationDeliveryLookupFieldsDto,
} from '@libs/message/notification/dto/notification-delivery.dto'
import {
  getMessageNotificationCategoryLabel,
  getMessageNotificationDispatchStatusLabel,
  MessageNotificationDispatchStatusEnum,
} from '@libs/message/notification/notification.constant'
import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { DomainEventDispatchStatusEnum } from '@libs/platform/modules/eventing/eventing.constant'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

class MessageDispatchPageSharedFieldsDto {
  @EnumProperty({
    description:
      '领域事件 dispatch 技术状态（0=待处理；1=处理中；2=成功；3=失败）',
    example: DomainEventDispatchStatusEnum.FAILED,
    enum: DomainEventDispatchStatusEnum,
  })
  dispatchStatus!: DomainEventDispatchStatusEnum

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
    maxLength: 40,
  })
  domain!: string
}

export class QueryMessageDispatchPageDto extends IntersectionType(
  PageDto,
  IntersectionType(
    NotificationDeliveryLookupFilterDto,
    PartialType(MessageDispatchPageSharedFieldsDto),
  ),
) {}

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
    validation: false,
  })
  snapshotAt!: Date

  @DateProperty({
    description: '统计窗口起始时间',
    example: '2026-03-06T12:00:00.000Z',
    validation: false,
  })
  windowStartAt!: Date

  @NumberProperty({
    description: '统计窗口（小时）',
    example: 24,
    validation: false,
  })
  windowHours!: number

  @NumberProperty({
    description: 'WS 请求总数',
    example: 1200,
    validation: false,
  })
  requestCount!: number

  @NumberProperty({
    description: 'ack 成功数量',
    example: 1180,
    validation: false,
  })
  ackSuccessCount!: number

  @NumberProperty({
    description: 'ack 失败数量',
    example: 20,
    validation: false,
  })
  ackErrorCount!: number

  @NumberProperty({
    description: 'ack 成功率（0~1）',
    example: 0.9833,
    validation: false,
  })
  ackSuccessRate!: number

  @NumberProperty({
    description: '平均 ack 延迟（毫秒）',
    example: 12.4,
    validation: false,
  })
  avgAckLatencyMs!: number

  @NumberProperty({
    description: '连接/重连次数',
    example: 85,
    validation: false,
  })
  reconnectCount!: number

  @NumberProperty({
    description: '补偿触发次数',
    example: 16,
    validation: false,
  })
  resyncTriggerCount!: number

  @NumberProperty({
    description: '补偿成功次数',
    example: 15,
    validation: false,
  })
  resyncSuccessCount!: number

  @NumberProperty({
    description: '补偿成功率（0~1）',
    example: 0.9375,
    validation: false,
  })
  resyncSuccessRate!: number
}

export class RetryMessageNotificationDeliveryDto extends PickType(
  NotificationDeliveryDispatchIdFieldDto,
  ['dispatchId'] as const,
) {}

class MessageNotificationDeliveryLabelFieldsDto {
  @StringProperty({
    description: '通知分类中文标签',
    example: getMessageNotificationCategoryLabel('comment_reply'),
    required: false,
    validation: false,
  })
  categoryLabel?: string

  @StringProperty({
    description: '业务投递结果中文标签',
    example: getMessageNotificationDispatchStatusLabel(
      MessageNotificationDispatchStatusEnum.FAILED,
    ),
    validation: false,
  })
  statusLabel!: string
}

export class MessageNotificationDeliveryItemDto extends IntersectionType(
  BaseNotificationDeliveryDto,
  MessageNotificationDeliveryLabelFieldsDto,
) {}

class MessageDispatchPageNotificationFieldsDto extends IntersectionType(
  NotificationDeliveryIdFieldsDto,
  PickType(NotificationDeliveryLookupFieldsDto, [
    'eventKey',
    'receiverUserId',
    'projectionKey',
  ] as const),
) {}

class MessageDispatchPageOutputOnlyFieldsDto {
  @StringProperty({
    description: '领域事件消费者标识',
    example: 'notification',
    validation: false,
  })
  consumer!: string

  @NumberProperty({
    description: '重试次数',
    example: 2,
    validation: false,
  })
  retryCount!: number

  @StringProperty({
    description: '最后一次技术失败原因',
    example: 'notification-consumer-boom',
    required: false,
    validation: false,
  })
  lastError!: string | null

  @DateProperty({
    description: '下次重试时间',
    example: '2026-04-13T12:35:00.000Z',
    required: false,
    validation: false,
  })
  nextRetryAt!: Date | null

  @DateProperty({
    description: '处理完成时间',
    example: '2026-04-13T12:34:50.000Z',
    required: false,
    validation: false,
  })
  processedAt!: Date | null
}

export class MessageDispatchPageItemDto extends IntersectionType(
  IntersectionType(
    MessageDispatchPageNotificationFieldsDto,
    MessageDispatchPageSharedFieldsDto,
  ),
  MessageDispatchPageOutputOnlyFieldsDto,
) {}

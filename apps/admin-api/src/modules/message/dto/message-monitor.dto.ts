import {
  getMessageNotificationDispatchStatusLabel,
  getMessageNotificationTypeLabel,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from '@libs/message/notification'
import {
  ArrayProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType } from '@nestjs/swagger'

export class QueryMessageOutboxMonitorDto {
  @NumberProperty({
    description: '统计窗口（小时）',
    example: 24,
    required: false,
    default: 24,
    min: 1,
    max: 168,
  })
  windowHours?: number

  @NumberProperty({
    description: '错误分布返回条数',
    example: 5,
    required: false,
    default: 5,
    min: 1,
    max: 20,
  })
  topErrorsLimit?: number
}

export class MessageOutboxDomainStatusItemDto {
  @NumberProperty({
    description: '事件域（1=通知,2=聊天）',
    example: 1,
  })
  domain!: number

  @NumberProperty({
    description: '状态（1=待处理,2=处理中,3=成功,4=失败）',
    example: 1,
  })
  status!: number

  @NumberProperty({
    description: '数量',
    example: 12,
  })
  count!: number
}

export class MessageOutboxErrorItemDto {
  @StringProperty({
    description: '错误信息',
    example: 'payload must be valid',
  })
  message!: string

  @NumberProperty({
    description: '出现次数',
    example: 4,
  })
  count!: number
}

export class MessageOutboxMonitorSummaryDto {
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
    description: '待处理数量',
    example: 10,
  })
  pendingCount!: number

  @NumberProperty({
    description: '处理中数量',
    example: 2,
  })
  processingCount!: number

  @NumberProperty({
    description: '失败数量',
    example: 1,
  })
  failedCount!: number

  @NumberProperty({
    description: '可立即消费数量（nextRetryAt 为空或已到期）',
    example: 8,
  })
  readyToConsumeCount!: number

  @NumberProperty({
    description: '延迟重试中的待处理数量',
    example: 3,
  })
  delayedPendingCount!: number

  @NumberProperty({
    description: '已发生重试的待处理数量',
    example: 4,
  })
  retryingPendingCount!: number

  @DateProperty({
    description: '最老待处理消息创建时间',
    example: '2026-03-07T10:00:00.000Z',
    required: false,
  })
  oldestPendingCreatedAt?: Date

  @NumberProperty({
    description: '最老待处理消息滞留秒数',
    example: 7200,
    required: false,
  })
  oldestPendingAgeSeconds?: number

  @NumberProperty({
    description: '窗口内成功处理数量',
    example: 120,
  })
  processedSuccessCountInWindow!: number

  @NumberProperty({
    description: '窗口内失败处理数量',
    example: 3,
  })
  processedFailedCountInWindow!: number

  @NumberProperty({
    description: '窗口内总处理数量',
    example: 123,
  })
  processedTotalCountInWindow!: number

  @NumberProperty({
    description: '窗口内平均每分钟处理量',
    example: 0.09,
  })
  averageProcessedPerMinute!: number

  @NumberProperty({
    description: '当前最大重试次数',
    example: 5,
  })
  maxRetryCount!: number

  @NumberProperty({
    description: '当前平均重试次数',
    example: 1.2,
  })
  avgRetryCount!: number

  @NumberProperty({
    description: '失败但无错误文本的数量',
    example: 0,
  })
  failedWithoutErrorCount!: number

  @ArrayProperty({
    description: '按域+状态的分布',
    itemType: 'object',
    itemClass: MessageOutboxDomainStatusItemDto,
    required: false,
    default: [],
  })
  domainStatus!: MessageOutboxDomainStatusItemDto[]

  @ArrayProperty({
    description: '失败错误分布 TopN',
    itemType: 'object',
    itemClass: MessageOutboxErrorItemDto,
    required: false,
    default: [],
  })
  topErrors!: MessageOutboxErrorItemDto[]
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

class MessageNotificationDeliveryFilterDto {
  @StringProperty({
    description: '业务投递结果（DELIVERED / FAILED / RETRYING / SKIPPED_DUPLICATE / SKIPPED_SELF / SKIPPED_PREFERENCE）',
    example: MessageNotificationDispatchStatusEnum.FAILED,
    required: false,
  })
  status?: MessageNotificationDispatchStatusEnum

  @NumberProperty({
    description: '通知类型（1=评论回复,2=评论点赞,3=内容收藏,4=用户关注,5=系统公告,6=聊天消息）',
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
}

export class QueryMessageNotificationDeliveryPageDto extends IntersectionType(
  PageDto,
  MessageNotificationDeliveryFilterDto,
) {}

export class MessageNotificationDeliveryItemDto {
  @NumberProperty({
    description: '投递结果 ID',
    example: 1,
  })
  id!: number

  @StringProperty({
    description: '关联的 outbox 事件 ID',
    example: '10001',
  })
  outboxId!: string

  @StringProperty({
    description: '业务幂等键',
    example: 'comment:reply:1:to:1001',
  })
  bizKey!: string

  @NumberProperty({
    description: '通知类型',
    example: MessageNotificationTypeEnum.COMMENT_REPLY,
    required: false,
  })
  notificationType!: MessageNotificationTypeEnum | null

  @StringProperty({
    description: '通知类型中文标签',
    example: getMessageNotificationTypeLabel(
      MessageNotificationTypeEnum.COMMENT_REPLY,
    ),
    required: false,
  })
  notificationTypeLabel?: string

  @NumberProperty({
    description: '接收用户 ID',
    example: 1001,
    required: false,
  })
  receiverUserId!: number | null

  @NumberProperty({
    description: '关联的站内通知 ID',
    example: 88,
    required: false,
  })
  notificationId!: number | null

  @StringProperty({
    description: '业务投递结果',
    example: MessageNotificationDispatchStatusEnum.FAILED,
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
    description: '当前重试次数',
    example: 3,
  })
  retryCount!: number

  @StringProperty({
    description: '最近一次失败原因',
    example: '通知事件缺少必要字段',
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

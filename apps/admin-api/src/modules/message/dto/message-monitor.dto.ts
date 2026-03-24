import {
  ArrayProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

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

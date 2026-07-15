import { DomainEventDispatchStatusEnum } from '@libs/eventing/eventing/eventing.constant'
import { NotificationDeliveryLookupFilterDto } from '@libs/message/notification/dto/notification-delivery-filter.dto'
import {
  BaseNotificationDeliveryDto,
  NotificationDeliveryIdFieldsDto,
  NotificationDeliveryLookupFieldsDto,
} from '@libs/message/notification/dto/notification-delivery.dto'
import {
  getMessageNotificationCategoryLabel,
  getMessageNotificationDispatchStatusLabel,
  MessageNotificationDispatchStatusEnum,
} from '@libs/message/notification/notification.constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  RegexProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  ChatMessageStatusEnum,
  ChatMessageTypeEnum,
} from '../../chat/chat.constant'
import {
  POSITIVE_BIGINT_QUERY_ID_MESSAGE_SUFFIX,
  POSITIVE_BIGINT_QUERY_ID_REGEX,
} from '../../notification/notification-query-id.constant'

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
    nullable: true,
    enum: MessageNotificationDispatchStatusEnum,
  })
  deliveryStatus!: MessageNotificationDispatchStatusEnum | null

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
    description: '跨实例实时推送因载荷过大被跳过次数',
    example: 0,
    validation: false,
  })
  fanoutSkippedCount!: number

  @NumberProperty({
    description: '跨实例实时推送发布失败次数',
    example: 0,
    validation: false,
  })
  fanoutPublishErrorCount!: number

  @NumberProperty({
    description: '补偿成功率（0~1）',
    example: 0.9375,
    validation: false,
  })
  resyncSuccessRate!: number

  @BooleanProperty({
    description: '实时推送是否存在多实例部署约束风险',
    example: false,
    validation: false,
  })
  realtimeDeploymentRisk!: boolean

  @StringProperty({
    description: '实时推送部署约束说明',
    example: null,
    nullable: true,
    validation: false,
  })
  realtimeDeploymentConstraint!: string | null
}

export class RetryMessageNotificationDeliveryDto {
  @RegexProperty({
    description: '通知投递记录 ID（正整数字符串）',
    example: '10088',
    required: true,
    regex: POSITIVE_BIGINT_QUERY_ID_REGEX,
    message: `deliveryId ${POSITIVE_BIGINT_QUERY_ID_MESSAGE_SUFFIX}`,
  })
  deliveryId!: string

  @StringProperty({
    description: '重试原因',
    example: '用户反馈未收到评论回复，确认后人工重试。',
    minLength: 5,
    maxLength: 200,
  })
  reason!: string
}

export class MessageMonitorSummaryDto {
  @DateProperty({
    description: '快照时间',
    example: '2026-03-07T12:00:00.000Z',
    validation: false,
  })
  snapshotAt!: Date

  @NumberProperty({
    description: '失败投递数量',
    example: 12,
    validation: false,
  })
  failedDeliveryCount!: number

  @NumberProperty({
    description: '重试中投递数量',
    example: 3,
    validation: false,
  })
  retryingDeliveryCount!: number

  @NumberProperty({
    description: '失败发送任务数量',
    example: 8,
    validation: false,
  })
  failedDispatchCount!: number

  @NumberProperty({
    description: '重试中发送任务数量',
    example: 2,
    validation: false,
  })
  retryingDispatchCount!: number
}

class MessageNotificationDeliveryLabelFieldsDto {
  @StringProperty({
    description: '业务场景中文标签',
    example: '评论回复',
    validation: false,
  })
  eventLabel!: string

  @StringProperty({
    description: '通知分类中文标签',
    example: getMessageNotificationCategoryLabel('comment_reply'),
    nullable: true,
    validation: false,
  })
  categoryLabel!: string | null

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
    description: '业务场景中文标签',
    example: '评论回复',
    validation: false,
  })
  eventLabel!: string

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
    nullable: true,
    validation: false,
  })
  lastError!: string | null

  @DateProperty({
    description: '下次重试时间',
    example: '2026-04-13T12:35:00.000Z',
    nullable: true,
    validation: false,
  })
  nextRetryAt!: Date | null

  @DateProperty({
    description: '处理完成时间',
    example: '2026-04-13T12:34:50.000Z',
    nullable: true,
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

export class QueryAdminChatConversationPageDto extends PageDto {
  @NumberProperty({
    description: '用户 ID，聊天排查必须先按用户定位',
    example: 10001,
    min: 1,
  })
  userId!: number

  @NumberProperty({
    description: '对方用户 ID',
    example: 10002,
    required: false,
    min: 1,
  })
  peerUserId?: number

  @NumberProperty({
    description: '会话 ID',
    example: 12,
    required: false,
    min: 1,
  })
  conversationId?: number

  @BooleanProperty({
    description: '是否只看未读会话',
    example: true,
    required: false,
  })
  unreadOnly?: boolean

  @BooleanProperty({
    description: '列表状态筛选；开启时只看已隐藏，关闭时只看可见',
    example: false,
    required: false,
  })
  hiddenOnly?: boolean
}

export class QueryAdminChatMessagePageDto extends PageDto {
  @NumberProperty({
    description: '会话 ID',
    example: 12,
    min: 1,
  })
  conversationId!: number

  @NumberProperty({
    description: '排查用户 ID，用于校验该用户仍在会话中',
    example: 10001,
    min: 1,
  })
  userId!: number

  @NumberProperty({
    description: '发送用户 ID',
    example: 10001,
    required: false,
    min: 1,
  })
  senderUserId?: number
}

export class AdminChatUserSummaryDto {
  @NumberProperty({
    description: '用户 ID',
    example: 10001,
    validation: false,
  })
  userId!: number

  @StringProperty({
    description: '用户昵称',
    example: '运营排查用户',
    nullable: true,
    validation: false,
  })
  nickname!: string | null

  @StringProperty({
    description: '用户头像',
    example: 'https://example.com/avatar.png',
    nullable: true,
    validation: false,
  })
  avatarUrl!: string | null
}

export class AdminChatConversationPageItemDto {
  @NumberProperty({
    description: '会话 ID',
    example: 12,
    validation: false,
  })
  conversationId!: number

  @BooleanProperty({
    description: '当前用户是否置顶',
    example: false,
    validation: false,
  })
  isPinned!: boolean

  @BooleanProperty({
    description: '当前用户是否已从列表隐藏该会话',
    example: false,
    validation: false,
  })
  isHiddenForUser!: boolean

  @DateProperty({
    description: '当前用户隐藏会话时间',
    example: '2026-03-07T12:00:00.000Z',
    nullable: true,
    validation: false,
  })
  hiddenAt!: Date | null

  @NumberProperty({
    description: '当前用户未读数',
    example: 2,
    validation: false,
  })
  unreadCount!: number

  @StringProperty({
    description: '当前用户最后已读消息 ID',
    example: '1024',
    nullable: true,
    validation: false,
  })
  lastReadMessageId!: string | null

  @DateProperty({
    description: '当前用户最后已读时间',
    example: '2026-03-07T12:00:00.000Z',
    nullable: true,
    validation: false,
  })
  lastReadAt!: Date | null

  @StringProperty({
    description: '最后消息 ID',
    example: '1025',
    nullable: true,
    validation: false,
  })
  lastMessageId!: string | null

  @DateProperty({
    description: '最后消息时间',
    example: '2026-03-07T12:01:00.000Z',
    nullable: true,
    validation: false,
  })
  lastMessageAt!: Date | null

  @NumberProperty({
    description: '最后发送用户 ID',
    example: 10002,
    nullable: true,
    validation: false,
  })
  lastSenderId!: number | null

  @StringProperty({
    description: '最后消息摘要（脱敏/限长）',
    example: '你好，请问...',
    nullable: true,
    validation: false,
  })
  lastMessagePreview!: string | null

  @NestedProperty({
    description: '当前排查用户摘要',
    type: AdminChatUserSummaryDto,
    validation: false,
  })
  user!: AdminChatUserSummaryDto

  @NestedProperty({
    description: '对方用户摘要',
    type: AdminChatUserSummaryDto,
    validation: false,
  })
  peerUser!: AdminChatUserSummaryDto
}

export class AdminChatMessagePageItemDto {
  @StringProperty({
    description: '消息 ID',
    example: '1025',
    validation: false,
  })
  messageId!: string

  @NumberProperty({
    description: '会话 ID',
    example: 12,
    validation: false,
  })
  conversationId!: number

  @StringProperty({
    description: '会话内递增序号',
    example: '88',
    validation: false,
  })
  messageSeq!: string

  @NumberProperty({
    description: '发送用户 ID',
    example: 10002,
    validation: false,
  })
  senderId!: number

  @EnumProperty({
    description: '消息类型（1=文本；2=图片；3=语音；4=视频；99=系统消息）',
    example: ChatMessageTypeEnum.TEXT,
    enum: ChatMessageTypeEnum,
    validation: false,
  })
  messageType!: ChatMessageTypeEnum

  @EnumProperty({
    description: '消息状态（1=正常；2=已撤回；3=已删除）',
    example: ChatMessageStatusEnum.NORMAL,
    enum: ChatMessageStatusEnum,
    validation: false,
  })
  status!: ChatMessageStatusEnum

  @StringProperty({
    description: '消息摘要（脱敏/限长）',
    example: '你好，请问...',
    validation: false,
  })
  contentPreview!: string

  @BooleanProperty({
    description: '是否有扩展载荷',
    example: false,
    validation: false,
  })
  hasPayload!: boolean

  @BooleanProperty({
    description: '是否有正文 token',
    example: false,
    validation: false,
  })
  hasBodyTokens!: boolean

  @DateProperty({
    description: '发送时间',
    example: '2026-03-07T12:01:00.000Z',
    validation: false,
  })
  createdAt!: Date
}

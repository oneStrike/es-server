import {
  NumberProperty,
  RegexProperty,
  StringProperty,
} from '@libs/platform/decorators'

const POSITIVE_BIGINT_QUERY_ID_REGEX = /^[1-9]\d*$/

export class NotificationDeliveryLookupFilterDto {
  @StringProperty({
    description: '领域事件键',
    example: 'announcement.published',
    required: false,
    maxLength: 120,
  })
  eventKey?: string

  @NumberProperty({
    description: '接收用户 ID',
    example: 1001,
    required: false,
  })
  receiverUserId?: number

  @StringProperty({
    description: '通知投影键精确匹配',
    example: 'announcement:42:user:7',
    required: false,
    maxLength: 180,
  })
  projectionKey?: string

  @RegexProperty({
    description: '领域事件 ID（正整数字符串）',
    example: '10001',
    required: false,
    regex: POSITIVE_BIGINT_QUERY_ID_REGEX,
    message: 'eventId 必须是合法的正整数字符串',
  })
  eventId?: string

  @RegexProperty({
    description: 'dispatch ID（正整数字符串）',
    example: '10088',
    required: false,
    regex: POSITIVE_BIGINT_QUERY_ID_REGEX,
    message: 'dispatchId 必须是合法的正整数字符串',
  })
  dispatchId?: string
}

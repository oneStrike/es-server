import { NumberProperty, StringProperty } from '@libs/platform/decorators'

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
    description: '通知投影键模糊匹配',
    example: 'announcement:42:user:7',
    required: false,
    maxLength: 180,
  })
  projectionKey?: string

  @StringProperty({
    description: '领域事件 ID',
    example: '10001',
    required: false,
    maxLength: 32,
  })
  eventId?: string

  @StringProperty({
    description: 'dispatch ID',
    example: '10088',
    required: false,
    maxLength: 32,
  })
  dispatchId?: string
}

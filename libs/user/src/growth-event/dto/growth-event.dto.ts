import {
  DateProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'

export class UserGrowthEventDto {
  @StringProperty({
    description: '业务域标识',
    example: 'forum',
    required: true,
    maxLength: 20,
  })
  business!: string

  @StringProperty({
    description: '事件键',
    example: 'forum.topic.create',
    required: true,
    maxLength: 50,
  })
  eventKey!: string

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @NumberProperty({
    description: '目标ID',
    example: 1,
    required: false,
    min: 1,
  })
  targetId?: number

  @StringProperty({
    description: '请求IP',
    example: '127.0.0.1',
    required: false,
    maxLength: 45,
  })
  ip?: string

  @StringProperty({
    description: '设备ID',
    example: 'device-abc',
    required: false,
    maxLength: 100,
  })
  deviceId?: string

  @DateProperty({
    description: '事件发生时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  occurredAt!: Date

  @JsonProperty({
    description: '事件上下文',
    example: '{"source":"app"}',
    required: false,
  })
  context?: string
}

import {
  ValidateDate,
  ValidateJson,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'

export class UserGrowthEventDto {
  @ValidateString({
    description: '业务域标识',
    example: 'forum',
    required: true,
    maxLength: 20,
  })
  business!: string

  @ValidateString({
    description: '事件键',
    example: 'forum.topic.create',
    required: true,
    maxLength: 50,
  })
  eventKey!: string

  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @ValidateNumber({
    description: '目标ID',
    example: 1,
    required: false,
    min: 1,
  })
  targetId?: number

  @ValidateString({
    description: '请求IP',
    example: '127.0.0.1',
    required: false,
    maxLength: 45,
  })
  ip?: string

  @ValidateString({
    description: '设备ID',
    example: 'device-abc',
    required: false,
    maxLength: 100,
  })
  deviceId?: string

  @ValidateDate({
    description: '事件发生时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  occurredAt!: Date

  @ValidateJson({
    description: '事件上下文',
    example: '{"source":"app"}',
    required: false,
  })
  context?: string
}

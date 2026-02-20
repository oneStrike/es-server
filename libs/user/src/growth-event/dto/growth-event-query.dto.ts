import {
  ValidateDate,
  ValidateEnum,
  ValidateJson,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { UserGrowthEventStatus } from '../growth-event.constant'

export class BaseUserGrowthEventDto extends BaseDto {
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

  @ValidateEnum({
    description: '处理状态',
    example: UserGrowthEventStatus.PROCESSED,
    required: true,
    enum: UserGrowthEventStatus,
  })
  status!: UserGrowthEventStatus

  @ValidateJson({
    description: '命中规则摘要',
    example: '[{"type":"point","ruleId":1,"delta":5}]',
    required: false,
  })
  ruleRefs?: string

  @ValidateNumber({
    description: '积分变更值',
    example: 5,
    required: false,
  })
  pointsDeltaApplied?: number

  @ValidateNumber({
    description: '经验变更值',
    example: 10,
    required: false,
  })
  experienceDeltaApplied?: number

  @ValidateJson({
    description: '徽章发放记录',
    example: '[{"badgeId":1}]',
    required: false,
  })
  badgeAssigned?: string

  @ValidateJson({
    description: '事件上下文',
    example: '{"source":"app"}',
    required: false,
  })
  context?: string
}

export class QueryUserGrowthEventDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserGrowthEventDto, [
      'business',
      'eventKey',
      'userId',
      'status',
      'targetId',
      'ip',
      'deviceId',
    ]),
  ),
) {}

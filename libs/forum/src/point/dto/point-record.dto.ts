import {
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { PointRuleTypeEnum } from '../point.constant'

export class BasePointRecordDto extends BaseDto {
  @ValidateNumber({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  profileId!: number

  @ValidateNumber({
    description: '关联的规则ID',
    example: 1,
    required: false,
  })
  ruleId?: number

  @ValidateNumber({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    required: true,
  })
  points!: number

  @ValidateNumber({
    description: '变化前积分',
    example: 100,
    required: true,
  })
  beforePoints!: number

  @ValidateNumber({
    description: '变化后积分',
    example: 105,
    required: true,
  })
  afterPoints!: number

  @ValidateString({
    description: '备注',
    example: '发表主题获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class QueryPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BasePointRecordDto, ['ruleId'])),
) {
  @ValidateNumber({
    description: '用户论坛资料ID',
    example: 1,
    required: true,
  })
  profileId!: number
}

export class AddPointsDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  profileId!: number

  @ValidateEnum({
    description: '规则类型',
    example: PointRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: PointRuleTypeEnum,
  })
  ruleType!: PointRuleTypeEnum

  @ValidateString({
    description: '备注',
    example: '发表主题获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class ConsumePointsDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  profileId!: number

  @ValidateNumber({
    description: '消费积分数量',
    example: 10,
    required: true,
  })
  points!: number

  @ValidateString({
    description: '备注',
    example: '管理员扣除积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

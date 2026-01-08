import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { PointRuleTypeEnum } from '../point.constant'

/**
 * 积分规则基础DTO
 */
export class BasePointRuleDto extends BaseDto {
  @ValidateString({
    description: '规则名称',
    example: '发表主题奖励',
    required: true,
    maxLength: 50,
  })
  name!: string

  @ValidateEnum({
    description:
      '规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到）',
    example: PointRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: PointRuleTypeEnum,
  })
  type!: PointRuleTypeEnum

  @ValidateNumber({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    required: true,
  })
  points!: number

  @ValidateNumber({
    description: '每日上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
  })
  dailyLimit!: number

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @ValidateString({
    description: '备注',
    example: '用户发表主题时获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

/**
 * 创建积分规则DTO
 */
export class CreatePointRuleDto extends OmitType(
  BasePointRuleDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新积分规则DTO
 */
export class UpdatePointRuleDto extends IntersectionType(
  PartialType(CreatePointRuleDto),
  IdDto,
) {}

/**
 * 查询积分规则DTO
 */
export class QueryPointRuleDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BasePointRuleDto, ['name', 'type', 'isEnabled'])),
) {}

/**
 * 积分记录基础DTO
 */
export class BasePointRecordDto extends BaseDto {
  @ValidateNumber({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  userId!: number

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

/**
 * 查询积分记录DTO
 */
export class QueryPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BasePointRecordDto, ['ruleId'])),
) {}

/**
 * 增加积分DTO
 * 用于为用户增加积分
 */
export class AddPointsDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

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

/**
 * 消费积分DTO
 */
export class ConsumePointsDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

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

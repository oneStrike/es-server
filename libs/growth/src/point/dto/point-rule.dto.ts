import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION } from '../../event-definition'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseUserPointRuleDto extends BaseDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: GrowthRuleTypeEnum,
  })
  type!: GrowthRuleTypeEnum

  @NumberProperty({
    description: '积分奖励值（正整数）',
    example: 5,
    required: true,
    min: 1,
  })
  points!: number

  @NumberProperty({
    description: '每日上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
    min: 0,
  })
  dailyLimit!: number

  @NumberProperty({
    description: '总上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
    min: 0,
  })
  totalLimit!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '备注',
    example: '用户发表主题时获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

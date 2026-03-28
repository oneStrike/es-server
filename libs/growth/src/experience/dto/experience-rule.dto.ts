import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION } from '../../event-definition'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseUserExperienceRuleDto extends BaseDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: GrowthRuleTypeEnum,
  })
  type!: GrowthRuleTypeEnum

  @NumberProperty({
    description: '经验值变化',
    example: 5,
    required: true,
  })
  experience!: number

  @NumberProperty({
    description: '每日上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
  })
  dailyLimit!: number

  @NumberProperty({
    description: '总上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
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
    example: '用户发表主题时获得经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

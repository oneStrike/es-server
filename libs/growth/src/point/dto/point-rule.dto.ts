import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION } from '../../event-definition/event-definition.doc';
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

export class CreateUserPointRuleDto extends OmitType(
  BaseUserPointRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserPointRuleDto extends IntersectionType(
  IdDto,
  PartialType(CreateUserPointRuleDto),
) {}

export class QueryUserPointRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserPointRuleDto, ['type', 'isEnabled'] as const),
  ),
) {}

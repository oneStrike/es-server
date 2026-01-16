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
import { ExperienceRuleTypeEnum } from '../experience.constant'

export class BaseExperienceRuleDto extends BaseDto {
  @ValidateEnum({
    description:
      '规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到）',
    example: ExperienceRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: ExperienceRuleTypeEnum,
  })
  type!: ExperienceRuleTypeEnum

  @ValidateNumber({
    description: '经验值变化',
    example: 5,
    required: true,
  })
  experience!: number

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
    example: '用户发表主题时获得经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class CreateExperienceRuleDto extends OmitType(
  BaseExperienceRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateExperienceRuleDto extends IntersectionType(
  PartialType(CreateExperienceRuleDto),
  IdDto,
) {}

export class QueryExperienceRuleDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseExperienceRuleDto, ['type', 'isEnabled'])),
) {}

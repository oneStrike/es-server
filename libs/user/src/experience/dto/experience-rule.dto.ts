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
import { ForumExperienceRuleTypeEnum } from '../experience.constant'

export class BaseForumExperienceRuleDto extends BaseDto {
  @ValidateEnum({
    description:
      '规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到）',
    example: ForumExperienceRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: ForumExperienceRuleTypeEnum,
  })
  type!: ForumExperienceRuleTypeEnum

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

export class CreateForumExperienceRuleDto extends OmitType(
  BaseForumExperienceRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateForumExperienceRuleDto extends IntersectionType(
  PartialType(CreateForumExperienceRuleDto),
  IdDto,
) {}

export class QueryForumExperienceRuleDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumExperienceRuleDto, ['type', 'isEnabled'])),
) {}

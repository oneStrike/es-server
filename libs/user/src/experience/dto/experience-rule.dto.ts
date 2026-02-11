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
import { UserExperienceRuleTypeEnum } from '../experience.constant'

export class BaseUserExperienceRuleDto extends BaseDto {
  @ValidateEnum({
    description:
      '规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到）',
    example: UserExperienceRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: UserExperienceRuleTypeEnum,
  })
  type!: UserExperienceRuleTypeEnum

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

  @ValidateString({
    description: '业务域标识',
    example: 'forum',
    required: false,
    maxLength: 20,
  })
  business?: string

  @ValidateString({
    description: '事件键',
    example: 'forum.topic.create',
    required: false,
    maxLength: 50,
  })
  eventKey?: string

  @ValidateNumber({
    description: '冷却秒数（0=无限制）',
    example: 0,
    required: false,
    default: 0,
  })
  cooldownSeconds?: number

  @ValidateNumber({
    description: '总上限（0=无限制）',
    example: 0,
    required: false,
    default: 0,
  })
  totalLimit?: number

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

export class CreateUserExperienceRuleDto extends OmitType(
  BaseUserExperienceRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserExperienceRuleDto extends IntersectionType(
  PartialType(CreateUserExperienceRuleDto),
  IdDto,
) {}

export class QueryUserExperienceRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserExperienceRuleDto, [
      'type',
      'business',
      'eventKey',
      'isEnabled',
    ]),
  ),
) {}

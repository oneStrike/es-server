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
import { ForumPointRuleTypeEnum } from '../point.constant'

export class BaseForumPointRuleDto extends BaseDto {
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
    example: ForumPointRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: ForumPointRuleTypeEnum,
  })
  type!: ForumPointRuleTypeEnum

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

export class CreateForumPointRuleDto extends OmitType(
  BaseForumPointRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateForumPointRuleDto extends IntersectionType(
  PartialType(CreateForumPointRuleDto),
  IdDto,
) {}

export class QueryForumPointRuleDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumPointRuleDto, ['name', 'type', 'isEnabled'])),
) {}

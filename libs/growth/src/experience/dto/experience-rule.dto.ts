import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseUserExperienceRuleDto extends BaseDto {
  @EnumProperty({
    description:
      '规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到, 7=管理员操作, 8=主题浏览, 9=举报, 100=漫画浏览, 101=漫画点赞, 102=漫画收藏, 200=小说浏览, 201=小说点赞, 202=小说收藏, 300=章节阅读, 301=章节点赞, 302=章节购买, 303=章节下载, 304=章节兑换）',
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
      'isEnabled',
    ]),
  ),
) {}

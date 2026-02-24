import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
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
  @EnumProperty({
    description:
      '规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到, 7=管理员操作, 8=主题浏览, 9=举报, 101=漫画浏览, 102=漫画点赞, 103=漫画收藏, 111=章节阅读, 112=章节点赞, 113=章节购买, 114=章节下载）',
    example: UserExperienceRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: UserExperienceRuleTypeEnum,
  })
  type!: UserExperienceRuleTypeEnum

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

  @StringProperty({
    description: '业务域标识',
    example: 'forum',
    required: false,
    maxLength: 20,
  })
  business?: string

  @StringProperty({
    description: '事件键',
    example: 'forum.topic.create',
    required: false,
    maxLength: 50,
  })
  eventKey?: string

  @NumberProperty({
    description: '冷却秒数（0=无限制）',
    example: 0,
    required: false,
    default: 0,
  })
  cooldownSeconds?: number

  @NumberProperty({
    description: '总上限（0=无限制）',
    example: 0,
    required: false,
    default: 0,
  })
  totalLimit?: number

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
      'business',
      'eventKey',
      'isEnabled',
    ]),
  ),
) {}

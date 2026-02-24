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
import { UserPointRuleTypeEnum } from '../point.constant'

export class BaseUserPointRuleDto extends BaseDto {
  @EnumProperty({
    description:
      '规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到, 7=管理员操作, 8=主题浏览, 9=举报, 101=漫画浏览, 102=漫画点赞, 103=漫画收藏, 111=章节阅读, 112=章节点赞, 113=章节购买, 114=章节下载）',
    example: UserPointRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: UserPointRuleTypeEnum,
  })
  type!: UserPointRuleTypeEnum

  @NumberProperty({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    required: true,
  })
  points!: number

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
    example: '用户发表主题时获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class CreateUserPointRuleDto extends OmitType(
  BaseUserPointRuleDto,
  OMIT_BASE_FIELDS,
) { }

export class UpdateUserPointRuleDto extends IntersectionType(
  PartialType(CreateUserPointRuleDto),
  IdDto,
) { }

export class QueryUserPointRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserPointRuleDto, [
      'type',
      'business',
      'isEnabled',
    ]),
  ),
) { }

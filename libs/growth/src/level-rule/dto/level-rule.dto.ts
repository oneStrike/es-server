import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'

import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { UserLevelRulePermissionEnum } from '../level-rule.constant'

/**
 * 等级规则基础DTO
 */
export class BaseUserLevelRuleDto extends BaseDto {
  @StringProperty({
    description: '等级名称',
    example: '新手',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '等级描述',
    example: '新手用户等级',
    nullable: true,
    maxLength: 200,
  })
  description!: string | null

  @StringProperty({
    description: '等级图标URL',
    example: 'https://example.com/icons/level1.png',
    nullable: true,
    maxLength: 255,
  })
  icon!: string | null

  @NumberProperty({
    description: '所需经验值',
    example: 0,
    required: true,
  })
  requiredExperience!: number

  @NumberProperty({
    description: '排序值（0=默认排序，数值越小越靠前）',
    example: 1,
    required: true,
  })
  sortOrder!: number

  @StringProperty({
    description: '业务域标识',
    example: 'forum',
    nullable: true,
    maxLength: 20,
  })
  business!: string | null

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @NumberProperty({
    description: '每日发帖数量上限（0=不限制）',
    example: 10,
    required: true,
  })
  dailyTopicLimit!: number

  @NumberProperty({
    description: '每日回复和评论数量上限（0=不限制）',
    example: 50,
    required: true,
  })
  dailyReplyCommentLimit!: number

  @NumberProperty({
    description: '发帖间隔秒数（0=不限制）',
    example: 30,
    required: true,
  })
  postInterval!: number

  @NumberProperty({
    description: '每日点赞次数上限（0=不限制）',
    example: 20,
    required: true,
  })
  dailyLikeLimit!: number

  @NumberProperty({
    description: '每日收藏次数上限（0=不限制）',
    example: 10,
    required: true,
  })
  dailyFavoriteLimit!: number

  @StringProperty({
    description: '积分支付比例（0-1之间的小数，1表示原价支付）',
    example: '0.90',
    required: true,
    maxLength: 4,
  })
  purchasePayableRate!: string

  @StringProperty({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    nullable: true,
    maxLength: 20,
  })
  color!: string | null
}

class CreateUserLevelRuleRequiredDto extends OmitType(
  BaseUserLevelRuleDto,
  [
    ...OMIT_BASE_FIELDS,
    'description',
    'icon',
    'business',
    'color',
  ] as const,
) {}

class CreateUserLevelRuleOptionalDto extends PartialType(
  PickType(BaseUserLevelRuleDto, [
    'description',
    'icon',
    'business',
    'color',
  ] as const),
) {}

export class CreateUserLevelRuleDto extends IntersectionType(
  CreateUserLevelRuleRequiredDto,
  CreateUserLevelRuleOptionalDto,
) {}

export class UpdateUserLevelRuleDto extends IntersectionType(
  IdDto,
  PartialType(CreateUserLevelRuleDto),
) {}

export class UserLevelRuleOutputDto extends BaseUserLevelRuleDto {}

export class QueryUserLevelRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserLevelRuleDto, ['name', 'business', 'isEnabled'] as const),
  ),
) {}

export class UserLevelPermissionsDto extends PickType(BaseUserLevelRuleDto, [
  'dailyTopicLimit',
  'dailyReplyCommentLimit',
  'postInterval',
  'dailyLikeLimit',
  'dailyFavoriteLimit',
] as const) {}

export class UserLevelInfoDto {
  @NumberProperty({ description: '等级ID', example: 1, validation: false })
  levelId!: number

  @StringProperty({
    description: '等级名称',
    example: '新手',
    validation: false,
  })
  levelName!: string

  @StringProperty({
    description: '等级描述',
    example: '新手用户等级',
    nullable: true,
    validation: false,
  })
  levelDescription!: string | null

  @StringProperty({
    description: '等级图标URL',
    example: 'https://example.com/icons/level1.png',
    nullable: true,
    validation: false,
  })
  levelIcon!: string | null

  @StringProperty({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    nullable: true,
    validation: false,
  })
  levelColor!: string | null

  @NumberProperty({
    description: '当前经验值',
    example: 100,
    validation: false,
  })
  currentExperience!: number

  @NumberProperty({
    description: '下一等级所需经验值',
    example: 500,
    nullable: true,
    validation: false,
  })
  nextLevelExperience!: number | null

  @NumberProperty({
    description: '升级进度百分比',
    example: 20,
    validation: false,
  })
  progressPercentage!: number

  @NestedProperty({
    description: '等级权限',
    type: UserLevelPermissionsDto,
    validation: false,
    nullable: false,
  })
  permissions!: UserLevelPermissionsDto
}

export class CheckUserLevelPermissionDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @EnumProperty({
    description:
      '权限类型（每日发帖数量上限；每日回复和评论数量上限；发帖间隔秒数；每日点赞次数上限；每日收藏次数上限）',
    example: UserLevelRulePermissionEnum.DAILY_FAVORITE_LIMIT,
    required: true,
    enum: UserLevelRulePermissionEnum,
  })
  permissionType!: UserLevelRulePermissionEnum

  @StringProperty({
    description: '业务域标识；默认业务域传空或不传，论坛业务域传 forum',
    example: 'forum',
    required: false,
    maxLength: 20,
  })
  business?: string | null
}

export class UserLevelPermissionResultDto {
  @BooleanProperty({
    description: '是否有权限',
    example: true,
    validation: false,
  })
  hasPermission!: boolean

  @StringProperty({
    description: '当前等级名称',
    example: '新手',
    validation: false,
  })
  currentLevel!: string

  @NumberProperty({
    description: '限制数量',
    example: 10,
    nullable: true,
    validation: false,
  })
  limit!: number | null

  @NumberProperty({
    description: '已使用数量',
    example: 5,
    nullable: true,
    validation: false,
  })
  used!: number | null

  @NumberProperty({
    description: '剩余数量',
    example: 5,
    nullable: true,
    validation: false,
  })
  remaining!: number | null

  @NumberProperty({
    description: '间隔限制秒数，仅 postInterval 返回',
    example: 30,
    nullable: true,
    validation: false,
  })
  limitSeconds!: number | null

  @NumberProperty({
    description: '距上次发帖/回复已过秒数，仅 postInterval 返回',
    example: 20,
    nullable: true,
    validation: false,
  })
  elapsedSeconds!: number | null

  @NumberProperty({
    description: '距离下次允许操作剩余秒数，仅 postInterval 返回',
    example: 10,
    nullable: true,
    validation: false,
  })
  remainingSeconds!: number | null

  @StringProperty({
    description: '下次允许操作时间，仅 postInterval 且受限时返回',
    example: '2026-06-08T12:00:30.000Z',
    nullable: true,
    validation: false,
  })
  nextAllowedAt!: string | null
}

export class UserLevelDistributionItemDto {
  @NumberProperty({ description: '等级ID', example: 1, validation: false })
  levelId!: number

  @StringProperty({
    description: '等级名称',
    example: '新手',
    validation: false,
  })
  levelName!: string

  @NumberProperty({
    description: '该等级用户数量',
    example: 150,
    validation: false,
  })
  userCount!: number
}

export class UserLevelStatisticsDto {
  @NumberProperty({ description: '总等级数量', example: 10, validation: false })
  totalLevels!: number

  @NumberProperty({
    description: '启用的等级数量',
    example: 8,
    validation: false,
  })
  enabledLevels!: number

  @ArrayProperty({
    description: '等级分布',
    itemClass: UserLevelDistributionItemDto,
    validation: false,
  })
  levelDistribution!: UserLevelDistributionItemDto[]
}

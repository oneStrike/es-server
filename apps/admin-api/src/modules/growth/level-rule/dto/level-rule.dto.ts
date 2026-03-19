import { BaseUserLevelRuleDto } from '@libs/growth'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { UserLevelRulePermissionEnum } from '@libs/growth'

export class CreateUserLevelRuleDto extends OmitType(
  BaseUserLevelRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserLevelRuleDto extends IntersectionType(
  PartialType(CreateUserLevelRuleDto),
  IdDto,
) {}

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

  @StringProperty({ description: '等级名称', example: '新手', validation: false })
  levelName!: string

  @StringProperty({
    description: '等级描述',
    example: '新手用户等级',
    required: false,
    validation: false,
  })
  levelDescription?: string

  @StringProperty({
    description: '等级图标URL',
    example: 'https://example.com/icons/level1.png',
    required: false,
    validation: false,
  })
  levelIcon?: string

  @StringProperty({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    required: false,
    validation: false,
  })
  levelColor?: string

  @StringProperty({
    description: '等级徽章URL',
    example: 'https://example.com/badges/level1.png',
    required: false,
    validation: false,
  })
  levelBadge?: string

  @NumberProperty({ description: '当前经验值', example: 100, validation: false })
  currentExperience!: number

  @NumberProperty({
    description: '下一等级所需经验值',
    example: 500,
    required: false,
    validation: false,
  })
  nextLevelExperience?: number

  @NumberProperty({
    description: '升级进度百分比',
    example: 20,
    required: false,
    validation: false,
  })
  progressPercentage?: number

  @NestedProperty({
    description: '等级权限',
    type: UserLevelPermissionsDto,
    validation: false,
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
    description: '权限类型',
    example: UserLevelRulePermissionEnum.DAILY_FAVORITE_LIMIT,
    required: true,
    enum: UserLevelRulePermissionEnum,
  })
  permissionType!: UserLevelRulePermissionEnum
}

export class UserLevelPermissionResultDto {
  @BooleanProperty({ description: '是否有权限', example: true, validation: false })
  hasPermission!: boolean

  @StringProperty({ description: '当前等级名称', example: '新手', validation: false })
  currentLevel!: string

  @NumberProperty({
    description: '限制数量',
    example: 10,
    required: false,
    validation: false,
  })
  limit?: number

  @NumberProperty({
    description: '已使用数量',
    example: 5,
    required: false,
    validation: false,
  })
  used?: number

  @NumberProperty({
    description: '剩余数量',
    example: 5,
    required: false,
    validation: false,
  })
  remaining?: number
}

export class UserLevelDistributionItemDto {
  @NumberProperty({ description: '等级ID', example: 1, validation: false })
  levelId!: number

  @StringProperty({ description: '等级名称', example: '新手', validation: false })
  levelName!: string

  @NumberProperty({ description: '该等级用户数量', example: 150, validation: false })
  userCount!: number
}

export class UserLevelStatisticsDto {
  @NumberProperty({ description: '总等级数量', example: 10, validation: false })
  totalLevels!: number

  @NumberProperty({ description: '启用的等级数量', example: 8, validation: false })
  enabledLevels!: number

  @ArrayProperty({
    description: '等级分布',
    itemClass: UserLevelDistributionItemDto,
    itemType: 'object',
    validation: false,
  })
  levelDistribution!: UserLevelDistributionItemDto[]
}

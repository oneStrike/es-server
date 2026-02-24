import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NestedProperty,
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
    required: false,
    maxLength: 200,
  })
  description?: string

  @StringProperty({
    description: '等级图标URL',
    example: 'https://example.com/icons/level1.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @NumberProperty({
    description: '所需经验值',
    example: 0,
    required: true,
  })
  requiredExperience!: number

  @NumberProperty({
    description: '所需登录天数',
    example: 0,
    required: true,
  })
  loginDays!: number

  @NumberProperty({
    description: '排序值（数值越小越靠前）',
    example: 1,
    required: true,
  })
  sortOrder!: number

  @StringProperty({
    description: '业务域标识',
    example: 'forum',
    required: false,
    maxLength: 20,
  })
  business?: string

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @NumberProperty({
    description: '每日发帖数量上限，0表示无限制',
    example: 10,
    required: true,
  })
  dailyTopicLimit!: number

  @NumberProperty({
    description: '每日回复和评论数量上限，0表示无限制',
    example: 50,
    required: true,
  })
  dailyReplyCommentLimit!: number

  @NumberProperty({
    description: '发帖间隔秒数（防刷屏），0表示无限制',
    example: 30,
    required: true,
  })
  postInterval!: number

  @NumberProperty({
    description: '每日点赞次数上限，0表示无限制',
    example: 20,
    required: true,
  })
  dailyLikeLimit!: number

  @NumberProperty({
    description: '每日收藏次数上限，0表示无限制',
    example: 10,
    required: true,
  })
  dailyFavoriteLimit!: number

  @StringProperty({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    required: false,
    maxLength: 20,
  })
  color?: string

  @StringProperty({
    description: '等级徽章URL',
    example: 'https://example.com/badges/level1.png',
    required: false,
    maxLength: 255,
  })
  badge?: string
}

/**
 * 创建等级规则DTO
 */
export class CreateUserLevelRuleDto extends OmitType(
  BaseUserLevelRuleDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新等级规则DTO
 */
export class UpdateUserLevelRuleDto extends IntersectionType(
  PartialType(CreateUserLevelRuleDto),
  IdDto,
) {}

/**
 * 查询等级规则DTO
 */
export class QueryUserLevelRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserLevelRuleDto, ['name', 'business', 'isEnabled']),
  ),
) {}

/**
 * 等级规则详情DTO
 */
export class UserLevelRuleDetailDto extends IntersectionType(
  BaseUserLevelRuleDto,
  PickType(BaseDto, ['id', 'createdAt', 'updatedAt']),
) {}

/**
 * 等级权限DTO
 */
export class UserLevelPermissionsDto extends PickType(BaseUserLevelRuleDto, [
  'dailyTopicLimit',
  'dailyReplyCommentLimit',
  'postInterval',
  'dailyLikeLimit',
  'dailyFavoriteLimit',
]) {}

/**
 * 用户等级信息DTO
 */
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

/**
 * 等级权限检查DTO
 */
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

/**
 * 等级权限检查结果DTO
 * 返回等级权限检查的结果
 */
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

/**
 * 等级分布项DTO
 * 单个等级的用户分布情况
 */
export class UserLevelDistributionItemDto {
  @NumberProperty({ description: '等级ID', example: 1, validation: false })
  levelId!: number

  @StringProperty({ description: '等级名称', example: '新手', validation: false })
  levelName!: string

  @NumberProperty({ description: '该等级用户数量', example: 150, validation: false })
  userCount!: number
}

/**
 * 等级统计DTO
 * 等级系统整体统计数据
 */
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

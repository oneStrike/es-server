import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
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
  @ValidateString({
    description: '等级名称',
    example: '新手',
    required: true,
    maxLength: 20,
  })
  name!: string

  @ValidateString({
    description: '等级描述',
    example: '新手用户等级',
    required: false,
    maxLength: 200,
  })
  description?: string

  @ValidateString({
    description: '等级图标URL',
    example: 'https://example.com/icons/level1.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @ValidateNumber({
    description: '所需经验值',
    example: 0,
    required: true,
  })
  requiredExperience!: number

  @ValidateNumber({
    description: '所需登录天数',
    example: 0,
    required: true,
  })
  loginDays!: number

  @ValidateNumber({
    description: '排序值（数值越小越靠前）',
    example: 1,
    required: true,
  })
  sortOrder!: number

  @ValidateString({
    description: '业务域标识',
    example: 'forum',
    required: false,
    maxLength: 20,
  })
  business?: string

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @ValidateNumber({
    description: '每日发帖数量上限，0表示无限制',
    example: 10,
    required: true,
  })
  dailyTopicLimit!: number

  @ValidateNumber({
    description: '每日回复和评论数量上限，0表示无限制',
    example: 50,
    required: true,
  })
  dailyReplyCommentLimit!: number

  @ValidateNumber({
    description: '发帖间隔秒数（防刷屏），0表示无限制',
    example: 30,
    required: true,
  })
  postInterval!: number

  @ValidateNumber({
    description: '每日点赞次数上限，0表示无限制',
    example: 20,
    required: true,
  })
  dailyLikeLimit!: number

  @ValidateNumber({
    description: '每日收藏次数上限，0表示无限制',
    example: 10,
    required: true,
  })
  dailyFavoriteLimit!: number

  @ValidateString({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    required: false,
    maxLength: 20,
  })
  color?: string

  @ValidateString({
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
  @ApiProperty({ description: '等级ID', example: 1 })
  levelId!: number

  @ApiProperty({ description: '等级名称', example: '新手' })
  levelName!: string

  @ApiProperty({
    description: '等级描述',
    example: '新手用户等级',
    required: false,
    nullable: true,
  })
  levelDescription?: string

  @ApiProperty({
    description: '等级图标URL',
    example: 'https://example.com/icons/level1.png',
    required: false,
    nullable: true,
  })
  levelIcon?: string

  @ApiProperty({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    required: false,
    nullable: true,
  })
  levelColor?: string

  @ApiProperty({
    description: '等级徽章URL',
    example: 'https://example.com/badges/level1.png',
    required: false,
    nullable: true,
  })
  levelBadge?: string

  @ApiProperty({ description: '当前经验值', example: 100 })
  currentExperience!: number

  @ApiProperty({
    description: '下一等级所需经验值',
    example: 500,
    required: false,
  })
  nextLevelExperience?: number

  @ApiProperty({
    description: '升级进度百分比',
    example: 20,
    required: false,
  })
  progressPercentage?: number

  @ApiProperty({
    description: '等级权限',
    type: UserLevelPermissionsDto,
  })
  permissions!: UserLevelPermissionsDto
}

/**
 * 等级权限检查DTO
 */
export class CheckUserLevelPermissionDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  @ApiProperty({ description: '用户ID', example: 1 })
  userId!: number

  @ValidateEnum({
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
  @ApiProperty({ description: '是否有权限', example: true })
  hasPermission!: boolean

  @ApiProperty({ description: '当前等级名称', example: '新手' })
  currentLevel!: string

  @ApiProperty({
    description: '限制数量',
    example: 10,
    required: false,
  })
  limit?: number

  @ApiProperty({
    description: '已使用数量',
    example: 5,
    required: false,
  })
  used?: number

  @ApiProperty({
    description: '剩余数量',
    example: 5,
    required: false,
  })
  remaining?: number
}

/**
 * 等级分布项DTO
 * 单个等级的用户分布情况
 */
export class UserLevelDistributionItemDto {
  @ApiProperty({ description: '等级ID', example: 1 })
  levelId!: number

  @ApiProperty({ description: '等级名称', example: '新手' })
  levelName!: string

  @ApiProperty({ description: '该等级用户数量', example: 150 })
  userCount!: number
}

/**
 * 等级统计DTO
 * 等级系统整体统计数据
 */
export class UserLevelStatisticsDto {
  @ApiProperty({ description: '总等级数量', example: 10 })
  totalLevels!: number

  @ApiProperty({ description: '启用的等级数量', example: 8 })
  enabledLevels!: number

  @ApiProperty({
    description: '等级分布',
    type: [UserLevelDistributionItemDto],
  })
  levelDistribution!: UserLevelDistributionItemDto[]
}

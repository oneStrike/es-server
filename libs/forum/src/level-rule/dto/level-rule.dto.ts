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
import { LevelRulePermissionEnum } from '../level-rule.constant'

/**
 * 等级规则基础DTO
 */
export class BaseLevelRuleDto extends BaseDto {
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
    description: '所需积分',
    example: 0,
    required: true,
  })
  requiredPoints!: number

  @ValidateNumber({
    description: '排序值（数值越小越靠前）',
    example: 1,
    required: true,
  })
  order!: number

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
    description: '每日回复数量上限，0表示无限制',
    example: 50,
    required: true,
  })
  dailyReplyLimit!: number

  @ValidateNumber({
    description: '发帖间隔秒数（防刷屏），0表示无限制',
    example: 30,
    required: true,
  })
  postInterval!: number

  @ValidateNumber({
    description: '单个文件最大大小（KB），0表示无限制',
    example: 5120,
    required: true,
  })
  maxFileSize!: number

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

  @ValidateNumber({
    description: '每日评论次数上限，0表示无限制',
    example: 30,
    required: true,
  })
  dailyCommentLimit!: number

  @ValidateString({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    required: false,
    maxLength: 20,
  })
  levelColor?: string

  @ValidateString({
    description: '等级徽章URL',
    example: 'https://example.com/badges/level1.png',
    required: false,
    maxLength: 255,
  })
  levelBadge?: string
}

/**
 * 创建等级规则DTO
 */
export class CreateLevelRuleDto extends OmitType(
  BaseLevelRuleDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新等级规则DTO
 */
export class UpdateLevelRuleDto extends IntersectionType(
  PartialType(CreateLevelRuleDto),
  IdDto,
) {}

/**
 * 查询等级规则DTO
 */
export class QueryLevelRuleDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseLevelRuleDto, ['name', 'isEnabled'])),
) {}

/**
 * 等级权限检查DTO
 */
export class CheckLevelPermissionDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateEnum({
    enum: LevelRulePermissionEnum,
    description: '权限类型',
    example: LevelRulePermissionEnum.DAILY_TOPIC_LIMIT,
    required: true,
  })
  permissionType!: LevelRulePermissionEnum
}

/**
 * 等级权限检查结果DTO
 */
export class LevelPermissionResultDto {
  @ApiProperty({
    description: '是否有该权限',
    example: true,
  })
  hasPermission!: boolean

  @ApiProperty({
    description: '当前等级',
    example: '新手',
  })
  currentLevel!: string

  @ApiProperty({
    description: '权限限制值',
    example: 10,
  })
  limit?: number

  @ApiProperty({
    description: '已用次数',
    example: 5,
  })
  used?: number

  @ApiProperty({
    description: '剩余次数',
    example: 5,
  })
  remaining?: number

  @ApiProperty({
    description: '权限检查消息',
    example: '您已使用完所有权限次数',
  })
  message?: string
}

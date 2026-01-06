import {
  ValidateBoolean,
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

/**
 * 徽章信息DTO
 */
class BadgeInfoDto {
  @ApiProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  id!: number

  @ApiProperty({
    description: '徽章名称',
    example: '活跃用户',
    required: true,
  })
  name!: string

  @ApiProperty({
    description: '徽章图标',
    example: 'https://example.com/badge.png',
    required: true,
  })
  icon!: string

  @ApiProperty({
    description: '获得时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

/**
 * 等级信息DTO
 */
class LevelInfoDto {
  @ApiProperty({
    description: '等级ID',
    example: 1,
    required: true,
  })
  id!: number

  @ApiProperty({
    description: '等级名称',
    example: '初级会员',
    required: true,
  })
  name!: string

  @ApiProperty({
    description: '等级图标',
    example: 'https://example.com/level.png',
    required: true,
  })
  icon!: string

  @ApiProperty({
    description: '所需积分',
    example: 100,
    required: true,
  })
  requiredPoints!: number
}

/**
 * 论坛用户资料基础DTO
 */
export class BaseForumProfileDto extends BaseDto {
  @ApiProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateNumber({
    description: '论坛积分',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  points!: number

  @ValidateNumber({
    description: '等级ID',
    example: 1,
    required: true,
    min: 1,
  })
  levelId!: number

  @ValidateNumber({
    description: '发表主题数',
    example: 10,
    required: true,
    min: 0,
    default: 0,
  })
  topicCount!: number

  @ValidateNumber({
    description: '发表回复数',
    example: 50,
    required: true,
    min: 0,
    default: 0,
  })
  replyCount!: number

  @ValidateNumber({
    description: '获得点赞数',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  likeCount!: number

  @ValidateNumber({
    description: '获得收藏数',
    example: 20,
    required: true,
    min: 0,
    default: 0,
  })
  favoriteCount!: number

  @ValidateBoolean({
    description: '是否被封禁',
    example: false,
    required: true,
    default: false,
  })
  isBanned!: boolean

  @ApiProperty({
    description: '关联的徽章',
    required: false,
    type: [BadgeInfoDto],
  })
  badges?: BadgeInfoDto[]
}

/**
 * 创建论坛用户资料DTO
 */
export class CreateForumProfileDto extends OmitType(BaseForumProfileDto, [
  ...OMIT_BASE_FIELDS,
  'points',
  'topicCount',
  'replyCount',
  'likeCount',
  'favoriteCount',
  'badges',
]) {}

/**
 * 更新论坛用户资料DTO
 */
export class UpdateForumProfileDto extends IntersectionType(
  PartialType(CreateForumProfileDto),
  IdDto,
) {
  @ValidateBoolean({
    description: '是否被封禁',
    example: true,
    required: false,
  })
  isBanned?: boolean
}

/**
 * 查询论坛用户资料DTO
 */
export class QueryForumProfileDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumProfileDto, ['levelId', 'isBanned'])),
) {
  @ValidateString({
    description: '用户昵称',
    example: '张三',
    required: false,
    maxLength: 20,
  })
  nickname?: string
}

/**
 * 更新用户封禁状态DTO
 */
export class UpdateBanStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseForumProfileDto, ['isBanned']),
) {}

/**
 * 调整积分DTO
 */
export class AdjustPointsDto {
  @ApiProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @ValidateNumber({
    description: '积分变化（正数为增加，负数为减少）',
    example: 100,
    required: true,
  })
  points!: number

  @ValidateString({
    description: '操作原因',
    example: '优质内容奖励',
    required: true,
    maxLength: 200,
  })
  reason!: string
}

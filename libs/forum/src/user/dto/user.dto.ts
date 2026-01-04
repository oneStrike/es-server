import {
  ValidateDate,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { UserLevelEnum, UserStatusEnum } from '../user.constant'

export class BaseForumProfileDto extends BaseDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateNumber({
    description: '积分数量',
    example: 100,
    required: true,
  })
  points!: number

  @ValidateNumber({
    description: '等级ID',
    example: 100,
    required: true,
  })
  levelId!: number

  @ValidateString({
    description: '签名',
    example: '这是我的签名',
    required: true,
    maxLength: 200,
  })
  signature!: string

  @ValidateString({
    description: '个人简介',
    example: '这是我的个人简介',
    required: true,
    maxLength: 500,
  })
  bio!: string

  @ValidateEnum({
    description: '用户状态',
    example: UserStatusEnum.NORMAL,
    enum: UserStatusEnum,
    required: true,
  })
  status!: UserStatusEnum

  @ValidateString({
    description: '封禁原因',
    example: '违反社区规则',
    required: true,
    maxLength: 200,
  })
  banReason!: string

  @ValidateDate({
    description: '封禁结束时间',
    example: '2023-09-15T00:00:00.000Z',
    required: true,
  })
  banUntil!: Date

  @ApiProperty({ description: '主题数', default: 0, example: 10 })
  topicCount!: number

  @ApiProperty({ description: '回复数', default: 0, example: 100 })
  replyCount!: number

  @ApiProperty({ description: '点赞数', default: 0, example: 5 })
  likeCount!: number

  @ApiProperty({ description: '收藏数', default: 0, example: 5 })
  favoriteCount!: number
}

/**
 * 查询用户列表DTO
 */
export class QueryUserListDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumProfileDto, ['levelId', 'status'])),
) {
  @ValidateString({
    description: '昵称',
    example: '张三',
    required: false,
    maxLength: 50,
  })
  nickname?: string
}

/**
 * 更新用户积分DTO
 */
export class UpdateUserPointsDto extends PickType(BaseForumProfileDto, [
  'userId',
  'points',
]) {
  @ValidateNumber({
    description: '积分变化值（正数增加，负数减少）',
    example: 100,
    required: true,
  })
  points!: number

  @ValidateString({
    description: '原因',
    example: '管理员手动调整',
    required: true,
    maxLength: 200,
  })
  reason!: string
}

/**
 * 更新用户等级DTO
 */
export class UpdateUserLevelDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateEnum({
    description: '等级',
    example: UserLevelEnum.SENIOR,
    enum: UserLevelEnum,
    required: true,
  })
  level!: UserLevelEnum
}

/**
 * 更新用户状态DTO
 */
export class UpdateUserStatusDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateEnum({
    description: '状态',
    example: UserStatusEnum.MUTED,
    enum: UserStatusEnum,
    required: true,
  })
  status!: UserStatusEnum

  @ValidateString({
    description: '原因',
    example: '违反社区规则',
    required: true,
    maxLength: 200,
  })
  reason!: string
}

/**
 * 授予徽章DTO
 */
export class GrantBadgeDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateNumber({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number
}

/**
 * 撤销徽章DTO
 */
export class RevokeBadgeDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateNumber({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number
}

/**
 * 用户资料DTO
 */
export class UserProfileDto {
  @ApiProperty({ description: '用户ID', example: 1 })
  userId!: number

  @ApiProperty({ description: '积分', example: 1000 })
  points!: number

  @ApiProperty({ description: '等级', example: UserLevelEnum.SENIOR })
  level!: UserLevelEnum

  @ApiProperty({ description: '等级名称', example: '高级' })
  levelName!: string

  @ApiProperty({ description: '状态', example: UserStatusEnum.NORMAL })
  status!: UserStatusEnum

  @ApiProperty({ description: '状态名称', example: '正常' })
  statusName!: string

  @ApiProperty({ description: '主题数', example: 10 })
  topicCount!: number

  @ApiProperty({ description: '回复数', example: 100 })
  replyCount!: number

  @ApiProperty({ description: '收藏数', example: 5 })
  favoriteCount!: number

  @ApiProperty({ description: '徽章列表', type: [Object] })
  badges!: Array<{
    id: number
    name: string
    icon: string
    description: string
  }>

  @ApiProperty({ description: '注册时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

/**
 * 用户主题列表DTO
 */
export class UserTopicListDto {
  @ApiProperty({ description: '主题ID', example: 1 })
  id!: number

  @ApiProperty({ description: '主题标题', example: '测试主题' })
  title!: string

  @ApiProperty({ description: '板块ID', example: 1 })
  sectionId!: number

  @ApiProperty({ description: '板块名称', example: '技术交流' })
  sectionName!: string

  @ApiProperty({ description: '回复数', example: 10 })
  replyCount!: number

  @ApiProperty({ description: '浏览数', example: 100 })
  viewCount!: number

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

/**
 * 用户回复列表DTO
 */
export class UserReplyListDto {
  @ApiProperty({ description: '回复ID', example: 1 })
  id!: number

  @ApiProperty({ description: '主题ID', example: 1 })
  topicId!: number

  @ApiProperty({ description: '主题标题', example: '测试主题' })
  topicTitle!: string

  @ApiProperty({ description: '回复内容', example: '这是回复内容' })
  content!: string

  @ApiProperty({ description: '点赞数', example: 5 })
  likeCount!: number

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

/**
 * 用户收藏列表DTO
 */
export class UserFavoriteListDto {
  @ApiProperty({ description: '主题ID', example: 1 })
  topicId!: number

  @ApiProperty({ description: '主题标题', example: '测试主题' })
  topicTitle!: number

  @ApiProperty({ description: '板块ID', example: 1 })
  sectionId!: number

  @ApiProperty({ description: '板块名称', example: '技术交流' })
  sectionName!: string

  @ApiProperty({ description: '回复数', example: 10 })
  replyCount!: number

  @ApiProperty({ description: '浏览数', example: 100 })
  viewCount!: number

  @ApiProperty({ description: '收藏时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

/**
 * 积分记录DTO
 */
export class PointRecordDto {
  @ApiProperty({ description: '记录ID', example: 1 })
  id!: number

  @ApiProperty({ description: '积分变化值', example: 10 })
  points!: number

  @ApiProperty({ description: '原因', example: '发布主题' })
  reason!: string

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

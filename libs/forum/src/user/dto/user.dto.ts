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
import { UserStatusEnum } from '../user.constant'

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
 * 更新用户状态DTO
 */
export class UpdateUserStatusDto extends PickType(BaseForumProfileDto, [
  'userId',
  'status',
  'banReason',
]) {}

/**
 * 授予徽章DTO
 */
export class GrantBadgeDto extends PickType(BaseForumProfileDto, ['userId']) {
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
export class RevokeBadgeDto extends GrantBadgeDto {}

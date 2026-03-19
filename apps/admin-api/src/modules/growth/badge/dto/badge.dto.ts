import { BaseUserBadgeDto } from '@libs/growth'
import {
  ArrayProperty,
  DateProperty,
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

export class CreateUserBadgeDto extends OmitType(
  BaseUserBadgeDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserBadgeDto extends IntersectionType(
  CreateUserBadgeDto,
  IdDto,
) {}

export class UpdateUserBadgeStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseUserBadgeDto, ['isEnabled'] as const),
) {}

export class QueryUserBadgeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(
      BaseUserBadgeDto,
      ['name', 'type', 'isEnabled', 'business', 'eventKey'] as const,
    ),
  ),
) {}

export class AssignUserBadgeDto {
  @NumberProperty({
    description: '徽章id',
    example: 1,
    required: true,
  })
  badgeId!: number

  @NumberProperty({
    description: '用户id',
    example: 1,
    required: true,
  })
  userId!: number
}

export class BadgeUserInfoDto {
  @NumberProperty({ description: '用户ID', example: 1, validation: false })
  id!: number

  @StringProperty({
    description: '昵称',
    example: '测试用户',
    required: false,
    validation: false,
  })
  nickname?: string

  @StringProperty({
    description: '头像地址',
    example: 'https://example.com/avatar.png',
    required: false,
    validation: false,
  })
  avatar?: string

  @StringProperty({
    description: '等级名称',
    example: '新手',
    required: false,
    validation: false,
  })
  level?: string

  @NumberProperty({
    description: '当前积分',
    example: 120,
    validation: false,
  })
  point!: number
}

export class BadgeUserPageItemDto extends PickType(IdDto, ['id'] as const) {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '徽章ID',
    example: 1,
    validation: false,
  })
  badgeId!: number

  @DateProperty({
    description: '创建时间',
    example: '2026-03-19T12:00:00.000Z',
    validation: false,
  })
  createdAt!: Date

  @NestedProperty({
    description: '用户信息',
    type: BadgeUserInfoDto,
    validation: false,
  })
  user!: BadgeUserInfoDto
}

export class UserBadgeTypeDistributionItemDto {
  @NumberProperty({ description: '徽章类型', example: 1, validation: false })
  type!: number

  @NumberProperty({ description: '数量', example: 10, validation: false })
  count!: number
}

export class UserBadgeTopBadgeItemDto {
  @NestedProperty({
    description: '徽章信息',
    type: BaseUserBadgeDto,
    required: false,
    validation: false,
  })
  badge?: BaseUserBadgeDto

  @NumberProperty({ description: '分配次数', example: 20, validation: false })
  count!: number
}

export class UserBadgeStatisticsDto {
  @NumberProperty({ description: '总徽章数', example: 12, validation: false })
  totalBadges!: number

  @NumberProperty({ description: '启用数', example: 10, validation: false })
  enabledCount!: number

  @NumberProperty({ description: '停用数', example: 2, validation: false })
  disabledCount!: number

  @NumberProperty({ description: '总分配次数', example: 200, validation: false })
  totalAssignments!: number

  @ArrayProperty({
    description: '类型分布',
    itemClass: UserBadgeTypeDistributionItemDto,
    itemType: 'object',
    validation: false,
  })
  typeDistribution!: UserBadgeTypeDistributionItemDto[]

  @ArrayProperty({
    description: '热门徽章',
    itemClass: UserBadgeTopBadgeItemDto,
    itemType: 'object',
    validation: false,
  })
  topBadges!: UserBadgeTopBadgeItemDto[]
}

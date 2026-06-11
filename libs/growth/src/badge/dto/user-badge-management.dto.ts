import {
  ArrayProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'

import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { UserBadgeTypeEnum } from '../user-badge.constant'
import { BaseUserBadgeAssignmentDto } from './user-badge-assignment.dto'
import { BaseUserBadgeDto, UserBadgeOutputDto } from './user-badge.dto'

export class QueryUserBadgeFiltersDto extends PartialType(
  PickType(BaseUserBadgeDto, [
    'name',
    'type',
    'isEnabled',
    'business',
    'eventKey',
  ] as const),
) {}

class CreateUserBadgeRequiredFieldsDto extends OmitType(
  BaseUserBadgeDto,
  [
    ...OMIT_BASE_FIELDS,
    'description',
    'icon',
    'business',
    'eventKey',
  ] as const,
) {}

class CreateUserBadgeOptionalFieldsDto extends PartialType(
  PickType(BaseUserBadgeDto, [
    'description',
    'icon',
    'business',
    'eventKey',
  ] as const),
) {}

export class CreateUserBadgeDto extends IntersectionType(
  CreateUserBadgeRequiredFieldsDto,
  CreateUserBadgeOptionalFieldsDto,
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
  PickType(PageDto, ['pageSize', 'pageIndex', 'orderBy'] as const),
  QueryUserBadgeFiltersDto,
) {}

class QueryUserBadgePublicFiltersDto extends PartialType(
  PickType(BaseUserBadgeDto, ['name', 'type', 'isEnabled'] as const),
) {}

export class QueryUserBadgePublicDto extends IntersectionType(
  PickType(PageDto, ['pageSize', 'pageIndex', 'orderBy'] as const),
  QueryUserBadgePublicFiltersDto,
) {}

export class AssignUserBadgeDto extends PickType(BaseUserBadgeAssignmentDto, [
  'badgeId',
  'userId',
] as const) {}

export class QueryBadgeUserPageDto extends IntersectionType(
  PickType(PageDto, ['pageSize', 'pageIndex', 'orderBy'] as const),
  PickType(BaseUserBadgeAssignmentDto, ['badgeId'] as const),
) {}

class BadgeUserNullableOutputFieldsDto {
  @StringProperty({
    description: '头像地址',
    example: 'https://example.com/avatar.png',
    nullable: true,
    validation: false,
  })
  avatar!: string | null

  @StringProperty({
    description: '等级名称',
    example: '新手',
    nullable: true,
    validation: false,
  })
  level!: string | null

  @NumberProperty({
    description: '当前积分',
    example: 120,
    validation: false,
  })
  point!: number
}

export class BadgeUserInfoDto extends IntersectionType(
  PickType(BaseAppUserDto, ['id', 'nickname'] as const),
  BadgeUserNullableOutputFieldsDto,
) {}

export class BadgeUserPageItemDto extends BaseUserBadgeAssignmentDto {
  @NestedProperty({
    description: '用户信息',
    type: BadgeUserInfoDto,
    validation: false,
    nullable: false,
  })
  user!: BadgeUserInfoDto
}

export class UserBadgeItemDto extends PickType(BaseUserBadgeAssignmentDto, [
  'createdAt',
] as const) {
  @NestedProperty({
    description: '徽章详情',
    type: UserBadgeOutputDto,
    validation: false,
    nullable: false,
  })
  badge!: UserBadgeOutputDto
}

export class UserBadgePublicInfoDto extends PickType(UserBadgeOutputDto, [
  'id',
  'name',
  'description',
  'icon',
  'type',
  'isEnabled',
] as const) {}

export class UserBadgePublicItemDto extends PickType(
  BaseUserBadgeAssignmentDto,
  ['createdAt'] as const,
) {
  @NestedProperty({
    description: '徽章详情',
    type: UserBadgePublicInfoDto,
    validation: false,
    nullable: false,
  })
  badge!: UserBadgePublicInfoDto
}

export class UserBadgeTypeDistributionItemDto {
  @EnumProperty({
    description: '徽章类型（1=系统徽章；2=成就徽章；3=活动徽章）',
    example: UserBadgeTypeEnum.System,
    enum: UserBadgeTypeEnum,
    validation: false,
  })
  type!: UserBadgeTypeEnum

  @NumberProperty({ description: '数量', example: 10, validation: false })
  count!: number
}

export class UserBadgeTopBadgeItemDto {
  @NestedProperty({
    description: '徽章信息',
    type: UserBadgeOutputDto,
    nullable: true,
    validation: false,
  })
  badge!: UserBadgeOutputDto | null

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
    validation: false,
  })
  typeDistribution!: UserBadgeTypeDistributionItemDto[]

  @ArrayProperty({
    description: '热门徽章',
    itemClass: UserBadgeTopBadgeItemDto,
    validation: false,
  })
  topBadges!: UserBadgeTopBadgeItemDto[]
}

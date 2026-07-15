import {
  AdminAppUserExperienceStatsDto,
  AdminAppUserLevelDto,
} from '@libs/growth/admin-app-user/dto/admin-app-user-growth.dto'
import { UserPointStatsFieldsDto } from '@libs/growth/dto/app-user-growth-shared.dto'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { PageDto, UserIdDto } from '@libs/platform/dto'

import { AppUserDeletedScopeEnum } from '@libs/user/app-user.constant'
import { BaseAppUserCountDto } from '@libs/user/dto/base-app-user-count.dto'
import {
  AppUserResponseDto,
  BaseAppUserDto,
} from '@libs/user/dto/base-app-user.dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class AdminAppUserCountDto extends OmitType(BaseAppUserCountDto, [
  'userId',
  'createdAt',
  'updatedAt',
] as const) {}

export class AdminAppUserPageItemDto extends AppUserResponseDto {
  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    nullable: true,
    validation: false,
  })
  declare deletedAt: Date | null

  @StringProperty({
    description: '等级名称',
    example: '新手',
    nullable: true,
    validation: false,
  })
  levelName!: string | null

  @NestedProperty({
    description: '用户计数',
    type: AdminAppUserCountDto,
    validation: false,
    nullable: false,
  })
  counts!: AdminAppUserCountDto
}

export class AdminAppUserDetailDto extends AppUserResponseDto {
  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    nullable: true,
    validation: false,
  })
  declare deletedAt: Date | null

  @NestedProperty({
    description: '等级信息',
    type: AdminAppUserLevelDto,
    validation: false,
    nullable: true,
  })
  level!: AdminAppUserLevelDto | null

  @NestedProperty({
    description: '用户计数',
    type: AdminAppUserCountDto,
    validation: false,
    nullable: false,
  })
  counts!: AdminAppUserCountDto

  @NumberProperty({
    description: '已拥有徽章数量',
    example: 3,
    validation: false,
  })
  badgeCount!: number

  @NestedProperty({
    description: '积分统计',
    type: UserPointStatsFieldsDto,
    validation: false,
    nullable: false,
  })
  pointStats!: UserPointStatsFieldsDto

  @NestedProperty({
    description: '经验统计',
    type: AdminAppUserExperienceStatsDto,
    validation: false,
    nullable: false,
  })
  experienceStats!: AdminAppUserExperienceStatsDto
}

export class QueryAdminAppUserPageDto extends IntersectionType(
  PartialType(
    PickType(BaseAppUserDto, [
      'id',
      'account',
      'phoneNumber',
      'nickname',
      'emailAddress',
      'isEnabled',
      'status',
      'levelId',
    ] as const),
  ),
  PageDto,
) {
  @EnumProperty({
    description: '删除态筛选（0=未删除；1=已删除；2=全部）',
    enum: AppUserDeletedScopeEnum,
    example: AppUserDeletedScopeEnum.ACTIVE,
    required: false,
    default: AppUserDeletedScopeEnum.ACTIVE,
  })
  deletedScope?: AppUserDeletedScopeEnum

  @StringProperty({
    description: '最后登录开始时间',
    example: '2026-03-01',
    required: false,
    type: 'ISO8601',
  })
  lastLoginStartDate?: string

  @StringProperty({
    description: '最后登录结束时间',
    example: '2026-03-08',
    required: false,
    type: 'ISO8601',
  })
  lastLoginEndDate?: string

  @StringProperty({
    description: '注册开始时间',
    example: '2026-03-01',
    required: false,
    type: 'ISO8601',
  })
  declare startDate?: string

  @StringProperty({
    description: '注册结束时间',
    example: '2026-03-08',
    required: false,
    type: 'ISO8601',
  })
  declare endDate?: string
}

export class AdminAppUserFollowCountRepairResultDto extends IntersectionType(
  UserIdDto,
  PickType(AdminAppUserCountDto, [
    'followingUserCount',
    'followingAuthorCount',
    'followingSectionCount',
    'followersCount',
  ] as const),
) {}

export class CreateAdminAppUserDto extends IntersectionType(
  PickType(BaseAppUserDto, ['nickname'] as const),
  PartialType(
    PickType(BaseAppUserDto, [
      'phoneNumber',
      'emailAddress',
      'avatarUrl',
      'profileBackgroundImageUrl',
      'genderType',
      'birthDate',
      'isEnabled',
      'status',
      'signature',
      'bio',
    ] as const),
  ),
) {
  @StringProperty({
    description: '前端 RSA 加密后的密码',
    example: 'Base64EncodedCipherText',
    required: true,
    maxLength: 2000,
  })
  password!: string
}

export class ResetAdminAppUserPasswordDto extends PickType(BaseAppUserDto, [
  'id',
] as const) {
  @StringProperty({
    description: '前端 RSA 加密后的新密码',
    example: 'Base64EncodedCipherText',
    required: true,
    maxLength: 2000,
  })
  password!: string
}

export class UpdateAdminAppUserProfileDto extends IntersectionType(
  PickType(BaseAppUserDto, ['id'] as const),
  PartialType(
    PickType(BaseAppUserDto, [
      'nickname',
      'avatarUrl',
      'profileBackgroundImageUrl',
      'phoneNumber',
      'emailAddress',
      'genderType',
      'birthDate',
      'signature',
      'bio',
    ] as const),
  ),
) {}

export class UpdateAdminAppUserEnabledDto extends PickType(BaseAppUserDto, [
  'id',
  'isEnabled',
] as const) {}

export class UpdateAdminAppUserStatusDto extends IntersectionType(
  PickType(BaseAppUserDto, ['id', 'status'] as const),
  PartialType(PickType(BaseAppUserDto, ['banReason', 'banUntil'] as const)),
) {}

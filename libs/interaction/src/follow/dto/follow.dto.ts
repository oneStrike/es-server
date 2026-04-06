import { BaseAuthorDto } from '@libs/content/author/dto/author.dto';
import { PublicForumSectionListItemDto } from '@libs/forum/section/dto/forum-section.dto';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { IdDto, UserIdDto } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto';
import { IntersectionType, PickType } from '@nestjs/swagger'
import { FollowTargetTypeEnum } from '../follow.constant'

/**
 * 关注记录基础 DTO（全量字段）
 */
export class BaseFollowDto extends IntersectionType(IdDto, UserIdDto) {
  @EnumProperty({
    description: '关注目标类型（1=用户，2=作者，3=论坛板块）',
    enum: FollowTargetTypeEnum,
    example: FollowTargetTypeEnum.USER,
    required: true,
  })
  targetType!: FollowTargetTypeEnum

  @NumberProperty({
    description: '关注目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class FollowTargetDto extends PickType(BaseFollowDto, [
  'targetId',
  'targetType',
] as const) {}

export class FollowRecordDto extends IntersectionType(
  FollowTargetDto,
  PickType(BaseFollowDto, ['userId'] as const),
) {}

export class FollowPageCommandDto extends IntersectionType(
  PageDto,
  PickType(BaseFollowDto, ['userId'] as const),
) {}

/**
 * 关注状态 DTO。
 */
export class FollowStatusResponseDto {
  @BooleanProperty({
    description: '当前用户是否已关注目标',
    example: true,
    validation: false,
  })
  isFollowing!: boolean

  @BooleanProperty({
    description: '目标用户是否已关注当前用户，仅用户目标有意义',
    example: true,
    validation: false,
  })
  isFollowedByTarget!: boolean

  @BooleanProperty({
    description: '是否互相关注',
    example: true,
    validation: false,
  })
  isMutualFollow!: boolean
}

/**
 * 关注用户摘要 DTO。
 */
export class FollowUserBriefDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
  'signature',
] as const) {
  @NumberProperty({
    description: '关注用户数',
    example: 12,
    required: false,
    validation: false,
  })
  followingUserCount?: number

  @NumberProperty({
    description: '关注作者数',
    example: 6,
    required: false,
    validation: false,
  })
  followingAuthorCount?: number

  @NumberProperty({
    description: '关注板块数',
    example: 4,
    required: false,
    validation: false,
  })
  followingSectionCount?: number

  @NumberProperty({
    description: '粉丝数',
    example: 34,
    required: false,
    validation: false,
  })
  followersCount?: number
}

/**
 * 关注作者摘要 DTO。
 */
export class FollowAuthorBriefDto extends PickType(BaseAuthorDto, [
  'id',
  'name',
  'avatar',
  'type',
  'followersCount',
] as const) {
  @BooleanProperty({
    description: '当前用户是否已关注该作者',
    example: true,
    validation: false,
  })
  isFollowed!: boolean
}

/**
 * 关注作者分页项 DTO。
 */
export class FollowAuthorPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '作者信息',
    type: FollowAuthorBriefDto,
    required: false,
    validation: false,
    nullable: false,
  })
  author!: FollowAuthorBriefDto
}

/**
 * 关注板块分页项 DTO。
 */
export class FollowSectionPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '板块信息',
    type: PublicForumSectionListItemDto,
    required: false,
    validation: false,
    nullable: false,
  })
  section!: PublicForumSectionListItemDto
}

/**
 * 关注用户分页项 DTO。
 */
export class FollowUserPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '用户简要信息',
    type: FollowUserBriefDto,
    required: false,
    validation: false,
    nullable: false,
  })
  user!: FollowUserBriefDto

  @BooleanProperty({
    description: '当前用户是否已关注该用户',
    example: true,
    validation: false,
  })
  isFollowing!: boolean

  @BooleanProperty({
    description: '该用户是否已关注当前用户',
    example: true,
    validation: false,
  })
  isFollowedByTarget!: boolean

  @BooleanProperty({
    description: '是否互相关注',
    example: true,
    validation: false,
  })
  isMutualFollow!: boolean
}

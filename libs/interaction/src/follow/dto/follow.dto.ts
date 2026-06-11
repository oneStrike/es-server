import {
  AuthorNullableOutputFieldsDto,
  BaseAuthorDto,
} from '@libs/content/author/dto/author.dto'
import { ForumHashtagBriefDto } from '@libs/forum/hashtag/dto/forum-hashtag.dto'
import { PublicForumSectionListItemDto } from '@libs/forum/section/dto/forum-section.dto'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { IdDto, UserIdDto } from '@libs/platform/dto/base.dto'
import { CursorPageSizeDto, PageDto } from '@libs/platform/dto/page.dto'

import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
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
    validation: false,
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
  CursorPageSizeDto,
  PickType(BaseFollowDto, ['userId'] as const),
) {
  @StringProperty({
    description: '下一页游标；按创建时间倒序和 ID 倒序翻页',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6MTAwfQ',
    required: false,
  })
  cursor?: string
}

/**
 * 用户关注分页查询 DTO。
 * userId 非必填；未传时由控制层回退到 CurrentUser。
 */
export class QueryUserFollowPageDto extends IntersectionType(
  PartialType(UserIdDto),
  CursorPageSizeDto,
) {
  @StringProperty({
    description: '下一页游标；按创建时间倒序和 ID 倒序翻页',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6MTAwfQ',
    required: false,
  })
  cursor?: string
}

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
    validation: false,
  })
  followingUserCount!: number

  @NumberProperty({
    description: '关注作者数',
    example: 6,
    validation: false,
  })
  followingAuthorCount!: number

  @NumberProperty({
    description: '关注板块数',
    example: 4,
    validation: false,
  })
  followingSectionCount!: number

  @NumberProperty({
    description: '关注话题数',
    example: 3,
    validation: false,
  })
  followingHashtagCount!: number

  @NumberProperty({
    description: '粉丝数',
    example: 34,
    validation: false,
  })
  followersCount!: number
}

/**
 * 关注作者摘要 DTO。
 */
export class FollowAuthorBriefDto extends IntersectionType(
  PickType(BaseAuthorDto, ['id', 'name', 'followersCount'] as const),
  PickType(AuthorNullableOutputFieldsDto, ['avatar', 'type'] as const),
) {
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
    required: true,
    validation: false,
    nullable: true,
  })
  author!: FollowAuthorBriefDto | null
}

/**
 * 关注板块分页项 DTO。
 */
export class FollowSectionPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '板块信息',
    type: PublicForumSectionListItemDto,
    required: true,
    validation: false,
    nullable: true,
  })
  section!: PublicForumSectionListItemDto | null
}

/**
 * 关注话题分页项 DTO。
 */
export class FollowHashtagPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '话题信息',
    type: ForumHashtagBriefDto,
    required: true,
    validation: false,
    nullable: true,
  })
  hashtag!: ForumHashtagBriefDto | null
}

/**
 * 关注用户分页项 DTO。
 */
export class FollowUserPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '用户简要信息',
    type: FollowUserBriefDto,
    required: true,
    validation: false,
    nullable: true,
  })
  user!: FollowUserBriefDto | null

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

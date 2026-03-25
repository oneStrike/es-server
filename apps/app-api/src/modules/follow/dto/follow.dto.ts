import { BaseAuthorDto } from '@libs/content/author'
import { BaseFollowDto } from '@libs/interaction/follow'
import {
  BooleanProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { BaseAppUserDto } from '@libs/user/core'
import {
  PickType,
} from '@nestjs/swagger'
import { AppForumSectionListItemDto } from '../../forum/dto/forum-section.dto'

export class FollowTargetDto extends PickType(BaseFollowDto, [
  'targetId',
  'targetType',
] as const) {}

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

export class FollowUserBriefDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
  'signature',
] as const) {
  @NumberProperty({
    description: '关注数',
    example: 12,
    required: false,
    validation: false,
  })
  followingCount?: number

  @NumberProperty({
    description: '粉丝数',
    example: 34,
    required: false,
    validation: false,
  })
  followersCount?: number
}

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

export class FollowAuthorPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '作者信息',
    type: FollowAuthorBriefDto,
    required: false,
    validation: false,
  })
  author?: FollowAuthorBriefDto
}

export class FollowSectionPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '板块信息',
    type: AppForumSectionListItemDto,
    required: false,
    validation: false,
  })
  section?: AppForumSectionListItemDto
}

export class FollowUserPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '用户简要信息',
    type: FollowUserBriefDto,
    required: false,
    validation: false,
  })
  user?: FollowUserBriefDto

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

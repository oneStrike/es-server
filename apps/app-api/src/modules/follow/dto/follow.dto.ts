import { BaseFollowDto } from '@libs/interaction'
import {
  ArrayProperty,
  BooleanProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class FollowTargetDto extends PickType(BaseFollowDto, [
  'targetId',
  'targetType',
] as const) {}

export class FollowPageQueryDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseFollowDto, ['targetType'] as const)),
) {}

export class FollowUserPageQueryDto extends PageDto {}

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

export class FollowRecordResultDto extends IdDto {}

export class FollowTargetDetailDto extends IdDto {
  @StringProperty({
    description: '用户昵称（用户目标返回）',
    example: 'Lonsun',
    required: false,
    validation: false,
  })
  nickname?: string

  @StringProperty({
    description: '用户头像（用户目标返回）',
    example: 'https://example.com/avatar.jpg',
    required: false,
    validation: false,
  })
  avatarUrl?: string

  @StringProperty({
    description: '用户签名（用户目标返回）',
    example: '持续输出，永不停歇。',
    required: false,
    validation: false,
  })
  signature?: string

  @StringProperty({
    description: '作者名称（作者目标返回）',
    example: '村上春树',
    required: false,
    validation: false,
  })
  name?: string

  @StringProperty({
    description: '作者头像（作者目标返回）',
    example: 'https://example.com/author.jpg',
    required: false,
    validation: false,
  })
  avatar?: string

  @StringProperty({
    description: '板块描述（板块目标返回）',
    example: '讨论技术相关问题',
    required: false,
    validation: false,
  })
  description?: string

  @StringProperty({
    description: '板块图标（板块目标返回）',
    example: 'https://example.com/section-icon.png',
    required: false,
    validation: false,
  })
  icon?: string

  @ArrayProperty({
    description: '作者类型（作者目标返回）',
    itemType: 'number',
    example: [1, 2],
    required: false,
    validation: false,
  })
  type?: number[]

  @NumberProperty({
    description: '关注数',
    example: 12,
    required: false,
    validation: false,
  })
  followingCount?: number

  @NumberProperty({
    description: '粉丝数/关注人数',
    example: 34,
    required: false,
    validation: false,
  })
  followersCount?: number

  @NumberProperty({
    description: '主题数（板块目标返回）',
    example: 21,
    required: false,
    validation: false,
  })
  topicCount?: number

  @NumberProperty({
    description: '回复数（板块目标返回）',
    example: 89,
    required: false,
    validation: false,
  })
  replyCount?: number
}

export class FollowPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '目标简要信息',
    type: FollowTargetDetailDto,
    required: false,
    validation: false,
  })
  targetDetail?: FollowTargetDetailDto
}

export class FollowUserPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '用户简要信息',
    type: FollowTargetDetailDto,
    required: false,
    validation: false,
  })
  user?: FollowTargetDetailDto

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

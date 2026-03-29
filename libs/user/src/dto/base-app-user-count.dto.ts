import {
  DateProperty,
  NumberProperty,
} from '@libs/platform/decorators'

/**
 * 应用用户计数基类 DTO
 * 对齐 app_user_count 的对外计数字段定义
 */
export class BaseAppUserCountDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '发出的评论总数',
    example: 48,
    default: 0,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '发出的点赞总数',
    example: 66,
    default: 0,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '发出的收藏总数',
    example: 9,
    default: 0,
    validation: false,
  })
  favoriteCount!: number

  @NumberProperty({
    description: '关注用户总数',
    example: 21,
    default: 0,
    validation: false,
  })
  followingUserCount!: number

  @NumberProperty({
    description: '关注作者总数',
    example: 6,
    default: 0,
    validation: false,
  })
  followingAuthorCount!: number

  @NumberProperty({
    description: '关注板块总数',
    example: 4,
    default: 0,
    validation: false,
  })
  followingSectionCount!: number

  @NumberProperty({
    description: '用户粉丝总数',
    example: 34,
    default: 0,
    validation: false,
  })
  followersCount!: number

  @NumberProperty({
    description: '论坛主题数',
    example: 12,
    default: 0,
    validation: false,
  })
  forumTopicCount!: number

  @NumberProperty({
    description: '评论收到的点赞总数',
    example: 18,
    default: 0,
    validation: false,
  })
  commentReceivedLikeCount!: number

  @NumberProperty({
    description: '论坛主题收到的点赞总数',
    example: 25,
    default: 0,
    validation: false,
  })
  forumTopicReceivedLikeCount!: number

  @NumberProperty({
    description: '论坛主题收到的收藏总数',
    example: 7,
    default: 0,
    validation: false,
  })
  forumTopicReceivedFavoriteCount!: number

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  updatedAt!: Date
}

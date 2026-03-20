import {
  DateProperty,
  NumberProperty,
} from '@libs/platform/decorators'

/**
 * 应用用户计数基类 DTO
 * 对齐 app_user_count 表定义
 */
export class BaseAppUserCountDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '论坛主题数',
    example: 12,
    default: 0,
    validation: false,
  })
  forumTopicCount!: number

  @NumberProperty({
    description: '论坛回复数',
    example: 48,
    default: 0,
    validation: false,
  })
  forumReplyCount!: number

  @NumberProperty({
    description: '论坛收到的点赞数',
    example: 66,
    default: 0,
    validation: false,
  })
  forumReceivedLikeCount!: number

  @NumberProperty({
    description: '论坛收到的收藏数',
    example: 9,
    default: 0,
    validation: false,
  })
  forumReceivedFavoriteCount!: number

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

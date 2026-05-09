import { DateProperty, NumberProperty } from '@libs/platform/decorators'

export class BaseUserAssetsSummaryDto {
  @NumberProperty({
    description: '虚拟币余额',
    example: 1000,
    validation: false,
  })
  currencyBalance!: number

  @DateProperty({
    description: 'VIP 到期时间',
    example: '2026-06-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  vipExpiresAt!: Date | null

  @NumberProperty({
    description: '可用券数量',
    example: 3,
    validation: false,
  })
  availableCouponCount!: number

  @NumberProperty({
    description: '已购买作品数',
    example: 5,
    validation: false,
  })
  purchasedWorkCount!: number

  @NumberProperty({
    description: '已购买章节数',
    example: 42,
    validation: false,
  })
  purchasedChapterCount!: number

  @NumberProperty({
    description: '已下载作品数',
    example: 3,
    validation: false,
  })
  downloadedWorkCount!: number

  @NumberProperty({
    description: '已下载章节数',
    example: 18,
    validation: false,
  })
  downloadedChapterCount!: number

  @NumberProperty({
    description: '收藏数量',
    example: 22,
    validation: false,
  })
  favoriteCount!: number

  @NumberProperty({
    description: '点赞数量',
    example: 31,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '浏览数量',
    example: 78,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '评论数量',
    example: 12,
    validation: false,
  })
  commentCount!: number
}

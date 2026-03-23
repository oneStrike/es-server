import { NumberProperty } from '@libs/platform/decorators'

export class BaseUserAssetsSummaryDto {
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

import { WorkViewPermissionEnum } from '@libs/platform/constant/content.constant'
import { WorkService } from './work.service'

describe('WorkService', () => {
  it('returns chapterPurchasePricing for public work detail', async () => {
    const buildPurchasePricing = jest.fn().mockReturnValue({
      originalPrice: 30,
      payableRate: 0.9,
      payablePrice: 27,
      discountAmount: 3,
    })
    const service = new WorkService(
      {
        db: {
          query: {
            work: {
              findFirst: jest.fn().mockResolvedValue({
                id: 1,
                name: '测试作品',
                type: 1,
                cover: 'cover.png',
                popularity: 0,
                isRecommended: false,
                isHot: false,
                isNew: false,
                serialStatus: 1,
                publisher: 'publisher',
                language: 'zh-CN',
                region: 'CN',
                ageRating: '16+',
                createdAt: new Date('2026-04-12T00:00:00.000Z'),
                updatedAt: new Date('2026-04-12T00:00:00.000Z'),
                publishAt: new Date('2026-04-12T00:00:00.000Z'),
                isPublished: true,
                alias: 'alias',
                description: 'description',
                originalSource: 'source',
                copyright: 'copyright',
                disclaimer: 'disclaimer',
                lastUpdated: 'today',
                viewRule: WorkViewPermissionEnum.PURCHASE,
                requiredViewLevelId: null,
                forumSectionId: 1,
                chapterPrice: 30,
                canComment: true,
                viewCount: 0,
                favoriteCount: 0,
                likeCount: 0,
                commentCount: 0,
                downloadCount: 0,
                rating: 5,
                authors: [],
                categories: [],
                tags: [],
              }),
            },
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        resolveUserPurchasePayableRate: jest.fn().mockResolvedValue(0.9),
        buildPurchasePricing,
      } as any,
    )

    const result = await service.getWorkDetail(1)

    expect(result).toMatchObject({
      viewRule: WorkViewPermissionEnum.PURCHASE,
      chapterPurchasePricing: {
        originalPrice: 30,
        payableRate: 0.9,
        payablePrice: 27,
        discountAmount: 3,
      },
    })
    expect(result).not.toHaveProperty('chapterPrice')
    expect(buildPurchasePricing).toHaveBeenCalledWith(30, 0.9)
  })
})

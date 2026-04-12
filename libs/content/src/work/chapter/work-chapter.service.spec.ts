import { WorkViewPermissionEnum } from '@libs/platform/constant/content.constant'
import { WorkChapterService } from './work-chapter.service'

describe('work chapter service', () => {
  function createService() {
    return new WorkChapterService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
  }

  it('构建 app 章节详情时使用生效权限和价格对象而不是原始价格字段', () => {
    const service = createService()

    const result = (service as any).buildPublicChapterDetail({
      id: 1,
      workId: 2,
      workType: 1,
      title: '第 1 话',
      subtitle: '开始',
      cover: 'https://example.com/cover.jpg',
      description: '章节说明',
      sortOrder: 1,
      isPublished: true,
      isPreview: false,
      publishAt: new Date('2026-04-12T00:00:00.000Z'),
      viewRule: WorkViewPermissionEnum.INHERIT,
      requiredViewLevelId: null,
      price: 1,
      canDownload: true,
      canComment: true,
      content: 'content',
      wordCount: 100,
      viewCount: 5,
      likeCount: 6,
      commentCount: 7,
      purchaseCount: 8,
      downloadCount: 9,
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      resolvedViewRule: WorkViewPermissionEnum.PURCHASE,
      resolvedRequiredViewLevelId: 11,
      purchasePricing: {
        originalPrice: 30,
        payableRate: 0.9,
        payablePrice: 27,
        discountAmount: 3,
      },
    })

    expect(result).toMatchObject({
      viewRule: WorkViewPermissionEnum.PURCHASE,
      requiredViewLevelId: 11,
      purchasePricing: {
        originalPrice: 30,
        payableRate: 0.9,
        payablePrice: 27,
        discountAmount: 3,
      },
    })
    expect(result).not.toHaveProperty('price')
  })
})

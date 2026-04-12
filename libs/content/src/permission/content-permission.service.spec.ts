import {
  ContentTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant/content.constant'
import { ContentPermissionService } from './content-permission.service'

describe('content permission service', () => {
  function createService() {
    const drizzle = {
      db: {
        query: {
          work: {
            findFirst: jest.fn(),
          },
          workChapter: {
            findFirst: jest.fn(),
          },
          appUser: {
            findFirst: jest.fn(),
          },
          userPurchaseRecord: {
            findFirst: jest.fn(),
          },
        },
      },
      schema: {},
    }

    return {
      drizzle,
      service: new ContentPermissionService(drizzle as never),
    }
  }

  it('resolveChapterPermission 会为继承购买章节返回生效价格和折扣价', async () => {
    const { service, drizzle } = createService()

    drizzle.db.query.workChapter.findFirst.mockResolvedValue({
      workId: 10,
      workType: ContentTypeEnum.COMIC,
      viewRule: WorkViewPermissionEnum.INHERIT,
      requiredViewLevelId: null,
      price: 1,
      canDownload: true,
      canComment: true,
      isPreview: false,
      requiredViewLevel: null,
    })
    drizzle.db.query.work.findFirst.mockResolvedValue({
      viewRule: WorkViewPermissionEnum.PURCHASE,
      requiredViewLevelId: 7,
      chapterPrice: 30,
      canComment: true,
      requiredViewLevel: {
        requiredExperience: 600,
      },
    })
    drizzle.db.query.appUser.findFirst.mockResolvedValue({
      id: 1,
      levelId: 2,
      level: {
        purchasePayableRate: '0.90',
        isEnabled: true,
      },
    })

    const result = await service.resolveChapterPermission(99, 1)

    expect(result).toEqual({
      workType: ContentTypeEnum.COMIC,
      canDownload: true,
      viewRule: WorkViewPermissionEnum.PURCHASE,
      requiredViewLevelId: 7,
      requiredExperience: 600,
      isPreview: false,
      purchasePricing: {
        originalPrice: 30,
        payableRate: 0.9,
        payablePrice: 27,
        discountAmount: 3,
      },
    })
  })

  it('resolveChapterPermission 对非购买章节返回空价格对象', async () => {
    const { service, drizzle } = createService()

    drizzle.db.query.workChapter.findFirst.mockResolvedValue({
      workId: 10,
      workType: ContentTypeEnum.NOVEL,
      viewRule: WorkViewPermissionEnum.ALL,
      requiredViewLevelId: null,
      price: 22,
      canDownload: false,
      canComment: true,
      isPreview: false,
      requiredViewLevel: null,
    })

    const result = await service.resolveChapterPermission(100)

    expect(result).toEqual({
      workType: ContentTypeEnum.NOVEL,
      canDownload: false,
      viewRule: WorkViewPermissionEnum.ALL,
      requiredViewLevelId: null,
      requiredExperience: null,
      isPreview: false,
      purchasePricing: null,
    })
  })

  it('resolvePurchasePricing 会对低价折扣结果向上取整', async () => {
    const { service, drizzle } = createService()

    drizzle.db.query.appUser.findFirst.mockResolvedValue({
      id: 9,
      levelId: 3,
      level: {
        purchasePayableRate: '0.90',
        isEnabled: true,
      },
    })

    const result = await service.resolvePurchasePricing(1, 9)

    expect(result).toEqual({
      originalPrice: 1,
      payableRate: 0.9,
      payablePrice: 1,
      discountAmount: 0,
    })
  })
})

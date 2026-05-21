/// <reference types="jest" />

import { WorkTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant'
import { ContentPermissionService } from './content-permission.service'

function createService(workRows: unknown[] = []) {
  const where = jest.fn(async () => workRows)
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))
  const drizzle = {
    db: { select },
    schema: {
      work: {
        chapterPrice: 'work.chapter_price',
        deletedAt: 'work.deleted_at',
        id: 'work.id',
        viewRule: 'work.view_rule',
      },
      workChapter: {},
    },
  }

  return {
    drizzle,
    service: new ContentPermissionService(
      drizzle as never,
      {} as never,
      {} as never,
    ),
    select,
    where,
  }
}

function inheritedChapter(id: number, workId = 10) {
  return {
    id,
    workId,
    workType: WorkTypeEnum.COMIC,
    viewRule: WorkViewPermissionEnum.INHERIT,
    price: 5,
    canDownload: true,
    canComment: true,
    isPreview: false,
  }
}

describe('ContentPermissionService batch chapter permission resolution', () => {
  it('returns an empty map without querying parent work for empty input', async () => {
    const { service, select } = createService()

    await expect(
      service.resolveChapterPermissionsFromData([]),
    ).resolves.toEqual(new Map())

    expect(select).not.toHaveBeenCalled()
  })

  it('resolves direct chapter rows without querying parent work', async () => {
    const { service, select } = createService()

    const permissions = await service.resolveChapterPermissionsFromData([
      {
        ...inheritedChapter(1),
        viewRule: WorkViewPermissionEnum.PURCHASE,
        price: 7,
      },
    ])

    expect(select).not.toHaveBeenCalled()
    expect(permissions.get(1)).toMatchObject({
      purchasePricing: {
        discountAmount: 0,
        originalPrice: 7,
        payablePrice: 7,
        payableRate: 1,
      },
      requiredViewLevelId: null,
      viewRule: WorkViewPermissionEnum.PURCHASE,
    })
  })

  it('resolves many inherited chapters through one parent work query', async () => {
    const { service, select } = createService([
      {
        id: 10,
        viewRule: WorkViewPermissionEnum.PURCHASE,
        chapterPrice: 10,
      },
    ])
    const chapters = Array.from({ length: 500 }, (_, index) =>
      inheritedChapter(index + 1),
    )

    const permissions =
      await service.resolveChapterPermissionsFromData(chapters)

    expect(select).toHaveBeenCalledTimes(1)
    expect(permissions.size).toBe(500)
    expect(permissions.get(1)).toMatchObject({
      purchasePricing: {
        originalPrice: 10,
        payablePrice: 10,
      },
      viewRule: WorkViewPermissionEnum.PURCHASE,
    })
  })

  it('deduplicates inherited parent work IDs in the batch query', async () => {
    const { service, select } = createService([
      { id: 10, viewRule: WorkViewPermissionEnum.ALL, chapterPrice: 0 },
      { id: 20, viewRule: WorkViewPermissionEnum.VIP, chapterPrice: 0 },
      { id: 30, viewRule: WorkViewPermissionEnum.PURCHASE, chapterPrice: 3 },
    ])

    const permissions = await service.resolveChapterPermissionsFromData([
      inheritedChapter(1, 10),
      inheritedChapter(2, 20),
      inheritedChapter(3, 20),
      inheritedChapter(4, 30),
    ])

    expect(select).toHaveBeenCalledTimes(1)
    expect(permissions.get(2)).toMatchObject({
      requiredViewLevelId: null,
      viewRule: WorkViewPermissionEnum.VIP,
    })
    expect(permissions.get(4)?.purchasePricing?.payablePrice).toBe(3)
  })

  it('throws the same missing-work business error for inherited rows without a parent', async () => {
    const { service } = createService([])

    await expect(
      service.resolveChapterPermissionsFromData([inheritedChapter(1, 404)]),
    ).rejects.toThrow('作品不存在')
  })
})

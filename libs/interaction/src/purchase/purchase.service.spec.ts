import { PurchaseStatusEnum } from './purchase.constant'
import { PurchaseService } from './purchase.service'

function flattenSqlChunks(input: unknown): string {
  if (Array.isArray(input)) {
    return input.map((item) => flattenSqlChunks(item)).join('')
  }

  if (!input || typeof input !== 'object') {
    return typeof input === 'string' ? input : ''
  }

  if ('queryChunks' in input) {
    return flattenSqlChunks((input as { queryChunks: unknown[] }).queryChunks)
  }

  return ''
}

describe('purchaseService history queries', () => {
  let service: PurchaseService
  let executeMock: jest.Mock

  beforeEach(() => {
    executeMock = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            workId: 7,
            workType: 2,
            workName: '已删除小说',
            workCover: 'cover.png',
            purchasedChapterCount: 2n,
            lastPurchasedAt: new Date('2026-04-15T00:00:00.000Z'),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 1n }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            targetType: 2,
            targetId: 101,
            userId: 9,
            originalPrice: 100,
            paidPrice: 80,
            payableRate: '0.80',
            status: 1,
            paymentMethod: 1,
            outTradeNo: null,
            createdAt: new Date('2026-04-15T00:00:00.000Z'),
            updatedAt: new Date('2026-04-15T00:00:00.000Z'),
            chapterId: 101,
            chapterWorkId: 7,
            chapterWorkType: 2,
            chapterTitle: '已删除章节',
            chapterSubtitle: null,
            chapterCover: null,
            chapterSortOrder: 1,
            chapterIsPublished: true,
            chapterPublishAt: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 1n }],
      })

    const drizzle = {
      db: {
        execute: executeMock,
      },
      buildPage: jest
        .fn()
        .mockReturnValueOnce({
          pageIndex: 1,
          pageSize: 10,
          limit: 10,
          offset: 0,
        })
        .mockReturnValueOnce({
          pageIndex: 1,
          pageSize: 10,
          limit: 10,
          offset: 0,
        }),
      schema: {},
    }

    service = new PurchaseService({} as never, drizzle as never, {} as never)
  })

  it('已购作品历史查询 SQL 不再过滤软删除作品或章节', async () => {
    await service.getPurchasedWorks({
      userId: 9,
      pageIndex: 1,
      pageSize: 10,
      status: PurchaseStatusEnum.SUCCESS,
    } as never)

    const sqlText = flattenSqlChunks(executeMock.mock.calls[0][0]).toLowerCase()

    expect(sqlText).not.toContain('wc.deleted_at is null')
    expect(sqlText).not.toContain('w.deleted_at is null')
  })

  it('已购章节历史查询 SQL 不再过滤软删除作品或章节', async () => {
    await service.getPurchasedWorkChapters({
      userId: 9,
      workId: 7,
      pageIndex: 1,
      pageSize: 10,
      status: PurchaseStatusEnum.SUCCESS,
    } as never)

    const sqlText = flattenSqlChunks(executeMock.mock.calls[0][0]).toLowerCase()

    expect(sqlText).not.toContain('wc.deleted_at is null')
    expect(sqlText).not.toContain('w.deleted_at is null')
  })
})

import * as schema from '@db/schema'
import { ContentTypeEnum } from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
import { ReadingStateService } from './reading-state.service'

function createSelectChain(rows: unknown[]) {
  const chain = {
    from: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(async () => rows),
    orderBy: jest.fn(() => chain),
    where: jest.fn(() => chain),
  }

  return chain
}

function createSubject(rows: unknown[] = [], total = 2) {
  const pageQuery = {
    limit: 1,
    offset: 1,
    pageIndex: 2,
    pageSize: 1,
  }
  const selectChain = createSelectChain(rows)
  const drizzle = {
    buildPage: jest.fn(() => pageQuery),
    buildPageParams: jest.fn(() => ({
      page: pageQuery,
      order: {
        orderByClause: sql.raw('last_read_at desc'),
        orderBySql: [],
      },
      dateRange: undefined,
    })),
    db: {
      $count: jest.fn(async () => total),
      select: jest.fn(() => selectChain),
    },
    schema,
  }
  const service = new ReadingStateService(drizzle as any)

  return { drizzle, pageQuery, selectChain, service }
}

describe('ReadingStateService app page contract', () => {
  it('returns reading history with snapshots while preserving database order', async () => {
    const rows = [
      {
        userId: 33,
        workId: 201,
        workType: ContentTypeEnum.COMIC,
        lastReadAt: new Date('2026-06-02T00:00:00.000Z'),
        lastReadChapterId: 301,
      },
      {
        userId: 33,
        workId: 202,
        workType: ContentTypeEnum.COMIC,
        lastReadAt: new Date('2026-06-01T00:00:00.000Z'),
        lastReadChapterId: null,
      },
    ]
    const { drizzle, pageQuery, selectChain, service } = createSubject(rows)
    service.registerResolver({
      workType: ContentTypeEnum.COMIC,
      resolveChapterSnapshot: jest.fn(),
      resolveChapterSnapshots: jest.fn(async () => [
        {
          workId: 201,
          chapterId: 301,
          snapshot: {
            id: 301,
            title: 'Chapter 1',
            subtitle: null,
            cover: null,
            sortOrder: 1,
            shouldDelete: false,
          },
        },
      ]),
      resolveWorkInfoByChapter: jest.fn(),
      resolveWorkSnapshots: jest.fn(async () => [
        {
          id: 201,
          type: ContentTypeEnum.COMIC,
          name: 'Comic A',
          cover: 'a.jpg',
          serialStatus: 1,
          shouldDelete: false,
        },
        {
          id: 202,
          type: ContentTypeEnum.COMIC,
          name: 'Comic B',
          cover: 'b.jpg',
          serialStatus: 1,
          shouldDelete: false,
        },
      ]),
    })

    const page = await service.getUserReadingHistory({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 33, pageIndex: 2, pageSize: 1 }),
      expect.any(Object),
    )
    expect(selectChain.orderBy).toHaveBeenCalled()
    expect(selectChain.limit).toHaveBeenCalledWith(pageQuery.limit)
    expect(selectChain.offset).toHaveBeenCalledWith(pageQuery.offset)
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      schema.userWorkReadingState,
      expect.anything(),
    )
    expect(page).toMatchObject({
      total: 2,
      pageIndex: 2,
      pageSize: 1,
      list: [
        {
          workId: 201,
          work: { id: 201, name: 'Comic A' },
          continueChapter: { id: 301, title: 'Chapter 1' },
        },
        {
          workId: 202,
          work: { id: 202, name: 'Comic B' },
          continueChapter: null,
        },
      ],
    })
    expect(page.list.map((item) => item.workId)).toEqual([201, 202])
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns empty reading history without resolver calls', async () => {
    const { service } = createSubject([])
    const resolveWorkSnapshots = jest.fn()
    service.registerResolver({
      workType: ContentTypeEnum.COMIC,
      resolveChapterSnapshot: jest.fn(),
      resolveWorkInfoByChapter: jest.fn(),
      resolveWorkSnapshots,
    })

    const page = await service.getUserReadingHistory({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(page).toEqual({
      list: [],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(resolveWorkSnapshots).not.toHaveBeenCalled()
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})

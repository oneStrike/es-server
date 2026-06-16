/// <reference types="jest" />

import { sql } from 'drizzle-orm'
import { DownloadTargetTypeEnum } from './download.constant'
import { DownloadService } from './download.service'

function flattenSqlText(input: unknown): string {
  if (!input) {
    return ''
  }
  if (typeof input === 'string') {
    return input
  }
  if (typeof input !== 'object') {
    return ''
  }
  if ('value' in input && Array.isArray(input.value)) {
    return input.value.join('')
  }
  if ('queryChunks' in input && Array.isArray(input.queryChunks)) {
    return input.queryChunks.map(flattenSqlText).join('')
  }
  return ''
}

describe('downloadService permission boundary', () => {
  function createService(returningRows: Array<{ id: number }> = [{ id: 1 }]) {
    const returning = jest.fn(async () => Promise.resolve(returningRows))
    const onConflictDoNothing = jest.fn(() => ({ returning }))
    const values = jest.fn(() => ({ onConflictDoNothing }))
    const tx = {
      insert: jest.fn(() => ({ values })),
    }
    const drizzle = {
      schema: {
        userDownloadRecord: { id: 'id' },
      },
      withTransaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    }
    const service = new DownloadService(drizzle as any)
    return { drizzle, onConflictDoNothing, returning, service, tx, values }
  }

  it('passes user id into target resolver before writing download record', async () => {
    const { service, tx, values } = createService()
    const resolver = {
      applyCountDelta: jest.fn(async () => Promise.resolve()),
      ensureDownloadable: jest.fn(async () =>
        Promise.resolve('chapter-content'),
      ),
      targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
    }
    service.registerResolver(resolver)

    await expect(
      service.downloadTarget({
        targetId: 11,
        targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
        userId: 23,
      }),
    ).resolves.toBe('chapter-content')

    expect(resolver.ensureDownloadable).toHaveBeenCalledWith(tx, 11, 23)
    expect(values).toHaveBeenCalledWith({
      targetId: 11,
      targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
      userId: 23,
    })
    expect(resolver.applyCountDelta).toHaveBeenCalledWith(tx, 11, 1)
  })

  it('does not write download records or counts when permission check fails', async () => {
    const { service, tx } = createService()
    const resolver = {
      applyCountDelta: jest.fn(),
      ensureDownloadable: jest.fn(async () =>
        Promise.reject(new Error('permission denied')),
      ),
      targetType: DownloadTargetTypeEnum.NOVEL_CHAPTER,
    }
    service.registerResolver(resolver)

    await expect(
      service.downloadTarget({
        targetId: 12,
        targetType: DownloadTargetTypeEnum.NOVEL_CHAPTER,
        userId: 24,
      }),
    ).rejects.toThrow('permission denied')

    expect(resolver.ensureDownloadable).toHaveBeenCalledWith(tx, 12, 24)
    expect(tx.insert).not.toHaveBeenCalled()
    expect(resolver.applyCountDelta).not.toHaveBeenCalled()
  })

  it('uses allowlisted orderBy for downloaded works', async () => {
    const executedQueries: unknown[] = []
    const drizzle = {
      schema: {
        userDownloadRecord: { id: 'id' },
      },
      db: {
        execute: jest.fn((query: unknown) => {
          executedQueries.push(query)
          return Promise.resolve({
            rows:
              executedQueries.length === 1
                ? [
                    {
                      workId: 7,
                      workType: 1,
                      workName: '作品',
                      workCover: null,
                      downloadedChapterCount: 2n,
                      lastDownloadedAt: new Date('2026-06-01T00:00:00.000Z'),
                    },
                  ]
                : [{ total: 1n }],
          })
        }),
      },
      buildPage: jest.fn(() => ({
        limit: 10,
        offset: 0,
        pageIndex: 1,
        pageSize: 10,
      })),
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 10,
          offset: 0,
          pageIndex: 1,
          pageSize: 10,
        },
        order: {
          orderByClause: sql.raw('MAX(udr.created_at) DESC, wc.work_id DESC'),
          orderBySql: [],
        },
        dateRange: undefined,
      })),
      buildAllowlistedOrderBy: jest.fn(() => ({
        orderByClause: sql.raw('MAX(udr.created_at) DESC, wc.work_id DESC'),
      })),
    }
    const service = new DownloadService(drizzle as any)

    const page = await service.getDownloadedWorks({
      orderBy: '{"lastDownloadedAt":"desc"}',
      pageSize: 10,
      userId: 23,
    })

    expect(page).toMatchObject({
      total: 1,
      list: [
        {
          work: { id: 7, type: 1, name: '作品', cover: null },
          downloadedChapterCount: 2,
        },
      ],
    })
    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: '{"lastDownloadedAt":"desc"}',
      }),
      expect.objectContaining({
        allowlistedOrderBy: expect.objectContaining({
          columns: expect.objectContaining({
            lastDownloadedAt: expect.anything(),
            downloadedChapterCount: expect.anything(),
            workId: expect.anything(),
            workType: expect.anything(),
          }),
        }),
      }),
    )
    expect(flattenSqlText(executedQueries[0]).replace(/\s+/g, ' ')).toContain(
      'ORDER BY MAX(udr.created_at) DESC, wc.work_id DESC',
    )
  })

  it('uses allowlisted orderBy for downloaded work chapters', async () => {
    const executedQueries: unknown[] = []
    const drizzle = {
      schema: {
        userDownloadRecord: { id: 'id' },
      },
      db: {
        execute: jest.fn((query: unknown) => {
          executedQueries.push(query)
          return Promise.resolve({
            rows:
              executedQueries.length === 1
                ? [
                    {
                      id: 1,
                      targetType: 1,
                      targetId: 11,
                      userId: 23,
                      createdAt: new Date('2026-06-01T00:00:00.000Z'),
                      chapterId: 11,
                      chapterWorkId: 7,
                      chapterWorkType: 1,
                      chapterTitle: '第一章',
                      chapterSubtitle: null,
                      chapterCover: null,
                      chapterSortOrder: 1,
                      chapterIsPublished: true,
                      chapterPublishAt: null,
                    },
                  ]
                : [{ total: 1n }],
          })
        }),
      },
      buildPage: jest.fn(() => ({
        limit: 10,
        offset: 0,
        pageIndex: 1,
        pageSize: 10,
      })),
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 10,
          offset: 0,
          pageIndex: 1,
          pageSize: 10,
        },
        order: {
          orderByClause: sql.raw('udr.created_at DESC, udr.id DESC'),
          orderBySql: [],
        },
        dateRange: undefined,
      })),
      buildAllowlistedOrderBy: jest.fn(() => ({
        orderByClause: sql.raw('udr.created_at DESC, udr.id DESC'),
      })),
    }
    const service = new DownloadService(drizzle as any)

    const page = await service.getDownloadedWorkChapters({
      orderBy: '{"createdAt":"desc"}',
      pageSize: 10,
      userId: 23,
      workId: 7,
    })

    expect(page).toMatchObject({
      total: 1,
      list: [{ id: 1, chapter: { id: 11, workId: 7, sortOrder: 1 } }],
    })
    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: '{"createdAt":"desc"}',
      }),
      expect.objectContaining({
        allowlistedOrderBy: expect.objectContaining({
          columns: expect.objectContaining({
            createdAt: expect.anything(),
            chapterSortOrder: expect.anything(),
            chapterPublishAt: expect.anything(),
          }),
        }),
      }),
    )
    expect(flattenSqlText(executedQueries[0]).replace(/\s+/g, ' ')).toContain(
      'ORDER BY udr.created_at DESC, udr.id DESC',
    )
  })
})

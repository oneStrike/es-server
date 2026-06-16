/// <reference types="jest" />

import { DrizzleService } from '@db/core'
import { WorkTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant'
import { WorkChapterService } from './work-chapter.service'

function createUpdateDb(returningRows: Array<{ id: number }>) {
  const returning = jest.fn(async () => returningRows)
  const where = jest.fn(() => ({ returning }))
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))
  const dbUpdate = jest.fn(() => {
    throw new Error('batch status updates must run inside a transaction')
  })
  const tx = { update }
  const withTransaction = jest.fn(async (callback) => callback(tx))

  return {
    db: { update: dbUpdate },
    dbUpdate,
    returning,
    schema: {
      workChapter: {
        deletedAt: 'work_chapter.deleted_at',
        id: 'work_chapter.id',
        isPublished: 'work_chapter.is_published',
        workType: 'work_chapter.work_type',
      },
    },
    set,
    tx,
    update,
    where,
    withTransaction,
  }
}

function createDirectChapterUpdateDb() {
  const where = jest.fn(async () => ({ rowCount: 1 }))
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))

  return {
    db: { update },
    schema: {
      workChapter: {
        deletedAt: 'work_chapter.deleted_at',
        id: 'work_chapter.id',
        title: 'work_chapter.title',
        workType: 'work_chapter.work_type',
      },
    },
    set,
    update,
    where,
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }
}

function createService(drizzle: unknown) {
  return createServiceWithPermission(drizzle, {})
}

function createServiceWithPermission(
  drizzle: unknown,
  contentPermissionService: unknown,
) {
  return new WorkChapterService(
    drizzle as DrizzleService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    contentPermissionService as never,
    {} as never,
  )
}

function flattenSqlChunks(chunk: unknown, output: unknown[] = []) {
  if (Array.isArray(chunk)) {
    output.push(chunk)
    return output
  }

  if (!chunk || typeof chunk !== 'object') {
    output.push(chunk)
    return output
  }

  if (
    'queryChunks' in chunk &&
    Array.isArray((chunk as { queryChunks: unknown[] }).queryChunks)
  ) {
    for (const item of (chunk as { queryChunks: unknown[] }).queryChunks) {
      flattenSqlChunks(item, output)
    }
    return output
  }

  if (
    'value' in chunk &&
    Array.isArray((chunk as { value: unknown[] }).value)
  ) {
    output.push((chunk as { value: unknown[] }).value.join(''))
    return output
  }

  output.push(chunk)
  return output
}

function getWhereSqlChunks(where: jest.Mock) {
  const predicate = where.mock.calls[0]?.[0]
  return flattenSqlChunks(predicate)
}

function createPaginationDb(list: unknown[] = []) {
  const pageQuery = {
    from: jest.fn(() => pageQuery),
    limit: jest.fn(() => pageQuery),
    offset: jest.fn(async () => list),
    orderBy: jest.fn(() => pageQuery),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason?: unknown) => unknown,
    ) => Promise.resolve(list).then(resolve, reject),
    where: jest.fn(() => pageQuery),
  }
  const selectedFields: Array<Record<string, unknown>> = []
  const select = jest.fn((fields: Record<string, unknown>) => {
    selectedFields.push(fields)
    return pageQuery
  })

  return {
    buildOrderBy: jest.fn(() => ({ orderBySql: ['order-sql'] })),
    buildPage: jest.fn((input: { pageIndex?: number; pageSize?: number }) => ({
      limit: input.pageSize ?? 15,
      offset: ((input.pageIndex ?? 1) - 1) * (input.pageSize ?? 15),
      pageIndex: input.pageIndex ?? 1,
      pageSize: input.pageSize ?? 15,
    })),
    buildPageParams: jest.fn(
      (input: { pageIndex?: number; pageSize?: number }) => ({
        page: {
          limit: input.pageSize ?? 15,
          offset: ((input.pageIndex ?? 1) - 1) * (input.pageSize ?? 15),
          pageIndex: input.pageIndex ?? 1,
          pageSize: input.pageSize ?? 15,
        },
        order: {
          orderBySql: ['order-sql'],
        },
        dateRange: undefined,
      }),
    ),
    db: {
      $count: jest.fn(async () => list.length),
      select,
    },
    pageQuery,
    schema: {
      workChapter: {
        canComment: 'work_chapter.can_comment',
        canDownload: 'work_chapter.can_download',
        cover: 'work_chapter.cover',
        createdAt: 'work_chapter.created_at',
        deletedAt: 'work_chapter.deleted_at',
        id: 'work_chapter.id',
        isPreview: 'work_chapter.is_preview',
        isPublished: 'work_chapter.is_published',
        price: 'work_chapter.price',
        publishAt: 'work_chapter.publish_at',
        requiredViewLevelId: 'work_chapter.required_view_level_id',
        sortOrder: 'work_chapter.sort_order',
        subtitle: 'work_chapter.subtitle',
        title: 'work_chapter.title',
        updatedAt: 'work_chapter.updated_at',
        viewRule: 'work_chapter.view_rule',
        workId: 'work_chapter.work_id',
        workType: 'work_chapter.work_type',
      },
    },
    selectedFields,
  }
}

const chapterPageRow = {
  id: 1,
  workId: 10,
  workType: WorkTypeEnum.COMIC,
  title: '第1话',
  subtitle: '序章',
  cover: 'cover.jpg',
  sortOrder: 1,
  isPublished: true,
  isPreview: false,
  publishAt: null,
  viewRule: WorkViewPermissionEnum.INHERIT,
  price: 5,
  canDownload: true,
  canComment: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
}

describe('WorkChapterService chapter page projection', () => {
  it('queries the app page with a public pick, fixed ordering, and one batch permission call', async () => {
    const drizzle = createPaginationDb([chapterPageRow])
    const contentPermissionService = {
      resolveChapterPermissionsFromData: jest.fn(
        async () =>
          new Map([
            [
              chapterPageRow.id,
              {
                canDownload: true,
                isPreview: false,
                purchasePricing: {
                  discountAmount: 0,
                  originalPrice: 10,
                  payablePrice: 10,
                  payableRate: 1,
                },
                requiredExperience: null,
                requiredViewLevelId: null,
                viewRule: WorkViewPermissionEnum.PURCHASE,
                workType: WorkTypeEnum.COMIC,
              },
            ],
          ]),
      ),
    }
    const service = createServiceWithPermission(
      drizzle,
      contentPermissionService,
    )

    const page = await service.getAppChapterPage(
      { pageSize: 100, workId: 10 },
      { userId: 99 },
    )
    const selectedKeys = Object.keys(drizzle.selectedFields[0])

    expect(selectedKeys).toEqual(
      expect.arrayContaining([
        'id',
        'workId',
        'workType',
        'title',
        'viewRule',
        'price',
        'canDownload',
        'canComment',
      ]),
    )
    expect(selectedKeys).not.toEqual(
      expect.arrayContaining([
        'content',
        'description',
        'remark',
        'requiredViewLevelId',
      ]),
    )
    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 100, workId: 10 }),
      expect.objectContaining({
        fallbackOrderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
    )
    expect(drizzle.pageQuery.orderBy).toHaveBeenCalledWith('order-sql')
    expect(
      contentPermissionService.resolveChapterPermissionsFromData,
    ).toHaveBeenCalledTimes(1)
    expect(
      contentPermissionService.resolveChapterPermissionsFromData,
    ).toHaveBeenCalledWith([chapterPageRow])
    expect(page.list).toEqual([
      {
        id: 1,
        canComment: false,
        canDownload: true,
        cover: 'cover.jpg',
        createdAt: chapterPageRow.createdAt,
        isPreview: false,
        isPublished: true,
        publishAt: null,
        purchasePricing: {
          discountAmount: 0,
          originalPrice: 10,
          payablePrice: 10,
          payableRate: 1,
        },
        sortOrder: 1,
        subtitle: '序章',
        title: '第1话',
        updatedAt: chapterPageRow.updatedAt,
        viewRule: WorkViewPermissionEnum.PURCHASE,
      },
    ])
    expect(page.list[0]).not.toHaveProperty('price')
    expect(page.list[0]).not.toHaveProperty('requiredViewLevelId')
    expect(page.list[0]).not.toHaveProperty('workId')
    expect(page.list[0]).not.toHaveProperty('workType')
  })

  it('does not resolve app permissions for an empty page', async () => {
    const drizzle = createPaginationDb([])
    const contentPermissionService = {
      resolveChapterPermissionsFromData: jest.fn(),
    }
    const service = createServiceWithPermission(
      drizzle,
      contentPermissionService,
    )

    const page = await service.getAppChapterPage({ workId: 10 })

    expect(page.list).toEqual([])
    expect(
      contentPermissionService.resolveChapterPermissionsFromData,
    ).not.toHaveBeenCalled()
  })

  it('queries the admin page with an explicit management pick and no app permission resolver', async () => {
    const adminRow = {
      ...chapterPageRow,
      requiredViewLevelId: 3,
    }
    const drizzle = createPaginationDb([adminRow])
    const contentPermissionService = {
      resolveChapterPermissionsFromData: jest.fn(),
    }
    const service = createServiceWithPermission(
      drizzle,
      contentPermissionService,
    )

    const page = await service.getAdminChapterPage(
      { workId: 10 },
      WorkTypeEnum.COMIC,
    )
    const selectedKeys = Object.keys(drizzle.selectedFields[0])
    const whereChunks = getWhereSqlChunks(drizzle.pageQuery.where)

    expect(selectedKeys).toEqual(
      expect.arrayContaining(['price', 'requiredViewLevelId', 'viewRule']),
    )
    expect(whereChunks).toEqual(
      expect.arrayContaining(['work_chapter.work_type', WorkTypeEnum.COMIC]),
    )
    expect(selectedKeys).not.toEqual(
      expect.arrayContaining(['content', 'description', 'remark']),
    )
    expect(
      contentPermissionService.resolveChapterPermissionsFromData,
    ).not.toHaveBeenCalled()
    expect(page.list[0]).toMatchObject({
      id: 1,
      price: 5,
      requiredViewLevelId: 3,
      viewRule: WorkViewPermissionEnum.INHERIT,
    })
  })
})

describe('WorkChapterService batch publish status', () => {
  it('updates comic chapter publish status with id, work type, and deletion filters', async () => {
    const drizzle = createUpdateDb([{ id: 1 }, { id: 2 }])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [1, 2], isPublished: true },
        WorkTypeEnum.COMIC,
      ),
    ).resolves.toBe(true)

    expect(drizzle.update).toHaveBeenCalledWith(drizzle.schema.workChapter)
    expect(drizzle.dbUpdate).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(drizzle.set).toHaveBeenCalledWith({ isPublished: true })
    expect(drizzle.where).toHaveBeenCalledTimes(1)
    const whereChunks = getWhereSqlChunks(drizzle.where)
    const whereSql = whereChunks.join('')

    expect(whereChunks).toEqual(
      expect.arrayContaining([
        'work_chapter.id',
        'work_chapter.work_type',
        'work_chapter.deleted_at',
        WorkTypeEnum.COMIC,
      ]),
    )
    expect(whereChunks).toContainEqual([1, 2])
    expect(whereSql).toContain(' in ')
    expect(whereSql).toContain(' = ')
    expect(whereSql).toContain(' is null')
  })

  it('returns true without writing when ids are empty', async () => {
    const drizzle = createUpdateDb([])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [], isPublished: true },
        WorkTypeEnum.COMIC,
      ),
    ).resolves.toBe(true)

    expect(drizzle.update).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).not.toHaveBeenCalled()
  })

  it('deduplicates ids before comparing updated row count', async () => {
    const drizzle = createUpdateDb([{ id: 1 }, { id: 2 }])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [1, 1, 2], isPublished: false },
        WorkTypeEnum.COMIC,
      ),
    ).resolves.toBe(true)

    expect(drizzle.set).toHaveBeenCalledWith({ isPublished: false })
    expect(drizzle.dbUpdate).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(drizzle.where).toHaveBeenCalledTimes(1)
    expect(getWhereSqlChunks(drizzle.where)).toContainEqual([1, 2])
  })

  it('fails inside the transaction when some ids are missing, deleted, or outside the requested work type', async () => {
    const drizzle = createUpdateDb([{ id: 1 }])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [1, 2], isPublished: true },
        WorkTypeEnum.COMIC,
      ),
    ).rejects.toThrow('章节不存在')

    expect(drizzle.dbUpdate).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
  })
})

describe('WorkChapterService update boundary', () => {
  it('strips immutable work identity fields from chapter updates', async () => {
    const drizzle = createDirectChapterUpdateDb()
    const service = createService(drizzle)

    await expect(
      service.updateChapter(
        {
          id: 1,
          title: '只改标题',
          workId: 999,
          workType: WorkTypeEnum.NOVEL,
        } as any,
        WorkTypeEnum.COMIC,
      ),
    ).resolves.toBe(true)

    expect(drizzle.set).toHaveBeenCalledWith({ title: '只改标题' })
    const whereChunks = getWhereSqlChunks(drizzle.where)

    expect(whereChunks).toEqual(
      expect.arrayContaining([
        'work_chapter.id',
        'work_chapter.work_type',
        'work_chapter.deleted_at',
        WorkTypeEnum.COMIC,
      ]),
    )
  })
})

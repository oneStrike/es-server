/// <reference types="jest" />

import * as schema from '@db/schema'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { WorkService } from './work.service'

function createInsertBuilder(returningId = 1) {
  const returning = jest.fn(async () => [{ id: returningId }])
  const values = jest.fn(() => ({ returning }))
  return { returning, values }
}

function createUpdateBuilder() {
  const where = jest.fn(() => ({ rowCount: 1 }))
  const set = jest.fn(() => ({ where }))
  return { set, where }
}

function createDeleteBuilder() {
  const where = jest.fn(() => ({ rowCount: 1 }))
  return { where }
}

function createWorkDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: 1,
    name: '测试作品',
    cover: 'https://example.com/cover.jpg',
    description: '测试简介',
    language: 'zh-CN',
    region: 'CN',
    serialStatus: 1,
    isPublished: true,
    isRecommended: false,
    isHot: false,
    isNew: false,
    viewRule: 0,
    chapterPrice: 0,
    canComment: true,
    recommendWeight: 1,
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    commentCount: 0,
    downloadCount: 0,
    popularity: 0,
    authorIds: [1],
    categoryIds: [2],
    tagIds: [3],
    ...overrides,
  } as any
}

function createSubject() {
  const insertBuilders: Array<{
    table: unknown
    builder: ReturnType<typeof createInsertBuilder>
  }> = []
  const updateBuilders: Array<{
    table: unknown
    builder: ReturnType<typeof createUpdateBuilder>
  }> = []
  const tx = {
    insert: jest.fn((table: unknown) => {
      let builder: ReturnType<typeof createInsertBuilder>
      if (table === schema.forumSection) {
        builder = createInsertBuilder(10)
      } else if (table === schema.work) {
        builder = createInsertBuilder(20)
      } else {
        builder = createInsertBuilder()
      }
      insertBuilders.push({ table, builder })
      return builder
    }),
    select: jest.fn((): any => ({
      from: jest.fn(() => ({
        where: jest.fn(async () => []),
      })),
    })),
    update: jest.fn((table: unknown) => {
      const builder = createUpdateBuilder()
      updateBuilders.push({ table, builder })
      return builder
    }),
    delete: jest.fn(() => createDeleteBuilder()),
  }

  const db = {
    $count: jest.fn(async () => 0),
    select: jest.fn((): any => ({
      from: jest.fn(() => ({
        where: jest.fn(async () => []),
      })),
    })),
    query: {
      work: {
        findFirst: jest.fn(),
      },
      workAuthor: {
        findMany: jest.fn(async ({ where }: any) =>
          where.id.in.map((id: number) => ({ id, type: [1, 2] })),
        ),
      },
      workCategory: {
        findMany: jest.fn(async ({ where }: any) =>
          where.id.in.map((id: number) => ({ id })),
        ),
      },
      workTag: {
        findMany: jest.fn(async ({ where }: any) =>
          where.id.in.map((id: number) => ({ id })),
        ),
      },
      workAuthorRelation: {
        findMany: jest.fn(async () => []),
      },
      workCategoryRelation: {
        findMany: jest.fn(async () => []),
      },
      workTagRelation: {
        findMany: jest.fn(async () => []),
      },
    },
    transaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      callback(tx),
    ),
  }

  const drizzle = {
    assertAffectedRows: jest.fn(),
    db,
    schema,
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }

  const workAuthorService = {
    updateAuthorWorkCounts: jest.fn(),
  }
  const forumSectionService = {
    createManagedSectionForWork: jest.fn(async () => 10),
    releaseManagedSectionForWork: jest.fn(async () => true),
    syncManagedSectionForWork: jest.fn(async () => true),
  }

  const service = new WorkService(
    drizzle as any,
    workAuthorService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    forumSectionService as any,
  )

  return {
    db,
    drizzle,
    service,
    tx,
    insertBuilders,
    updateBuilders,
    workAuthorService,
    forumSectionService,
  }
}

async function expectOperationNotAllowed(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException)
    expect(error).toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    })
    return
  }

  throw new Error('Expected operation to be rejected')
}

async function expectResourceNotFound(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException)
    expect(error).toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
    })
    return
  }

  throw new Error('Expected operation to be rejected')
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

describe('WorkService relation integrity', () => {
  it('rejects creating a work without authors before opening the write transaction', async () => {
    const { db, drizzle, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)

    await expectOperationNotAllowed(
      service.createWorkReturningId(createWorkDto({ authorIds: [] })),
    )

    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('rejects creating a work without categories before opening the write transaction', async () => {
    const { db, drizzle, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)

    await expectOperationNotAllowed(
      service.createWorkReturningId(createWorkDto({ categoryIds: [] })),
    )

    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('rejects creating a work without tags before opening the write transaction', async () => {
    const { db, drizzle, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)

    await expectOperationNotAllowed(
      service.createWorkReturningId(createWorkDto({ tagIds: [] })),
    )

    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('rejects creating a work when relation groups are omitted by an internal caller', async () => {
    const { db, drizzle, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)

    await expectOperationNotAllowed(
      service.createWorkReturningId(
        createWorkDto({
          authorIds: undefined,
          categoryIds: undefined,
          tagIds: undefined,
        }),
      ),
    )

    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('keeps resource-not-found semantics for nonempty but invalid relation ids', async () => {
    const { db, drizzle, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)
    db.query.workTag.findMany.mockResolvedValueOnce([])

    await expectResourceNotFound(
      service.createWorkReturningId(createWorkDto({ tagIds: [404] })),
    )

    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('rejects creating a comic work with a non-manga author', async () => {
    const { db, drizzle, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)
    db.query.workAuthor.findMany.mockResolvedValueOnce([{ id: 1, type: [2] }])

    await expectOperationNotAllowed(
      service.createWorkReturningId(createWorkDto()),
    )

    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('writes tag relation sortOrder from create tagIds order', async () => {
    const { db, forumSectionService, insertBuilders, service, tx } =
      createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)

    await expect(
      service.createWorkReturningId(createWorkDto({ tagIds: [9, 3, 7] })),
    ).resolves.toBe(20)

    expect(
      forumSectionService.createManagedSectionForWork,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        cover: 'https://example.com/cover.jpg',
        description: '测试简介',
        icon: 'https://example.com/cover.jpg',
        isEnabled: true,
        name: '测试作品',
      }),
    )
    const tagInsert = insertBuilders.find(
      (item) => item.table === schema.workTagRelation,
    )
    expect(tagInsert?.builder.values).toHaveBeenCalledWith([
      { workId: 20, tagId: 9, sortOrder: 0 },
      { workId: 20, tagId: 3, sortOrder: 1 },
      { workId: 20, tagId: 7, sortOrder: 2 },
    ])
  })

  it('preserves relations when update omits relation fields', async () => {
    const { db, forumSectionService, service, tx } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '测试作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })

    await expect(
      service.updateWork({ id: 20, remark: '只改备注' } as any, 1),
    ).resolves.toBe(true)

    expect(tx.delete).not.toHaveBeenCalledWith(schema.workAuthorRelation)
    expect(tx.delete).not.toHaveBeenCalledWith(schema.workCategoryRelation)
    expect(tx.delete).not.toHaveBeenCalledWith(schema.workTagRelation)
    expect(forumSectionService.syncManagedSectionForWork).not.toHaveBeenCalled()
  })

  it('syncs managed section through forum owner when work metadata changes', async () => {
    const { db, forumSectionService, service, tx } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '旧作品',
      type: 1,
      forumSectionId: 10,
      authorRelations: [{ authorId: 1 }],
    })
    db.query.work.findFirst.mockResolvedValueOnce(null)

    await expect(
      service.updateWork(
        {
          id: 20,
          name: '新作品',
          description: '新简介',
          isPublished: false,
        } as any,
        1,
      ),
    ).resolves.toBe(true)

    expect(forumSectionService.syncManagedSectionForWork).toHaveBeenCalledWith(
      tx,
      {
        workId: 20,
        sectionId: 10,
        name: '新作品',
        description: '新简介',
        isEnabled: false,
      },
    )
  })

  it('rejects explicitly clearing category relations before deleting them', async () => {
    const { db, service, tx } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '测试作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })

    await expectOperationNotAllowed(
      service.updateWork({ id: 20, categoryIds: [] } as any, 1),
    )

    expect(tx.delete).not.toHaveBeenCalledWith(schema.workCategoryRelation)
  })

  it('rejects explicitly clearing author relations before deleting them', async () => {
    const { db, service, tx, workAuthorService } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '测试作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })

    await expectOperationNotAllowed(
      service.updateWork({ id: 20, authorIds: [] } as any, 1),
    )

    expect(tx.delete).not.toHaveBeenCalledWith(schema.workAuthorRelation)
    expect(workAuthorService.updateAuthorWorkCounts).not.toHaveBeenCalled()
  })

  it('rejects explicitly clearing tag relations before deleting them', async () => {
    const { db, service, tx } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '测试作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })

    await expectOperationNotAllowed(
      service.updateWork({ id: 20, tagIds: [] } as any, 1),
    )

    expect(tx.delete).not.toHaveBeenCalledWith(schema.workTagRelation)
  })

  it('ignores runtime type payloads when updating work metadata', async () => {
    const { db, service, tx } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '测试作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })

    await expect(
      service.updateWork({ id: 20, type: 2, remark: '只改备注' } as any, 1),
    ).resolves.toBe(true)

    const workUpdate = tx.update.mock.results.find(
      (item: { value?: { set?: jest.Mock } }) => item.value?.set,
    )?.value
    expect(workUpdate?.set).toHaveBeenCalledWith(
      expect.not.objectContaining({ type: 2 }),
    )
  })

  it('checks duplicate names against the immutable current work type on update', async () => {
    const { db, service, tx } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '同名作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })
    db.query.work.findFirst.mockResolvedValueOnce({ id: 21 })

    await expect(
      service.updateWork({ id: 20, name: '新同名作品', type: 2 } as any, 1),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
    })

    expect(tx.update).not.toHaveBeenCalledWith(schema.work)
  })

  it('writes tag relation sortOrder from update tagIds order', async () => {
    const { db, insertBuilders, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '测试作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })

    await expect(
      service.updateWork({ id: 20, tagIds: [8, 5] } as any, 1),
    ).resolves.toBe(true)

    const tagInsert = insertBuilders.find(
      (item) => item.table === schema.workTagRelation,
    )
    expect(tagInsert?.builder.values).toHaveBeenCalledWith([
      { workId: 20, tagId: 8, sortOrder: 0 },
      { workId: 20, tagId: 5, sortOrder: 1 },
    ])
  })

  it('orders attached tags by relation sortOrder and tagId', async () => {
    const { db, service } = createSubject()
    db.query.workTagRelation.findMany.mockResolvedValueOnce([])

    await (service as any).attachWorkRelations({
      list: [{ id: 20, name: '测试作品' }],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })

    expect(db.query.workTagRelation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.any(Function),
      }),
    )
    const [{ orderBy }] = (db.query.workTagRelation.findMany as jest.Mock).mock
      .calls[0] as any
    const asc = jest.fn((field: unknown) => ({ asc: field }))
    const order = orderBy({ sortOrder: 'sortOrder', tagId: 'tagId' }, { asc })
    expect(order).toEqual([{ asc: 'sortOrder' }, { asc: 'tagId' }])
  })

  it('soft-deletes active third-party bindings when deleting a work', async () => {
    const { db, forumSectionService, service, tx, updateBuilders } =
      createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      forumSectionId: 10,
      authorRelations: [{ authorId: 1 }],
    })
    tx.select.mockReturnValueOnce({
      from: jest.fn(() => ({
        where: jest.fn(async () => [{ id: 30 }]),
      })),
    } as any)

    await expect(service.deleteWork(20, 1)).resolves.toBe(true)

    const chapterBindingUpdate = updateBuilders.find(
      (item) => item.table === schema.workThirdPartyChapterBinding,
    )
    const sourceBindingUpdate = updateBuilders.find(
      (item) => item.table === schema.workThirdPartySourceBinding,
    )
    expect(chapterBindingUpdate?.builder.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
    })
    expect(sourceBindingUpdate?.builder.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
    })
    expect(
      forumSectionService.releaseManagedSectionForWork,
    ).toHaveBeenCalledWith(tx, {
      workId: 20,
      sectionId: 10,
      deletedAt: expect.any(Date),
    })
  })

  it('blocks deleting a work when any live chapter remains regardless of chapter type', async () => {
    const { db, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      forumSectionId: null,
      authorRelations: [],
    })
    db.$count.mockResolvedValueOnce(1)

    await expectOperationNotAllowed(service.deleteWork(20, 1))

    const countCalls = db.$count.mock.calls as unknown as Array<
      [unknown, unknown]
    >
    const whereChunks = flattenSqlChunks(countCalls[0][1])

    expect(whereChunks).toEqual(
      expect.arrayContaining([
        schema.workChapter.workId,
        schema.workChapter.deletedAt,
      ]),
    )
    expect(whereChunks).not.toContain(schema.workChapter.workType)
  })

  it('checks the requested work type before counting chapters on delete', async () => {
    const { db, service } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce(null)

    await expectResourceNotFound(service.deleteWork(20, 1))

    expect(db.$count).not.toHaveBeenCalled()
  })
})

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
  const updateBuilders: Array<{
    table: unknown
    builder: ReturnType<typeof createUpdateBuilder>
  }> = []
  const tx = {
    insert: jest.fn((table: unknown) => {
      if (table === schema.forumSection) {
        return createInsertBuilder(10)
      }
      if (table === schema.work) {
        return createInsertBuilder(20)
      }
      return createInsertBuilder()
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
    query: {
      work: {
        findFirst: jest.fn(),
      },
      workAuthor: {
        findMany: jest.fn(async ({ where }: any) =>
          where.id.in.map((id: number) => ({ id })),
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

  const service = new WorkService(
    drizzle as any,
    workAuthorService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )

  return { db, drizzle, service, tx, updateBuilders, workAuthorService }
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

  it('preserves relations when update omits relation fields', async () => {
    const { db, service, tx } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      name: '测试作品',
      type: 1,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })

    await expect(service.updateWork({ id: 20, remark: '只改备注' } as any))
      .resolves.toBe(true)

    expect(tx.delete).not.toHaveBeenCalledWith(schema.workAuthorRelation)
    expect(tx.delete).not.toHaveBeenCalledWith(schema.workCategoryRelation)
    expect(tx.delete).not.toHaveBeenCalledWith(schema.workTagRelation)
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
      service.updateWork({ id: 20, categoryIds: [] } as any),
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
      service.updateWork({ id: 20, authorIds: [] } as any),
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
      service.updateWork({ id: 20, tagIds: [] } as any),
    )

    expect(tx.delete).not.toHaveBeenCalledWith(schema.workTagRelation)
  })

  it('soft-deletes active third-party bindings when deleting a work', async () => {
    const { db, service, tx, updateBuilders } = createSubject()
    db.query.work.findFirst.mockResolvedValueOnce({
      id: 20,
      forumSectionId: null,
      authorRelations: [{ authorId: 1 }],
    })
    tx.select.mockReturnValueOnce({
      from: jest.fn(() => ({
        where: jest.fn(async () => [{ id: 30 }]),
      })),
    } as any)

    await expect(service.deleteWork(20)).resolves.toBe(true)

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
  })
})

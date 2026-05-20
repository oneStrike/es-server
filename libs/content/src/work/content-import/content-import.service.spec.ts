/// <reference types="jest" />

import {
  ContentImportItemAttemptStatusEnum,
  ContentImportItemStageEnum,
  ContentImportItemStatusEnum,
} from './content-import.constant'
import { ContentImportService } from './content-import.service'
import { ThirdPartyComicImportChapterActionEnum } from '../content/dto/content.dto'

describe('ContentImportService retry scheduling', () => {
  const now = new Date('2026-05-17T03:00:00.000Z')

  function createSchema() {
    return {
      contentImportItem: {
        autoRetryCount: 'autoRetryCount',
        contentImportJobId: 'contentImportJobId',
        currentAttemptNo: 'currentAttemptNo',
        failureCount: 'failureCount',
        id: 'itemPk',
        imageSuccessCount: 'imageSuccessCount',
        imageTotal: 'imageTotal',
        itemId: 'itemId',
        lastErrorCode: 'lastErrorCode',
        lastErrorMessage: 'lastErrorMessage',
        lastFailedAt: 'lastFailedAt',
        lastRetryCode: 'lastRetryCode',
        lastRetryReason: 'lastRetryReason',
        maxAutoRetries: 'maxAutoRetries',
        nextRetryAt: 'nextRetryAt',
        sortOrder: 'sortOrder',
        stage: 'stage',
        status: 'status',
        updatedAt: 'updatedAt',
      },
      contentImportItemAttempt: {
        attemptNo: 'attemptNo',
        contentImportItemId: 'contentImportItemId',
        errorCode: 'errorCode',
        errorMessage: 'errorMessage',
        finishedAt: 'finishedAt',
        imageSuccessCount: 'attemptImageSuccessCount',
        imageTotal: 'attemptImageTotal',
        stage: 'attemptStage',
        status: 'attemptStatus',
        updatedAt: 'attemptUpdatedAt',
      },
      contentImportJob: {
        id: 'contentImportJobPk',
        workflowJobId: 'workflowJobFk',
      },
      workflowAttempt: {
        id: 'workflowAttemptPk',
      },
      workflowJob: {
        id: 'workflowJobPk',
        jobId: 'jobId',
      },
    }
  }

  function createUpdateDb(returningRows: unknown[][] = []) {
    const updateSets: Record<string, unknown>[] = []
    return {
      db: {
        update: jest.fn(() => ({
          set: jest.fn((value: Record<string, unknown>) => {
            updateSets.push(value)
            return {
              where: jest.fn(() => ({
                returning: jest.fn(async () => returningRows.shift() ?? []),
              })),
            }
          }),
        })),
      },
      updateSets,
    }
  }

  function createService(db: unknown) {
    const drizzle = {
      db,
      schema: createSchema(),
    }
    return new ContentImportService(drizzle as never)
  }

  function setServiceMethod(
    service: ContentImportService,
    name: string,
    implementation: unknown,
  ) {
    Object.defineProperty(service, name, {
      configurable: true,
      value: implementation,
    })
  }

  it('marks an item as scheduled retry with retry diagnostics', async () => {
    const item = {
      autoRetryCount: 0,
      id: 10n,
      itemId: 'item-1',
      maxAutoRetries: 3,
    }
    const { db, updateSets } = createUpdateDb([[item], []])
    const service = createService(db)
    setServiceMethod(
      service,
      'readContentImportItemByItemId',
      jest.fn(async () => item),
    )

    await service.markItemRateLimitRetrying({
      attemptNo: 1,
      errorCode: 'HTTP_429',
      errorMessage: 'rate limited',
      itemId: 'item-1',
      nextRetryAt: now,
      retryReason: '限流，请稍后重试',
    })

    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          autoRetryCount: expect.anything(),
          lastRetryCode: 'HTTP_429',
          lastRetryReason: '限流，请稍后重试',
          nextRetryAt: now,
          status: ContentImportItemStatusEnum.RETRYING,
        }),
        expect.objectContaining({
          errorCode: 'HTTP_429',
          errorMessage: 'rate limited',
          status: ContentImportItemAttemptStatusEnum.SCHEDULED_RETRY,
        }),
      ]),
    )
  })

  it('does not reset image counters when scheduling retry without image input', async () => {
    const item = {
      autoRetryCount: 0,
      id: 10n,
      imageSuccessCount: 12,
      imageTotal: 53,
      itemId: 'item-1',
      maxAutoRetries: 3,
    }
    const { db, updateSets } = createUpdateDb([[item], []])
    const service = createService(db)
    setServiceMethod(
      service,
      'readContentImportItemByItemId',
      jest.fn(async () => item),
    )

    await service.markItemRateLimitRetrying({
      attemptNo: 1,
      errorCode: 'HTTP_429',
      errorMessage: 'rate limited',
      itemId: 'item-1',
      nextRetryAt: now,
      retryReason: '限流，请稍后重试',
    })

    expect(updateSets[0]).not.toHaveProperty('imageTotal')
    expect(updateSets[0]).not.toHaveProperty('imageSuccessCount')
    expect(updateSets[1]).not.toHaveProperty('imageTotal')
    expect(updateSets[1]).not.toHaveProperty('imageSuccessCount')
  })

  it('marks retry exhaustion as terminal failed and clears schedule', async () => {
    const item = {
      autoRetryCount: 3,
      id: 10n,
      itemId: 'item-1',
      maxAutoRetries: 3,
    }
    const { db, updateSets } = createUpdateDb([[item], []])
    const service = createService(db)
    setServiceMethod(
      service,
      'readContentImportItemByItemId',
      jest.fn(async () => item),
    )

    await service.markItemRetryExhausted({
      attemptNo: 4,
      errorMessage: 'rate limited again',
      itemId: 'item-1',
      imageSuccessCount: 0,
      imageTotal: 0,
    })

    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lastErrorCode: 'RATE_LIMIT_RETRY_EXHAUSTED',
          nextRetryAt: null,
          status: ContentImportItemStatusEnum.FAILED,
        }),
        expect.objectContaining({
          errorCode: 'RATE_LIMIT_RETRY_EXHAUSTED',
          status: ContentImportItemAttemptStatusEnum.FAILED,
        }),
      ]),
    )
  })

  it('does not reset image counters when retry exhaustion omits image input', async () => {
    const item = {
      autoRetryCount: 3,
      id: 10n,
      imageSuccessCount: 12,
      imageTotal: 53,
      itemId: 'item-1',
      maxAutoRetries: 3,
    }
    const { db, updateSets } = createUpdateDb([[item], []])
    const service = createService(db)
    setServiceMethod(
      service,
      'readContentImportItemByItemId',
      jest.fn(async () => item),
    )

    await service.markItemRetryExhausted({
      attemptNo: 4,
      errorMessage: 'rate limited again',
      itemId: 'item-1',
    })

    expect(updateSets[0]).not.toHaveProperty('imageTotal')
    expect(updateSets[0]).not.toHaveProperty('imageSuccessCount')
    expect(updateSets[1]).not.toHaveProperty('imageTotal')
    expect(updateSets[1]).not.toHaveProperty('imageSuccessCount')
  })

  it('does not reset image counters when marking failure without image input', async () => {
    const item = {
      id: 10n,
      imageSuccessCount: 12,
      imageTotal: 53,
      itemId: 'item-1',
    }
    const { db, updateSets } = createUpdateDb([[item], []])
    const service = createService(db)
    setServiceMethod(
      service,
      'readContentImportItemByItemId',
      jest.fn(async () => item),
    )

    await service.markItemFailed({
      attemptNo: 1,
      errorCode: 'IMPORT_FAILED',
      errorMessage: 'failed',
      itemId: 'item-1',
    })

    expect(updateSets[0]).not.toHaveProperty('imageTotal')
    expect(updateSets[0]).not.toHaveProperty('imageSuccessCount')
    expect(updateSets[1]).not.toHaveProperty('imageTotal')
    expect(updateSets[1]).not.toHaveProperty('imageSuccessCount')
  })

  it('includes retry fields in item DTO pages', async () => {
    const service = createService({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: jest.fn(async () => [{ contentImportJob: { id: 1n } }]),
            })),
          })),
        })),
      })),
    })
    const itemUpdatedAt = new Date('2026-05-17T03:01:00.000Z')
    ;(service as unknown as { drizzle: { ext: unknown } }).drizzle.ext = {
      findPagination: jest.fn(async () => ({
        list: [
          {
            autoRetryCount: 2,
            failureCount: 0,
            id: 10n,
            imageSuccessCount: 0,
            imageTotal: 0,
            itemId: 'item-1',
            itemType: 1,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastRetryCode: 'HTTP_429',
            lastRetryReason: '限流',
            localChapterId: null,
            maxAutoRetries: 3,
            metadata: null,
            nextRetryAt: now,
            providerChapterId: 'chapter-1',
            sortOrder: 1,
            stage: ContentImportItemStageEnum.READING_CONTENT,
            status: ContentImportItemStatusEnum.RETRYING,
            title: '第 1 话',
            updatedAt: itemUpdatedAt,
          },
        ],
        pageIndex: 1,
        pageSize: 10,
        total: 1,
      })),
    }

    const page = await service.getItemPage({
      jobId: 'job-1',
      pageIndex: 1,
      pageSize: 10,
    })

    expect(page.list[0]).toEqual(
      expect.objectContaining({
        autoRetryCount: 2,
        lastRetryCode: 'HTTP_429',
        lastRetryReason: '限流',
        maxAutoRetries: 3,
        nextRetryAt: now,
      }),
    )
  })

  it('aggregateJob returns image counters in addition to item counters', async () => {
    const schema = createSchema()
    const rows = [
      {
        imageSuccessCount: 10,
        imageTotal: 20,
        status: ContentImportItemStatusEnum.SUCCESS,
      },
      {
        imageSuccessCount: 0,
        imageTotal: 30,
        status: ContentImportItemStatusEnum.FAILED,
      },
    ]
    const db = {
      select: jest.fn(() => ({
        from: jest.fn((table: unknown) => ({
          where: jest.fn(async () =>
            table === schema.contentImportJob ? [{ id: 100n }] : rows,
          ),
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: jest.fn(async () => [{ contentImportJob: { id: 100n } }]),
            })),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(async () => []),
        })),
      })),
    }
    const service = createService(db)
    setServiceMethod(
      service,
      'readContentImportJobByWorkflowJobId',
      jest.fn(async () => ({ id: 100n })),
    )

    await expect(service.aggregateJob('job-1')).resolves.toEqual(
      expect.objectContaining({
        failedItemCount: 1,
        imageFailedCount: 40,
        imageSuccessCount: 10,
        imageTotal: 50,
        selectedItemCount: 2,
        successItemCount: 1,
      }),
    )
  })

  it('aggregateJobWithRetryState preserves image counters', async () => {
    const rows = [
      {
        imageSuccessCount: 5,
        imageTotal: 10,
        nextRetryAt: new Date('2030-05-17T03:10:00.000Z'),
        status: ContentImportItemStatusEnum.RETRYING,
      },
    ]
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(async () => rows),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(async () => []),
        })),
      })),
    }
    const service = createService(db)
    setServiceMethod(
      service,
      'readContentImportJobByWorkflowJobId',
      jest.fn(async () => ({ id: 100n })),
    )

    await expect(service.aggregateJobWithRetryState('job-1')).resolves.toEqual(
      expect.objectContaining({
        futureRetryItemCount: 1,
        imageFailedCount: 5,
        imageSuccessCount: 5,
        imageTotal: 10,
      }),
    )
  })

  it('markItemImageProgress clamps image success and returns aggregate counters', async () => {
    const schema = createSchema()
    const updateSets: Record<string, unknown>[] = []
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn((value: Record<string, unknown>) => {
          updateSets.push(value)
          return {
            where: jest.fn(() => ({
              returning: jest.fn(async () => [
                { id: 10n, contentImportJobId: 100n },
              ]),
            })),
          }
        }),
      })),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(async () => [
            {
              imageSuccessCount: 5,
              imageTotal: 5,
              status: ContentImportItemStatusEnum.RUNNING,
            },
          ]),
        })),
      })),
    }
    const db = {
      transaction: jest.fn(async (callback: (innerTx: unknown) => unknown) =>
        callback(tx),
      ),
    }
    const service = new ContentImportService({
      db,
      schema,
    } as never)

    await expect(
      (
        service as unknown as {
          markItemImageProgress(input: {
            imageSuccessCount: number
            imageTotal: number
            itemId: string
          }): Promise<unknown>
        }
      ).markItemImageProgress({
        imageSuccessCount: 99,
        imageTotal: 5,
        itemId: 'item-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        imageFailedCount: 0,
        imageSuccessCount: 5,
        imageTotal: 5,
      }),
    )
    expect(db.transaction).toHaveBeenCalled()
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          imageSuccessCount: 5,
          imageTotal: 5,
        }),
      ]),
    )
  })
})

describe('ContentImportService third-party import job creation', () => {
  function createSchema() {
    return {
      contentImportItem: {
        contentImportJobId: 'contentImportJobId',
      },
      contentImportJob: {
        id: 'contentImportJobPk',
        workflowJobId: 'workflowJobId',
      },
      workflowJob: {
        id: 'workflowJobPk',
        jobId: 'jobId',
      },
    }
  }

  function createInsertDb(schema: ReturnType<typeof createSchema>) {
    const insertedJobs: Record<string, unknown>[] = []
    const insertedItems: Record<string, unknown>[] = []
    const db = {
      insert: jest.fn((table: unknown) => ({
        values: jest.fn(
          (value: Record<string, unknown> | Record<string, unknown>[]) => {
            if (table === schema.contentImportJob) {
              insertedJobs.push(value as Record<string, unknown>)
              return {
                returning: jest.fn(async () => [
                  {
                    ...(value as Record<string, unknown>),
                    id: 100n,
                  },
                ]),
              }
            }

            insertedItems.push(...(value as Record<string, unknown>[]))
            return {
              returning: jest.fn(async () => []),
            }
          },
        ),
      })),
    }
    return {
      db,
      insertedItems,
      insertedJobs,
    }
  }

  function createService(db: unknown, schema: ReturnType<typeof createSchema>) {
    return new ContentImportService({
      db,
      schema,
    } as never)
  }

  function setServiceMethod(
    service: ContentImportService,
    name: string,
    implementation: unknown,
  ) {
    Object.defineProperty(service, name, {
      configurable: true,
      value: implementation,
    })
  }

  function createImportInput() {
    return {
      jobId: 'job-1',
      dto: {
        chapters: [
          {
            action: ThirdPartyComicImportChapterActionEnum.CREATE,
            imageCount: 53,
            importImages: true,
            providerChapterId: 'chapter-001',
            sortOrder: 1,
            title: '第 1 话',
          },
          {
            action: ThirdPartyComicImportChapterActionEnum.CREATE,
            imageCount: 26,
            importImages: false,
            providerChapterId: 'chapter-002',
            sortOrder: 2,
            title: '第 2 话',
          },
        ],
        platform: 'copy',
        sourceSnapshot: {
          providerComicId: 'comic-001',
          providerGroupPathWord: 'default',
          providerPathWord: 'comic-001',
        },
        targetWorkId: null,
      },
    }
  }

  it('initializes job and item image totals from chapter imageCount', async () => {
    const schema = createSchema()
    const { db, insertedItems, insertedJobs } = createInsertDb(schema)
    const service = createService(db, schema)
    setServiceMethod(
      service,
      'readWorkflowJob',
      jest.fn(async () => ({ id: 9n })),
    )

    await service.createThirdPartyImportJob(createImportInput() as never)

    expect(insertedJobs[0]).toEqual(
      expect.objectContaining({
        imageTotal: 53,
        selectedItemCount: 2,
      }),
    )
    expect(insertedItems).toEqual([
      expect.objectContaining({
        imageTotal: 53,
        metadata: {
          chapter: expect.objectContaining({
            imageCount: 53,
            providerChapterId: 'chapter-001',
          }),
        },
        providerChapterId: 'chapter-001',
      }),
      expect.objectContaining({
        imageTotal: 0,
        metadata: {
          chapter: expect.objectContaining({
            imageCount: 26,
            importImages: false,
            providerChapterId: 'chapter-002',
          }),
        },
        providerChapterId: 'chapter-002',
      }),
    ])
  })

  it('rejects invalid chapter imageCount before inserting workflow rows', async () => {
    const schema = createSchema()
    const { db } = createInsertDb(schema)
    const service = createService(db, schema)
    const input = createImportInput()
    ;(input.dto.chapters[0] as Record<string, unknown>).imageCount = 1.5

    await expect(
      service.createThirdPartyImportJob(input as never),
    ).rejects.toThrow('三方章节图片数必须是非负整数')
    expect(db.insert).not.toHaveBeenCalled()
  })
})

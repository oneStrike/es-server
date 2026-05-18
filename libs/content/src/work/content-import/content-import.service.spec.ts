/// <reference types="jest" />

import {
  ContentImportItemAttemptStatusEnum,
  ContentImportItemStageEnum,
  ContentImportItemStatusEnum,
} from './content-import.constant'
import { ContentImportService } from './content-import.service'

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

  it('includes retry fields in item DTO pages', async () => {
    const service = createService({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: jest.fn(async () => [
                { contentImportJob: { id: 1n } },
              ]),
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
})

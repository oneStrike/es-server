/// <reference types="jest" />

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock(
  '@libs/content/work/third-party/services/remote-image-import.service',
  () => ({
    RemoteImageImportService: class RemoteImageImportService {},
  }),
)

import { WorkflowAttemptStatusEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { WorkflowCancellationError } from '@libs/platform/modules/workflow/workflow-cancellation'
import { ThirdPartyComicSyncWorkflowHandler } from './third-party-comic-sync-workflow.handler'

describe('ThirdPartyComicSyncWorkflowHandler', () => {
  it('creates workflow items from the scan and retries failures per chapter', async () => {
    const registry = { register: jest.fn() }
    const plans = [
      {
        imageTotal: 2,
        localSortOrder: 1,
        providerChapterId: 'p1',
        title: '第 1 话',
      },
      {
        imageTotal: 3,
        localSortOrder: 2,
        providerChapterId: 'p2',
        title: '第 2 话',
      },
    ]
    const items = plans.map((plan, index) => ({
      itemId: `item-${index + 1}`,
      metadata: { plan },
    }))
    const contentImportService = {
      aggregateJobWithRetryState: jest
        .fn()
        .mockResolvedValueOnce({
          failedItemCount: 0,
          futureRetryItemCount: 0,
          imageFailedCount: 3,
          imageSuccessCount: 2,
          imageTotal: 5,
          nextRetryAt: null,
          selectedItemCount: 2,
          skippedItemCount: 0,
          successItemCount: 1,
        })
        .mockResolvedValueOnce({
          failedItemCount: 1,
          futureRetryItemCount: 0,
          imageFailedCount: 3,
          imageSuccessCount: 2,
          imageTotal: 5,
          nextRetryAt: null,
          selectedItemCount: 2,
          skippedItemCount: 0,
          successItemCount: 1,
        })
        .mockResolvedValueOnce({
          failedItemCount: 1,
          futureRetryItemCount: 0,
          imageFailedCount: 3,
          imageSuccessCount: 2,
          imageTotal: 5,
          nextRetryAt: null,
          selectedItemCount: 2,
          skippedItemCount: 0,
          successItemCount: 1,
        }),
      listExecutableItems: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markResiduesCleaned: jest.fn(),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { source: { workId: 1 } },
      })),
      replaceThirdPartySyncItems: jest.fn(),
      startItemAttempt: jest.fn(),
    }
    const remoteImageImportService = {
      deleteImportedFile: jest.fn(),
    }
    const syncService = {
      createSyncImageProgressReporter: jest.fn(() => ({ advance: jest.fn() })),
      importWorkflowSyncChapter: jest
        .fn()
        .mockResolvedValueOnce({
          imageSuccessCount: 2,
          imageTotal: 2,
          localChapterId: 201,
        })
        .mockRejectedValueOnce(new Error('image failed')),
      prepareWorkflowSync: jest.fn(async () => ({
        plans,
        scannedChapterCount: 2,
        skippedChapterCount: 0,
        sourceBindingId: 10,
        work: { canComment: true, chapterPrice: 0, id: 1 },
      })),
      prepareWorkflowSyncTarget: jest.fn(),
      rollbackSyncTask: jest.fn(),
    }
    const handler = new ThirdPartyComicSyncWorkflowHandler(
      registry as never,
      contentImportService as never,
      syncService as never,
      remoteImageImportService as never,
    )
    const updateProgress = jest.fn()

    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-1',
      attemptNo: 1,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress,
      workflowType: 'content-import.third-party-sync',
    }

    await handler.execute(context)

    expect(
      contentImportService.replaceThirdPartySyncItems,
    ).toHaveBeenCalledWith('job-1', plans, 1)
    expect(contentImportService.markItemSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        imageSuccessCount: 2,
        itemId: 'item-1',
        localChapterId: 201,
      }),
    )
    expect(contentImportService.markItemFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'THIRD_PARTY_SYNC_CHAPTER_FAILED',
        imageTotal: 3,
        itemId: 'item-2',
      }),
    )
    expect(context.completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        failedItemCount: 1,
        status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
        successItemCount: 1,
      }),
    )
    expect(updateProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ percent: 40 }),
    )
    expect(updateProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ percent: 40 }),
    )
  })

  it('stops before marking item failure when workflow ownership is lost during rollback', async () => {
    const registry = { register: jest.fn() }
    const plan = {
      imageTotal: 2,
      localSortOrder: 1,
      providerChapterId: 'p1',
      title: '第 1 话',
    }
    const contentImportService = {
      aggregateJobWithRetryState: jest.fn(),
      listExecutableItems: jest.fn(async () => [
        { itemId: 'item-1', metadata: { plan } },
      ]),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { source: { workId: 1 } },
      })),
      startItemAttempt: jest.fn(),
    }
    const syncService = {
      createSyncImageProgressReporter: jest.fn(() => ({ advance: jest.fn() })),
      importWorkflowSyncChapter: jest.fn(async () => {
        throw new Error('image failed')
      }),
      prepareWorkflowSyncTarget: jest.fn(async () => ({
        sourceBindingId: 1,
        work: { canComment: true, chapterPrice: 0, id: 1 },
      })),
      rollbackSyncTask: jest.fn(async () => undefined),
    }
    const ownershipLost = new Error('claim lost')
    const handler = new ThirdPartyComicSyncWorkflowHandler(
      registry as never,
      contentImportService as never,
      syncService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn().mockRejectedValue(ownershipLost),
      attemptId: 'attempt-2',
      attemptNo: 2,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-sync',
    }

    await expect(handler.execute(context)).rejects.toThrow('claim lost')

    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('carries real counters when cancellation interrupts a sync item', async () => {
    const registry = { register: jest.fn() }
    const plans = [
      {
        imageTotal: 1,
        localSortOrder: 1,
        providerChapterId: 'p1',
        title: '第 1 话',
      },
      {
        imageTotal: 1,
        localSortOrder: 2,
        providerChapterId: 'p2',
        title: '第 2 话',
      },
    ]
    const items = plans.map((plan, index) => ({
      itemId: `item-${index + 1}`,
      metadata: { plan },
    }))
    const contentImportService = {
      aggregateJob: jest.fn(async () => ({
        failedItemCount: 0,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 0,
        futureRetryItemCount: 0,
        nextRetryAt: null,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markResiduesCleaned: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { source: { workId: 1 } },
      })),
      startItemAttempt: jest.fn(),
    }
    const syncService = {
      importWorkflowSyncChapter: jest
        .fn()
        .mockResolvedValueOnce({
          imageSuccessCount: 1,
          imageTotal: 1,
          localChapterId: 201,
        })
        .mockRejectedValueOnce(new WorkflowCancellationError()),
      prepareWorkflowSyncTarget: jest.fn(async () => ({
        sourceBindingId: 1,
        work: { canComment: true, chapterPrice: 0, id: 1 },
      })),
      rollbackSyncTask: jest.fn(),
    }
    const handler = new ThirdPartyComicSyncWorkflowHandler(
      registry as never,
      contentImportService as never,
      syncService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-2',
      attemptNo: 2,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-sync',
    }

    await expect(handler.execute(context)).rejects.toMatchObject({
      counters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      name: 'WorkflowCancellationError',
    })

    expect(syncService.rollbackSyncTask).toHaveBeenCalled()
    expect(contentImportService.aggregateJob).toHaveBeenCalledWith('job-1')
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('carries real counters when cancellation is requested before the next sync item starts', async () => {
    const registry = { register: jest.fn() }
    const plans = [
      {
        imageTotal: 1,
        localSortOrder: 1,
        providerChapterId: 'p1',
        title: '第 1 话',
      },
      {
        imageTotal: 1,
        localSortOrder: 2,
        providerChapterId: 'p2',
        title: '第 2 话',
      },
    ]
    const items = plans.map((plan, index) => ({
      itemId: `item-${index + 1}`,
      metadata: { plan },
    }))
    const contentImportService = {
      aggregateJob: jest.fn(async () => ({
        failedItemCount: 0,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 0,
        futureRetryItemCount: 0,
        nextRetryAt: null,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markResiduesCleaned: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { source: { workId: 1 } },
      })),
      startItemAttempt: jest.fn(),
    }
    const syncService = {
      importWorkflowSyncChapter: jest.fn(async () => ({
        imageSuccessCount: 1,
        imageTotal: 1,
        localChapterId: 201,
      })),
      prepareWorkflowSyncTarget: jest.fn(async () => ({
        sourceBindingId: 1,
        work: { canComment: true, chapterPrice: 0, id: 1 },
      })),
      rollbackSyncTask: jest.fn(),
    }
    const handler = new ThirdPartyComicSyncWorkflowHandler(
      registry as never,
      contentImportService as never,
      syncService as never,
      { deleteImportedFile: jest.fn() } as never,
    )
    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new WorkflowCancellationError()),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-2',
      attemptNo: 2,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-sync',
    }

    await expect(handler.execute(context)).rejects.toMatchObject({
      counters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      name: 'WorkflowCancellationError',
    })

    expect(syncService.importWorkflowSyncChapter).toHaveBeenCalledTimes(1)
    expect(contentImportService.startItemAttempt).toHaveBeenCalledTimes(1)
    expect(contentImportService.aggregateJob).toHaveBeenCalledWith('job-1')
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('stops before starting a normal sync item attempt when workflow ownership is lost', async () => {
    const registry = { register: jest.fn() }
    const plan = {
      imageTotal: 1,
      localSortOrder: 1,
      providerChapterId: 'p1',
      title: '第 1 话',
    }
    const contentImportService = {
      aggregateJobWithRetryState: jest.fn(),
      listExecutableItems: jest.fn(async () => [
        { itemId: 'item-1', metadata: { plan } },
      ]),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { source: { workId: 1 } },
      })),
      startItemAttempt: jest.fn(),
    }
    const syncService = {
      prepareWorkflowSyncTarget: jest.fn(async () => ({
        sourceBindingId: 1,
        work: { canComment: true, chapterPrice: 0, id: 1 },
      })),
      rollbackSyncTask: jest.fn(),
    }
    const ownershipLost = new Error('claim lost')
    const handler = new ThirdPartyComicSyncWorkflowHandler(
      registry as never,
      contentImportService as never,
      syncService as never,
      { deleteImportedFile: jest.fn() } as never,
    )
    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn().mockRejectedValue(ownershipLost),
      attemptId: 'attempt-2',
      attemptNo: 2,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-sync',
    }

    await expect(handler.execute(context)).rejects.toBe(ownershipLost)

    expect(contentImportService.startItemAttempt).not.toHaveBeenCalled()
    expect(syncService.rollbackSyncTask).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('schedules rate-limited sync chapters for automatic retry and continues later items', async () => {
    const registry = { register: jest.fn() }
    const rateLimitError = new Error('rate limited', {
      cause: {
        rateLimited: true,
        reason: 'HTTP 429',
        retryAt: '2026-05-17T03:10:00.000Z',
        status: 429,
      },
    })
    const plans = [
      {
        imageTotal: 0,
        localSortOrder: 1,
        providerChapterId: 'p1',
        title: '第 1 话',
      },
      {
        imageTotal: 0,
        localSortOrder: 2,
        providerChapterId: 'p2',
        title: '第 2 话',
      },
      {
        imageTotal: 0,
        localSortOrder: 3,
        providerChapterId: 'p3',
        title: '第 3 话',
      },
    ]
    const items = plans.map((plan, index) => ({
      itemId: `item-${index + 1}`,
      metadata: { plan },
    }))
    const contentImportService = {
      aggregateJobWithRetryState: jest
        .fn()
        .mockResolvedValueOnce({
          failedItemCount: 0,
          futureRetryItemCount: 0,
          nextRetryAt: null,
          selectedItemCount: 3,
          skippedItemCount: 0,
          successItemCount: 1,
        })
        .mockResolvedValueOnce({
          failedItemCount: 0,
          futureRetryItemCount: 1,
          nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
          selectedItemCount: 3,
          skippedItemCount: 0,
          successItemCount: 1,
        })
        .mockResolvedValueOnce({
          failedItemCount: 0,
          futureRetryItemCount: 1,
          nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
          selectedItemCount: 3,
          skippedItemCount: 0,
          successItemCount: 2,
        })
        .mockResolvedValueOnce({
          failedItemCount: 0,
          futureRetryItemCount: 1,
          nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
          selectedItemCount: 3,
          skippedItemCount: 0,
          successItemCount: 2,
        }),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemRateLimitRetrying: jest.fn(),
      markItemRetryExhausted: jest.fn(),
      markItemSuccess: jest.fn(),
      markResiduesCleaned: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { source: { workId: 1 } },
      })),
      startItemAttempt: jest.fn(),
    }
    const syncService = {
      createSyncImageProgressReporter: jest.fn(() => ({ advance: jest.fn() })),
      importWorkflowSyncChapter: jest
        .fn()
        .mockResolvedValueOnce({
          imageSuccessCount: 1,
          imageTotal: 1,
          localChapterId: 201,
        })
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          imageSuccessCount: 1,
          imageTotal: 1,
          localChapterId: 203,
        }),
      prepareWorkflowSyncTarget: jest.fn(async () => ({
        sourceBindingId: 1,
        work: { canComment: true, chapterPrice: 0, id: 1 },
      })),
      rollbackSyncTask: jest.fn(),
    }
    const appendEvent = jest.fn()
    const updateProgress = jest.fn()
    const handler = new ThirdPartyComicSyncWorkflowHandler(
      registry as never,
      contentImportService as never,
      syncService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

    const context = {
      appendEvent,
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-2',
      attemptNo: 2,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress,
      workflowType: 'content-import.third-party-sync',
    }

    await handler.execute(context)

    expect(syncService.importWorkflowSyncChapter).toHaveBeenCalledTimes(3)
    expect(contentImportService.markItemRateLimitRetrying).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'HTTP_429',
        itemId: 'item-2',
        nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
      }),
    )
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttemptWithDelayedRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        delayedSelectedItemCount: 1,
        nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
      }),
    )
    expect(context.completeAttempt).not.toHaveBeenCalled()
    expect(updateProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ percent: 33 }),
    )
    expect(updateProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ percent: 33 }),
    )
    expect(updateProgress).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ percent: 66 }),
    )
    expect(appendEvent).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('自动重试'),
      expect.objectContaining({ itemId: 'item-2' }),
    )
  })

  it('delegates expired attempt recovery to the content import domain', async () => {
    const registry = { register: jest.fn() }
    const contentImportService = {
      recoverExpiredAttempt: jest.fn(async () => ({
        failedItemCount: 1,
        recoverableItemCount: 1,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 0,
      })),
    }
    const handler = new ThirdPartyComicSyncWorkflowHandler(
      registry as never,
      contentImportService as never,
      {} as never,
      {} as never,
    )
    const tx = {} as never

    await expect(
      handler.recoverExpiredAttempt(
        {
          conflictKeys: [],
          expiredAttemptNo: 1,
          jobId: 'job-1',
          workflowType: 'content-import.third-party-sync',
        },
        2,
        tx,
      ),
    ).resolves.toEqual({
      failedItemCount: 1,
      recoverableItemCount: 1,
      selectedItemCount: 2,
      skippedItemCount: 0,
      successItemCount: 0,
    })

    expect(contentImportService.recoverExpiredAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      2,
      tx,
    )
  })
})

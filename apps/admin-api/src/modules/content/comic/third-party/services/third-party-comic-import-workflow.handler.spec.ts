/// <reference types="jest" />

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/third-party/services/remote-image-import.service', () => ({
  RemoteImageImportService: class RemoteImageImportService {},
}))

import { WorkflowAttemptStatusEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { WorkflowCancellationError } from '@libs/platform/modules/workflow/workflow-cancellation'
import { ThirdPartyComicImportWorkflowHandler } from './third-party-comic-import-workflow.handler'

describe('ThirdPartyComicImportWorkflowHandler', () => {
  it('keeps successful chapters and fails only the broken chapter item', async () => {
    const registry = { register: jest.fn() }
    const items = [
      {
        itemId: 'item-1',
        metadata: {
          chapter: { providerChapterId: 'p1', title: '第 1 话' },
        },
      },
      {
        itemId: 'item-2',
        metadata: {
          chapter: { providerChapterId: 'p2', title: '第 2 话' },
        },
      },
    ]
    const contentImportService = {
      aggregateJobWithRetryState: jest
        .fn()
        .mockResolvedValueOnce({
          failedItemCount: 0,
          futureRetryItemCount: 0,
          nextRetryAt: null,
          selectedItemCount: 2,
          skippedItemCount: 0,
          successItemCount: 1,
        })
        .mockResolvedValueOnce({
          failedItemCount: 1,
          futureRetryItemCount: 0,
          nextRetryAt: null,
          selectedItemCount: 2,
          skippedItemCount: 0,
          successItemCount: 1,
        })
        .mockResolvedValueOnce({
          failedItemCount: 1,
          futureRetryItemCount: 0,
          nextRetryAt: null,
          selectedItemCount: 2,
          skippedItemCount: 0,
          successItemCount: 1,
        }),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markResiduesCleaned: jest.fn(),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [] },
      })),
      startItemAttempt: jest.fn(),
    }
    const remoteImageImportService = {
      deleteImportedFile: jest.fn(),
    }
    const importService = {
      createImportImageProgressReporter: jest.fn(() => ({ advance: jest.fn() })),
      importWorkflowChapter: jest
        .fn()
        .mockResolvedValueOnce({
          imageSucceeded: 2,
          imageTotal: 2,
          localChapterId: 101,
        })
        .mockRejectedValueOnce(new Error('image failed')),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p1' }, imageTotal: 2 },
          { chapter: { providerChapterId: 'p2' }, imageTotal: 3 },
        ],
        cover: undefined,
        mode: 'createNew',
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 1 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
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
      workflowType: 'content-import.third-party-import',
    }

    await handler.execute(context)

    expect(contentImportService.markItemSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        imageSuccessCount: 2,
        itemId: 'item-1',
        localChapterId: 101,
      }),
    )
    expect(contentImportService.markItemFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'THIRD_PARTY_IMPORT_CHAPTER_FAILED',
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
      expect.objectContaining({ percent: 50 }),
    )
    expect(updateProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ percent: 100 }),
    )
  })

  it('schedules rate-limited chapters for automatic retry and continues later items', async () => {
    const registry = { register: jest.fn() }
    const rateLimitError = new Error('rate limited', {
      cause: {
        rateLimited: true,
        reason: 'HTTP 429',
        retryAt: '2026-05-17T03:10:00.000Z',
        status: 429,
      },
    })
    const items = [
      { itemId: 'item-1', metadata: { chapter: { providerChapterId: 'p1', title: '第 1 话' } } },
      { itemId: 'item-2', metadata: { chapter: { providerChapterId: 'p2', title: '第 2 话' } } },
      { itemId: 'item-3', metadata: { chapter: { providerChapterId: 'p3', title: '第 3 话' } } },
    ]
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
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [] },
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      createImportImageProgressReporter: jest.fn(() => ({ advance: jest.fn() })),
      importWorkflowChapter: jest
        .fn()
        .mockResolvedValueOnce({
          imageSucceeded: 1,
          imageTotal: 1,
          localChapterId: 101,
        })
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          imageSucceeded: 1,
          imageTotal: 1,
          localChapterId: 103,
        }),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p1' }, imageTotal: 0 },
          { chapter: { providerChapterId: 'p2' }, imageTotal: 0 },
          { chapter: { providerChapterId: 'p3' }, imageTotal: 0 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 1 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const appendEvent = jest.fn()
    const updateProgress = jest.fn()
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

    const context = {
      appendEvent,
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
      workflowType: 'content-import.third-party-import',
    }

    await handler.execute(context)

    expect(importService.importWorkflowChapter).toHaveBeenCalledTimes(3)
    expect(contentImportService.markItemRateLimitRetrying).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'HTTP_429',
        itemId: 'item-2',
        nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
      }),
    )
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(contentImportService.markItemSuccess).toHaveBeenCalledTimes(2)
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

  it('schedules automatic retry when image import wraps a rate-limit cause', async () => {
    const registry = { register: jest.fn() }
    const imageRateLimitError = new Error('远程图片下载被限流', {
      cause: {
        imageIndex: 1,
        imageTotal: 1,
        providerImageId: 'img-1',
        rateLimited: true,
        reason: 'HTTP 429',
        retryAfterHeader: '120',
        retryAfterMs: 120000,
        safeSourceUrl: 'https://sw.mangafunb.fun/comic/001.jpg',
        stage: 'remote-image-import',
        status: 429,
      },
    })
    const contentImportService = {
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 0,
        futureRetryItemCount: 1,
        nextRetryAt: new Date('2026-05-17T03:02:00.000Z'),
        skippedItemCount: 0,
        successItemCount: 0,
      })),
      listExecutableItems: jest.fn(async () => [
        {
          autoRetryCount: 0,
          itemId: 'item-1',
          maxAutoRetries: 3,
          metadata: {
            chapter: { providerChapterId: 'p1', title: '第 1 话' },
          },
        },
      ]),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemRateLimitRetrying: jest.fn(),
      markItemRetryExhausted: jest.fn(),
      markResiduesCleaned: jest.fn(),
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [], mode: 'createNew' },
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      importWorkflowChapter: jest.fn(async () => {
        throw imageRateLimitError
      }),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p1' }, imageTotal: 1 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

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
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-import',
    }

    await handler.execute(context)

    expect(contentImportService.markItemRateLimitRetrying).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'HTTP_429',
        itemId: 'item-1',
        retryReason: 'HTTP 429',
      }),
    )
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttemptWithDelayedRetry).toHaveBeenCalled()
  })

  it('restores the prepared target on follow-up attempts instead of preparing a new work', async () => {
    const registry = { register: jest.fn() }
    const items = [
      {
        autoRetryCount: 0,
        itemId: 'item-2',
        maxAutoRetries: 3,
        metadata: {
          chapter: { providerChapterId: 'p2', title: '第 2 话' },
        },
      },
    ]
    const contentImportService = {
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 0,
        futureRetryItemCount: 0,
        nextRetryAt: null,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markResiduesCleaned: jest.fn(),
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [], mode: 'createNew' },
        workId: 100,
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      cleanupPreparedNewWorkImportTarget: jest.fn(),
      importWorkflowChapter: jest.fn(async () => ({
        imageSucceeded: 1,
        imageTotal: 1,
        localChapterId: 102,
      })),
      prepareWorkflowImport: jest.fn(),
      readPreparedImportTarget: jest.fn(async () => ({
        cover: undefined,
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      restorePreparedWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p2' }, imageTotal: 1 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
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
      workflowType: 'content-import.third-party-import',
    }

    await handler.execute(context)

    expect(importService.prepareWorkflowImport).not.toHaveBeenCalled()
    expect(importService.readPreparedImportTarget).toHaveBeenCalledWith(
      { chapters: [], mode: 'createNew' },
      100,
    )
    expect(importService.restorePreparedWorkflowImport).toHaveBeenCalled()
    expect(contentImportService.markThirdPartyImportTargetPrepared).not.toHaveBeenCalled()
    expect(contentImportService.markItemSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-2',
        localChapterId: 102,
      }),
    )
  })

  it('cleans the persisted new-work target when automatic retries exhaust with zero successes', async () => {
    const registry = { register: jest.fn() }
    const items = [
      {
        autoRetryCount: 3,
        itemId: 'item-2',
        maxAutoRetries: 3,
        metadata: {
          chapter: { providerChapterId: 'p2', title: '第 2 话' },
        },
      },
    ]
    const rateLimitError = new Error('rate limited', {
      cause: {
        rateLimited: true,
        reason: 'HTTP 429',
        status: 429,
      },
    })
    const contentImportService = {
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 1,
        futureRetryItemCount: 0,
        nextRetryAt: null,
        skippedItemCount: 0,
        successItemCount: 0,
      })),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemRetryExhausted: jest.fn(),
      markResiduesCleaned: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [], mode: 'createNew' },
        workId: 100,
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      cleanupPreparedNewWorkImportTarget: jest.fn(),
      importWorkflowChapter: jest.fn(async () => {
        throw rateLimitError
      }),
      prepareWorkflowImport: jest.fn(),
      readPreparedImportTarget: jest.fn(async () => ({
        cover: undefined,
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      restorePreparedWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p2' }, imageTotal: 0 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
      { deleteImportedFile: jest.fn() } as never,
    )
    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-4',
      attemptNo: 4,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-import',
    }

    await handler.execute(context)

    expect(contentImportService.markItemRetryExhausted).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-2',
      }),
    )
    expect(importService.cleanupPreparedNewWorkImportTarget).toHaveBeenCalledWith(
      { chapters: [], mode: 'createNew' },
      100,
      expect.objectContaining({ jobId: 'job-1' }),
    )
  })

  it('does not create another work when a create-new follow-up attempt cannot restore its target', async () => {
    const registry = { register: jest.fn() }
    const contentImportService = {
      aggregateJob: jest.fn(async () => ({
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 0,
      })),
      aggregateJobWithRetryState: jest.fn(),
      listExecutableItems: jest.fn(async () => [
        {
          autoRetryCount: 1,
          itemId: 'item-1',
          metadata: {
            chapter: { providerChapterId: 'p1', title: '第 1 话' },
          },
        },
      ]),
      markItemFailed: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [], mode: 'createNew' },
        workId: 100,
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      prepareWorkflowImport: jest.fn(),
      readPreparedImportTarget: jest.fn(async () => {
        throw new Error('binding missing')
      }),
      rollbackImportTask: jest.fn(async () => undefined),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
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
      workflowType: 'content-import.third-party-import',
    }

    await handler.execute(context)

    expect(importService.prepareWorkflowImport).not.toHaveBeenCalled()
    expect(contentImportService.markItemFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'THIRD_PARTY_IMPORT_PREPARE_FAILED',
        itemId: 'item-1',
      }),
    )
    expect(context.completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'THIRD_PARTY_IMPORT_PREPARE_FAILED',
      }),
    )
  })

  it('stops before marking item failure when workflow ownership is lost during rollback', async () => {
    const registry = { register: jest.fn() }
    const items = [
      {
        itemId: 'item-1',
        metadata: {
          chapter: { providerChapterId: 'p1', title: '第 1 话' },
        },
      },
    ]
    const contentImportService = {
      aggregateJobWithRetryState: jest.fn(),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [] },
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      createImportImageProgressReporter: jest.fn(() => ({ advance: jest.fn() })),
      importWorkflowChapter: jest.fn(async () => {
        throw new Error('image failed')
      }),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p1' }, imageTotal: 2 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 1 },
      })),
      rollbackImportTask: jest.fn(async () => undefined),
    }
    const ownershipLost = new Error('claim lost')
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn().mockRejectedValue(ownershipLost),
      attemptId: 'attempt-1',
      attemptNo: 1,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-import',
    }

    await expect(handler.execute(context)).rejects.toThrow('claim lost')

    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('carries real counters when cancellation interrupts an item', async () => {
    const registry = { register: jest.fn() }
    const items = [
      {
        itemId: 'item-1',
        metadata: {
          chapter: { providerChapterId: 'p1', title: '第 1 话' },
        },
      },
      {
        itemId: 'item-2',
        metadata: {
          chapter: { providerChapterId: 'p2', title: '第 2 话' },
        },
      },
    ]
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
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [], mode: 'createNew' },
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      importWorkflowChapter: jest
        .fn()
        .mockResolvedValueOnce({
          imageSucceeded: 1,
          imageTotal: 1,
          localChapterId: 101,
        })
        .mockRejectedValueOnce(new WorkflowCancellationError()),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p1' }, imageTotal: 1 },
          { chapter: { providerChapterId: 'p2' }, imageTotal: 1 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

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
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-import',
    }

    await expect(handler.execute(context)).rejects.toMatchObject({
      counters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      name: 'WorkflowCancellationError',
    })

    expect(importService.rollbackImportTask).toHaveBeenCalled()
    expect(contentImportService.aggregateJob).toHaveBeenCalledWith('job-1')
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('carries real counters when cancellation is requested before the next item starts', async () => {
    const registry = { register: jest.fn() }
    const items = [
      {
        itemId: 'item-1',
        metadata: {
          chapter: { providerChapterId: 'p1', title: '第 1 话' },
        },
      },
      {
        itemId: 'item-2',
        metadata: {
          chapter: { providerChapterId: 'p2', title: '第 2 话' },
        },
      },
    ]
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
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [], mode: 'createNew' },
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      importWorkflowChapter: jest.fn(async () => ({
        imageSucceeded: 1,
        imageTotal: 1,
        localChapterId: 101,
      })),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p1' }, imageTotal: 1 },
          { chapter: { providerChapterId: 'p2' }, imageTotal: 1 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
      { deleteImportedFile: jest.fn() } as never,
    )
    const context = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new WorkflowCancellationError()),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-1',
      attemptNo: 1,
      completeAttempt: jest.fn(),
      completeAttemptWithDelayedRetry: jest.fn(),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-import',
    }

    await expect(handler.execute(context)).rejects.toMatchObject({
      counters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      name: 'WorkflowCancellationError',
    })

    expect(importService.importWorkflowChapter).toHaveBeenCalledTimes(1)
    expect(contentImportService.startItemAttempt).toHaveBeenCalledTimes(1)
    expect(contentImportService.aggregateJob).toHaveBeenCalledWith('job-1')
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('cleans old pending upload residues for an item before retrying it', async () => {
    const registry = { register: jest.fn() }
    const deleteTarget = {
      filePath: 'old/partial.jpg',
      objectKey: 'old/partial.jpg',
      provider: 'local',
    }
    const contentImportService = {
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 0,
        futureRetryItemCount: 0,
        nextRetryAt: null,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      listExecutableItems: jest.fn(async () => [
        {
          itemId: 'item-1',
          metadata: {
            chapter: { providerChapterId: 'p1', title: '第 1 话' },
          },
        },
      ]),
      listPendingUploadedFileResidues: jest.fn(async () => [
        { deleteTarget, residueId: 'old-residue' },
      ]),
      markResiduesCleaned: jest.fn(),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: { chapters: [] },
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      createImportImageProgressReporter: jest.fn(() => ({ advance: jest.fn() })),
      importWorkflowChapter: jest.fn(async () => ({
        imageSucceeded: 1,
        imageTotal: 1,
        localChapterId: 101,
      })),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          { chapter: { providerChapterId: 'p1' }, imageTotal: 1 },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 1 },
      })),
      rollbackImportTask: jest.fn(),
    }
    const remoteImageImportService = {
      deleteImportedFile: jest.fn(),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
      registry as never,
      contentImportService as never,
      importService as never,
      remoteImageImportService as never,
    )

    await handler.execute({
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
      workflowType: 'content-import.third-party-import',
    })

    expect(
      contentImportService.listPendingUploadedFileResidues,
    ).toHaveBeenCalledWith('job-1', { itemId: 'item-1' })
    expect(remoteImageImportService.deleteImportedFile).toHaveBeenCalledWith(
      deleteTarget,
    )
    expect(contentImportService.markResiduesCleaned).toHaveBeenCalledWith([
      'old-residue',
    ])
  })

  it('delegates expired attempt recovery to the content import domain', async () => {
    const registry = { register: jest.fn() }
    const contentImportService = {
      recoverExpiredAttempt: jest.fn(async () => ({
        failedItemCount: 1,
        recoverableItemCount: 2,
        selectedItemCount: 3,
        skippedItemCount: 0,
        successItemCount: 0,
      })),
    }
    const handler = new ThirdPartyComicImportWorkflowHandler(
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
          workflowType: 'content-import.third-party-import',
        },
        2,
        tx,
      ),
    ).resolves.toEqual({
      failedItemCount: 1,
      recoverableItemCount: 2,
      selectedItemCount: 3,
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

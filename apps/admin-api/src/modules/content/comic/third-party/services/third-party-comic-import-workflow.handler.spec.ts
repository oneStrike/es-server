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
import { WorkflowCancellationSignal } from '@libs/platform/modules/workflow/workflow-cancellation'
import { WorkflowErrorCodeEnum } from '@libs/platform/modules/workflow/workflow-error-facts'
import { ThirdPartyComicImportWorkflowHandler } from './third-party-comic-import-workflow.handler'

describe('ThirdPartyComicImportWorkflowHandler', () => {
  function createAttemptCounters() {
    return {
      failedItemCount: 1,
      imageFailedCount: 0,
      imageSuccessCount: 0,
      imageTotal: 0,
      selectedItemCount: 1,
      skippedItemCount: 0,
      successItemCount: 0,
    }
  }

  it('uses server-owned source snapshot image counts before prepare', async () => {
    const registry = { register: jest.fn() }
    const items = [
      {
        imageTotal: 53,
        itemId: 'item-1',
        metadata: {
          chapter: { providerChapterId: 'p1', title: '第 1 话' },
        },
      },
    ]
    const contentImportService = {
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 0,
        futureRetryItemCount: 0,
        nextRetryAt: null,
        selectedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markResiduesCleaned: jest.fn(),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: {
          chapters: [
            {
              action: 'create',
              imageCount: 53,
              importImages: true,
              providerChapterId: 'p1',
              sortOrder: 1,
              title: '第 1 话',
            },
          ],
          mode: 'createNew',
        },
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      createImportImageProgressReporter: jest.fn(() => ({
        advance: jest.fn(),
      })),
      importWorkflowChapter: jest.fn(async () => ({
        imageSucceeded: 2,
        imageTotal: 53,
        localChapterId: 101,
      })),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          {
            chapter: { providerChapterId: 'p1' },
            imageTotal: 53,
          },
        ],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 1 },
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

    expect(importService.prepareWorkflowImport).toHaveBeenCalledWith(
      expect.objectContaining({
        chapters: [
          expect.objectContaining({
            imageCount: 53,
            providerChapterId: 'p1',
          }),
        ],
      }),
      expect.anything(),
    )
    expect(contentImportService.markItemSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        imageTotal: 53,
        itemId: 'item-1',
      }),
    )
  })

  it('uses server-owned source snapshot image counts when retrying a subset', async () => {
    const registry = { register: jest.fn() }
    const retryItems = [
      {
        imageTotal: 26,
        itemId: 'item-2',
        metadata: {
          chapter: { providerChapterId: 'p2', title: '第 2 话' },
        },
      },
    ]
    const allItems = [
      {
        imageTotal: 53,
        itemId: 'item-1',
        metadata: {
          chapter: { providerChapterId: 'p1', title: '第 1 话' },
        },
      },
      ...retryItems,
    ]
    const contentImportService = {
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
      aggregateJobWithRetryState: jest.fn(async () => ({
        failedItemCount: 0,
        futureRetryItemCount: 0,
        nextRetryAt: null,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      listExecutableItems: jest.fn(async () => retryItems),
      listJobItems: jest.fn(async () => allItems),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markResiduesCleaned: jest.fn(),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
      markThirdPartyImportTargetPrepared: jest.fn(),
      readContentImportJobByWorkflowJobId: jest.fn(async () => ({
        sourceSnapshot: {
          chapters: [
            {
              action: 'create',
              imageCount: 53,
              importImages: true,
              providerChapterId: 'p1',
              sortOrder: 1,
              title: '第 1 话',
            },
            {
              action: 'create',
              imageCount: 26,
              importImages: true,
              providerChapterId: 'p2',
              sortOrder: 2,
              title: '第 2 话',
            },
          ],
          mode: 'createNew',
        },
        workId: 100,
      })),
      startItemAttempt: jest.fn(),
    }
    const importService = {
      createImportImageProgressReporter: jest.fn(() => ({
        advance: jest.fn(),
      })),
      importWorkflowChapter: jest.fn(async () => ({
        imageSucceeded: 1,
        imageTotal: 26,
        localChapterId: 102,
      })),
      readPreparedImportTarget: jest.fn(async () => ({
        cover: null,
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      restorePreparedWorkflowImport: jest.fn(async () => ({
        chapterPlans: [
          {
            chapter: { providerChapterId: 'p1' },
            imageTotal: 53,
          },
          {
            chapter: { providerChapterId: 'p2' },
            imageTotal: 26,
          },
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

    expect(contentImportService.listJobItems).not.toHaveBeenCalled()
    expect(importService.restorePreparedWorkflowImport).toHaveBeenCalledWith(
      expect.objectContaining({
        chapters: [
          expect.objectContaining({
            imageCount: 53,
            providerChapterId: 'p1',
          }),
          expect.objectContaining({
            imageCount: 26,
            providerChapterId: 'p2',
          }),
        ],
      }),
      expect.anything(),
      expect.anything(),
    )
    expect(importService.importWorkflowChapter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        chapter: expect.objectContaining({ providerChapterId: 'p2' }),
      }),
      expect.anything(),
    )
  })

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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
      createImportImageProgressReporter: jest.fn(() => ({
        advance: jest.fn(),
      })),
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
        cover: null,
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
        error: expect.objectContaining({
          code: WorkflowErrorCodeEnum.THIRD_PARTY_CHAPTER_IMPORT_FAILED,
          context: expect.objectContaining({
            itemId: 'item-2',
            providerChapterId: 'p2',
          }),
        }),
        itemId: 'item-2',
      }),
    )
    expect(contentImportService.markItemFailed.mock.calls[0][0]).not.toHaveProperty(
      'imageTotal',
    )
    expect(contentImportService.markItemFailed.mock.calls[0][0]).not.toHaveProperty(
      'imageSuccessCount',
    )
    expect(context.completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        jobCounters: expect.objectContaining({
          failedItemCount: 1,
          successItemCount: 1,
        }),
        status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
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
      {
        itemId: 'item-1',
        metadata: { chapter: { providerChapterId: 'p1', title: '第 1 话' } },
      },
      {
        itemId: 'item-2',
        metadata: { chapter: { providerChapterId: 'p2', title: '第 2 话' } },
      },
      {
        itemId: 'item-3',
        metadata: { chapter: { providerChapterId: 'p3', title: '第 3 话' } },
      },
    ]
    const contentImportService = {
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
      createImportImageProgressReporter: jest.fn(() => ({
        advance: jest.fn(),
      })),
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
        error: expect.objectContaining({
          code: WorkflowErrorCodeEnum.CONTENT_IMPORT_RATE_LIMITED,
          context: expect.objectContaining({
            itemId: 'item-2',
            providerCode: 'HTTP_429',
          }),
        }),
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
      'CONTENT_IMPORT_RATE_LIMITED_RETRY_SCHEDULED',
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
        chapterPlans: [{ chapter: { providerChapterId: 'p1' }, imageTotal: 1 }],
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
        error: expect.objectContaining({
          code: WorkflowErrorCodeEnum.CONTENT_IMPORT_RATE_LIMITED,
          context: expect.objectContaining({
            itemId: 'item-1',
            providerCode: 'HTTP_429',
            reason: 'HTTP 429',
          }),
        }),
        itemId: 'item-1',
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
        cover: null,
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      restorePreparedWorkflowImport: jest.fn(async () => ({
        chapterPlans: [{ chapter: { providerChapterId: 'p2' }, imageTotal: 1 }],
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
    expect(
      contentImportService.markThirdPartyImportTargetPrepared,
    ).not.toHaveBeenCalled()
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
        cover: null,
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      restorePreparedWorkflowImport: jest.fn(async () => ({
        chapterPlans: [{ chapter: { providerChapterId: 'p2' }, imageTotal: 0 }],
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
    expect(
      importService.cleanupPreparedNewWorkImportTarget,
    ).toHaveBeenCalledWith(
      { chapters: [], mode: 'createNew' },
      100,
      expect.objectContaining({ jobId: 'job-1' }),
    )
  })

  it('does not create another work when a create-new follow-up attempt cannot restore its target', async () => {
    const registry = { register: jest.fn() }
    const contentImportService = {
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
      aggregateJob: jest.fn(async () => ({
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 0,
      })),
      aggregateJobWithRetryState: jest.fn(),
      listExecutableItems: jest.fn(async () => [
        {
          autoRetryCount: 1,
          imageTotal: 53,
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
        error: expect.objectContaining({
          code: WorkflowErrorCodeEnum.THIRD_PARTY_RESOURCE_PARSE_FAILED,
          context: expect.objectContaining({
            itemId: 'item-1',
            source: 'third-party-import-prepare',
          }),
        }),
        itemId: 'item-1',
      }),
    )
    expect(contentImportService.markItemFailed.mock.calls[0][0]).not.toHaveProperty(
      'imageTotal',
    )
    expect(contentImportService.markItemFailed.mock.calls[0][0]).not.toHaveProperty(
      'imageSuccessCount',
    )
    expect(context.completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: WorkflowErrorCodeEnum.THIRD_PARTY_RESOURCE_PARSE_FAILED,
          context: expect.objectContaining({
            jobId: 'job-1',
            source: 'third-party-import-prepare',
          }),
        }),
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
      createImportImageProgressReporter: jest.fn(() => ({
        advance: jest.fn(),
      })),
      importWorkflowChapter: jest.fn(async () => {
        throw new Error('image failed')
      }),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [{ chapter: { providerChapterId: 'p1' }, imageTotal: 2 }],
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
        .mockRejectedValueOnce(new WorkflowCancellationSignal()),
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
      attemptCounters: {
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 0,
      },
      jobCounters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      name: 'WorkflowCancellationError',
    })

    expect(importService.rollbackImportTask).toHaveBeenCalled()
    expect(contentImportService.aggregateJob).toHaveBeenCalledWith('job-1')
    expect(contentImportService.aggregateAttempt).toHaveBeenCalledWith('job-1', 1)
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
        .mockRejectedValueOnce(new WorkflowCancellationSignal()),
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
      attemptCounters: {
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 0,
      },
      jobCounters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      name: 'WorkflowCancellationError',
    })

    expect(importService.importWorkflowChapter).toHaveBeenCalledTimes(1)
    expect(contentImportService.startItemAttempt).toHaveBeenCalledTimes(1)
    expect(contentImportService.aggregateJob).toHaveBeenCalledWith('job-1')
    expect(contentImportService.aggregateAttempt).toHaveBeenCalledWith('job-1', 1)
    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(context.completeAttempt).not.toHaveBeenCalled()
  })

  it('stops before starting a normal item attempt when workflow ownership is lost', async () => {
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
      aggregateJobWithRetryState: jest.fn(),
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
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [{ chapter: { providerChapterId: 'p1' }, imageTotal: 1 }],
        sourceBinding: { id: 1, providerGroupPathWord: 'default' },
        work: { id: 100 },
      })),
      rollbackImportTask: jest.fn(),
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

    await expect(handler.execute(context)).rejects.toBe(ownershipLost)

    expect(contentImportService.startItemAttempt).not.toHaveBeenCalled()
    expect(importService.rollbackImportTask).not.toHaveBeenCalled()
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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
      createImportImageProgressReporter: jest.fn(() => ({
        advance: jest.fn(),
      })),
      importWorkflowChapter: jest.fn(async () => ({
        imageSucceeded: 1,
        imageTotal: 1,
        localChapterId: 101,
      })),
      prepareWorkflowImport: jest.fn(async () => ({
        chapterPlans: [{ chapter: { providerChapterId: 'p1' }, imageTotal: 1 }],
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
      aggregateAttempt: jest.fn(async () => createAttemptCounters()),
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

/// <reference types="jest" />

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/third-party/services/remote-image-import.service', () => ({
  RemoteImageImportService: class RemoteImageImportService {},
}))

import { WorkflowAttemptStatusEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { ThirdPartyComicSyncWorkflowHandler } from './third-party-comic-sync-workflow.handler'

describe('ThirdPartyComicSyncWorkflowHandler', () => {
  it('creates workflow items from the scan and retries failures per chapter', async () => {
    const registry = { register: jest.fn() }
    const workflowService = { completeAttemptByAttemptId: jest.fn() }
    const plans = [
      { imageTotal: 2, localSortOrder: 1, providerChapterId: 'p1', title: '第 1 话' },
      { imageTotal: 3, localSortOrder: 2, providerChapterId: 'p2', title: '第 2 话' },
    ]
    const items = plans.map((plan, index) => ({
      itemId: `item-${index + 1}`,
      metadata: { plan },
    }))
    const contentImportService = {
      aggregateJob: jest.fn(async () => ({
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
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
        .mockResolvedValueOnce(201)
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
      workflowService as never,
      contentImportService as never,
      syncService as never,
      remoteImageImportService as never,
    )

    await handler.execute({
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-1',
      attemptNo: 1,
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(),
      workflowType: 'content-import.third-party-sync',
    })

    expect(contentImportService.replaceThirdPartySyncItems).toHaveBeenCalledWith(
      'job-1',
      plans,
      1,
    )
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
    expect(workflowService.completeAttemptByAttemptId).toHaveBeenCalledWith(
      expect.objectContaining({
        failedItemCount: 1,
        status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
        successItemCount: 1,
      }),
    )
  })

  it('stops before marking item failure when workflow ownership is lost during rollback', async () => {
    const registry = { register: jest.fn() }
    const workflowService = { completeAttemptByAttemptId: jest.fn() }
    const plan = {
      imageTotal: 2,
      localSortOrder: 1,
      providerChapterId: 'p1',
      title: '第 1 话',
    }
    const contentImportService = {
      aggregateJob: jest.fn(),
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
      workflowService as never,
      contentImportService as never,
      syncService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

    await expect(
      handler.execute({
        appendEvent: jest.fn(),
        assertNotCancelled: jest.fn(),
        assertStillOwned: jest.fn().mockRejectedValue(ownershipLost),
        attemptId: 'attempt-2',
        attemptNo: 2,
        getStatus: jest.fn(),
        isCancelRequested: jest.fn(),
        jobId: 'job-1',
        updateProgress: jest.fn(),
        workflowType: 'content-import.third-party-sync',
      }),
    ).rejects.toThrow('claim lost')

    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(workflowService.completeAttemptByAttemptId).not.toHaveBeenCalled()
  })

  it('delegates expired attempt recovery to the content import domain', async () => {
    const registry = { register: jest.fn() }
    const workflowService = { completeAttemptByAttemptId: jest.fn() }
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
      workflowService as never,
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

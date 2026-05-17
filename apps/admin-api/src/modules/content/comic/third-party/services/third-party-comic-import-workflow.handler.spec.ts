/// <reference types="jest" />

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/third-party/services/remote-image-import.service', () => ({
  RemoteImageImportService: class RemoteImageImportService {},
}))

import { WorkflowAttemptStatusEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { ThirdPartyComicImportWorkflowHandler } from './third-party-comic-import-workflow.handler'

describe('ThirdPartyComicImportWorkflowHandler', () => {
  it('keeps successful chapters and fails only the broken chapter item', async () => {
    const registry = { register: jest.fn() }
    const workflowService = { completeAttemptByAttemptId: jest.fn() }
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
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markResiduesCleaned: jest.fn(),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
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
      workflowService as never,
      contentImportService as never,
      importService as never,
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
      workflowType: 'content-import.third-party-import',
    })

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
    const items = [
      {
        itemId: 'item-1',
        metadata: {
          chapter: { providerChapterId: 'p1', title: '第 1 话' },
        },
      },
    ]
    const contentImportService = {
      aggregateJob: jest.fn(),
      listExecutableItems: jest.fn(async () => items),
      listPendingUploadedFileResidues: jest.fn(async () => []),
      markItemFailed: jest.fn(),
      markItemSuccess: jest.fn(),
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
      workflowService as never,
      contentImportService as never,
      importService as never,
      { deleteImportedFile: jest.fn() } as never,
    )

    await expect(
      handler.execute({
        appendEvent: jest.fn(),
        assertNotCancelled: jest.fn(),
        assertStillOwned: jest.fn().mockRejectedValue(ownershipLost),
        attemptId: 'attempt-1',
        attemptNo: 1,
        getStatus: jest.fn(),
        isCancelRequested: jest.fn(),
        jobId: 'job-1',
        updateProgress: jest.fn(),
        workflowType: 'content-import.third-party-import',
      }),
    ).rejects.toThrow('claim lost')

    expect(contentImportService.markItemFailed).not.toHaveBeenCalled()
    expect(workflowService.completeAttemptByAttemptId).not.toHaveBeenCalled()
  })

  it('cleans old pending upload residues for an item before retrying it', async () => {
    const registry = { register: jest.fn() }
    const workflowService = { completeAttemptByAttemptId: jest.fn() }
    const deleteTarget = {
      filePath: 'old/partial.jpg',
      objectKey: 'old/partial.jpg',
      provider: 'local',
    }
    const contentImportService = {
      aggregateJob: jest.fn(async () => ({
        failedItemCount: 0,
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
      workflowService as never,
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
    const workflowService = { completeAttemptByAttemptId: jest.fn() }
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

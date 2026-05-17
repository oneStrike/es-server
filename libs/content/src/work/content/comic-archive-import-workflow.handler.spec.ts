/// <reference types="jest" />

jest.mock('./comic-archive-import.service', () => ({
  ComicArchiveImportService: class ComicArchiveImportService {},
}))

import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { ComicArchiveImportWorkflowHandler } from './comic-archive-import-workflow.handler'

describe('ComicArchiveImportWorkflowHandler', () => {
  it('registers and delegates archive workflow execution', async () => {
    const registry = { register: jest.fn() }
    const archiveImportService = {
      executeArchiveWorkflow: jest.fn(async () => undefined),
    }
    const handler = new ComicArchiveImportWorkflowHandler(
      registry as never,
      archiveImportService as never,
      {} as never,
    )
    const context = {
      attemptId: 'attempt-1',
      attemptNo: 1,
      jobId: 'job-1',
      workflowType: ContentImportWorkflowType.ARCHIVE_IMPORT,
    } as never

    handler.onModuleInit()
    await handler.execute(context)

    expect(registry.register).toHaveBeenCalledWith(handler)
    expect(archiveImportService.executeArchiveWorkflow).toHaveBeenCalledWith(
      context,
    )
  })

  it('delegates expired attempt recovery to content import service', async () => {
    const contentImportService = {
      recoverExpiredAttempt: jest.fn(async () => ({
        failedItemCount: 1,
        recoverableItemCount: 2,
        selectedItemCount: 3,
        skippedItemCount: 0,
        successItemCount: 0,
      })),
    }
    const handler = new ComicArchiveImportWorkflowHandler(
      { register: jest.fn() } as never,
      {} as never,
      contentImportService as never,
    )
    const tx = {} as never

    await expect(
      handler.recoverExpiredAttempt(
        {
          conflictKeys: [],
          expiredAttemptNo: 1,
          jobId: 'job-1',
          workflowType: ContentImportWorkflowType.ARCHIVE_IMPORT,
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

  it('delegates draft and retained-resource cleanup to archive service', async () => {
    const archiveImportService = {
      cleanupExpiredDraft: jest.fn(async () => undefined),
      cleanupRetainedResources: jest.fn(async () => undefined),
    }
    const handler = new ComicArchiveImportWorkflowHandler(
      { register: jest.fn() } as never,
      archiveImportService as never,
      {} as never,
    )

    await handler.cleanupExpiredDrafts('job-1')
    await handler.cleanupRetainedResources('job-1')

    expect(archiveImportService.cleanupExpiredDraft).toHaveBeenCalledWith(
      'job-1',
    )
    expect(archiveImportService.cleanupRetainedResources).toHaveBeenCalledWith(
      'job-1',
    )
  })
})

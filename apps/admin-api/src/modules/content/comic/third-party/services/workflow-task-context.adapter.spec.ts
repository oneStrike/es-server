/// <reference types="jest" />

import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { createWorkflowTaskContext } from './workflow-task-context.adapter'

describe('createWorkflowTaskContext', () => {
  it('uses image progress reporters to persist durable image progress and update image-based percent', async () => {
    const workflowContext = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-1',
      attemptNo: 1,
      completeAttempt: jest.fn(async () => undefined),
      completeAttemptWithDelayedRetry: jest.fn(async () => undefined),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(async () => undefined),
      workflowType: ContentImportWorkflowType.THIRD_PARTY_IMPORT,
    }
    const contentImportService = {
      markItemImageProgress: jest.fn(async () => ({
        failedItemCount: 0,
        imageFailedCount: 80,
        imageSuccessCount: 20,
        imageTotal: 100,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 0,
      })),
    }
    const taskContext = createWorkflowTaskContext(
      workflowContext,
      {},
      {
        contentImportService: contentImportService as never,
        itemId: 'item-1',
      },
    )
    const reporter = taskContext.createProgressReporter({
      endPercent: 95,
      message: '导入图片',
      startPercent: 10,
      total: 2,
      unit: 'image',
    })

    const progress = await reporter.advance({
      current: 1,
      detail: {
        providerChapterId: 'chapter-1',
        chapterIndex: 10,
        chapterTotal: 61,
        imageIndex: 19,
        imageTotal: 21,
      },
    })

    expect(progress).toEqual(
      expect.objectContaining({
        current: 1,
        message: '导入图片',
        percent: 53,
        total: 2,
        unit: 'image',
      }),
    )
    expect(contentImportService.markItemImageProgress).toHaveBeenCalledWith({
      imageSuccessCount: 1,
      imageTotal: 2,
      itemId: 'item-1',
    })
    expect(workflowContext.updateProgress).toHaveBeenCalledWith({
      counters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 0,
      },
      detail: {
        kind: 'content-import.image',
        workflowType: ContentImportWorkflowType.THIRD_PARTY_IMPORT,
        itemId: 'item-1',
        providerChapterId: 'chapter-1',
        chapterIndex: 10,
        chapterTotal: 61,
        imageIndex: 19,
        imageTotal: 21,
      },
      message: '导入图片',
      percent: 20,
    })
  })

  it('clears structured progress detail when reporter advances without detail', async () => {
    const workflowContext = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-1',
      attemptNo: 1,
      completeAttempt: jest.fn(async () => undefined),
      completeAttemptWithDelayedRetry: jest.fn(async () => undefined),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(async () => undefined),
      workflowType: ContentImportWorkflowType.THIRD_PARTY_SYNC,
    }
    const taskContext = createWorkflowTaskContext(workflowContext, {})
    const reporter = taskContext.createProgressReporter({
      message: '读取章节列表',
      total: 1,
    })

    await reporter.advance({ current: 1 })

    expect(workflowContext.updateProgress).toHaveBeenCalledWith({
      detail: null,
      message: '读取章节列表',
    })
  })

  it('does not expose workflow lease renewal to third-party task code', () => {
    const workflowContext = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-1',
      attemptNo: 1,
      completeAttempt: jest.fn(async () => undefined),
      completeAttemptWithDelayedRetry: jest.fn(async () => undefined),
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      updateProgress: jest.fn(async () => undefined),
      workflowType: ContentImportWorkflowType.THIRD_PARTY_IMPORT,
    }

    const taskContext = createWorkflowTaskContext(workflowContext, {})

    expect(taskContext).not.toHaveProperty('renewLease')
    expect(taskContext.assertNotCancelled).toBe(
      workflowContext.assertNotCancelled,
    )
    expect(taskContext.assertStillOwned).toBe(workflowContext.assertStillOwned)
    expect(taskContext.updateProgress).toBe(workflowContext.updateProgress)
  })
})

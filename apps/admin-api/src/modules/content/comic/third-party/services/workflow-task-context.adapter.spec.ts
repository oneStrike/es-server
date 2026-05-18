/// <reference types="jest" />

import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { createWorkflowTaskContext } from './workflow-task-context.adapter'

describe('createWorkflowTaskContext', () => {
  it('uses image progress reporters to update the current message without changing task progress percent', async () => {
    const workflowContext = {
      appendEvent: jest.fn(),
      assertNotCancelled: jest.fn(),
      assertStillOwned: jest.fn(),
      attemptId: 'attempt-1',
      attemptNo: 1,
      getStatus: jest.fn(),
      isCancelRequested: jest.fn(),
      jobId: 'job-1',
      renewLease: jest.fn(async () => undefined),
      updateProgress: jest.fn(async () => undefined),
      workflowType: ContentImportWorkflowType.THIRD_PARTY_IMPORT,
    }
    const taskContext = createWorkflowTaskContext(workflowContext, {})
    const reporter = taskContext.createProgressReporter({
      endPercent: 95,
      message: '导入图片',
      startPercent: 10,
      total: 2,
      unit: 'image',
    })

    const progress = await reporter.advance({ current: 1 })

    expect(progress).toEqual(
      expect.objectContaining({
        current: 1,
        message: '导入图片',
        percent: 53,
        total: 2,
        unit: 'image',
      }),
    )
    expect(workflowContext.updateProgress).toHaveBeenCalledWith({
      message: '导入图片',
    })
  })
})

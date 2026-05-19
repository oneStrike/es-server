/// <reference types="jest" />

import { ContentImportItemStatusEnum } from '@libs/content/work/content-import/content-import.constant'
import {
  WorkflowJobStatusEnum,
  WorkflowNotificationKindEnum,
} from '@libs/platform/modules/workflow/workflow.constant'
import { AdminWorkflowController } from './workflow.controller'

describe('AdminWorkflowController', () => {
  const workflowJob = {
    archivedAt: null,
    cancelRequestedAt: null,
    createdAt: new Date('2026-05-17T00:00:00.000Z'),
    displayName: '我独自升级',
    expiresAt: null,
    failedItemCount: 1,
    finishedAt: null,
    id: 1,
    jobId: 'job-1',
    operatorType: 1,
    operatorUserId: 7,
    progressMessage: '导入中',
    progressPercent: 50,
    selectedItemCount: 2,
    skippedItemCount: 0,
    startedAt: null,
    status: WorkflowJobStatusEnum.RUNNING,
    successItemCount: 1,
    summary: { sourceType: 'content-import.third-party-import' },
    updatedAt: new Date('2026-05-17T00:00:00.000Z'),
    workflowType: 'content-import.third-party-import',
  }
  const workflowDetail = {
    ...workflowJob,
    attempts: [
      {
        attemptId: 'attempt-1',
        attemptNo: 1,
        claimExpiresAt: null,
        claimedBy: null,
        createdAt: new Date('2026-05-17T00:00:00.000Z'),
        errorCode: null,
        errorMessage: null,
        failedItemCount: 1,
        finishedAt: null,
        heartbeatAt: null,
        id: 10,
        selectedItemCount: 2,
        skippedItemCount: 0,
        startedAt: null,
        status: 2,
        successItemCount: 1,
        triggerType: 1,
        updatedAt: new Date('2026-05-17T00:00:00.000Z'),
      },
    ],
  }
  const workflowRecordPage = {
    list: [
      {
        attemptId: 'attempt-1',
        attemptNo: 1,
        createdAt: new Date('2026-05-17T00:00:00.000Z'),
        detail: { itemId: 'item-1' },
        eventType: 6,
        id: 20,
        message: '章节导入成功',
      },
    ],
    pageIndex: 1,
    pageSize: 20,
    total: 1,
  }
  const workflowNotificationList = {
    list: [
      {
        createdAt: new Date('2026-05-17T00:10:00.000Z'),
        displayName: '我独自升级',
        failedItemCount: 0,
        id: 21,
        jobId: 'job-1',
        kind: WorkflowNotificationKindEnum.SUCCESS,
        nextRetryAt: null,
        selectedItemCount: 2,
        skippedItemCount: 0,
        status: WorkflowJobStatusEnum.SUCCESS,
        successItemCount: 2,
        updatedAt: new Date('2026-05-17T00:10:00.000Z'),
        workflowType: 'content-import.third-party-import',
      },
    ],
    nextAfterId: 21,
    nextCreatedAfter: new Date('2026-05-17T00:10:00.000Z'),
    serverTime: new Date('2026-05-17T00:10:01.000Z'),
  }
  const contentImportItem = {
    currentAttemptNo: 1,
    failureCount: 0,
    imageSuccessCount: 2,
    imageTotal: 2,
    itemId: 'item-1',
    localChapterId: 100,
    providerChapterId: 'chapter-1',
    sortOrder: 1,
    stage: 7,
    status: ContentImportItemStatusEnum.SUCCESS,
    title: '第 1 话',
    updatedAt: new Date('2026-05-17T00:00:00.000Z'),
  }

  function createController() {
    const workflowService = {
      archiveJob: jest.fn(async () => workflowJob),
      cancelJob: jest.fn(async () => workflowJob),
      expireJob: jest.fn(async () => workflowJob),
      getJobDetail: jest.fn(async () => workflowDetail),
      getJobPage: jest.fn(async () => ({
        list: [workflowJob],
        pageIndex: 1,
        pageSize: 10,
        total: 1,
      })),
      getNotificationList: jest.fn(async () => workflowNotificationList),
      getJobRecordPage: jest.fn(async () => workflowRecordPage),
      retryItems: jest.fn(async () => workflowJob),
    }
    const contentImportService = {
      getItemPage: jest.fn(async () => ({
        list: [contentImportItem],
        pageIndex: 1,
        pageSize: 10,
        total: 1,
      })),
    }

    return {
      contentImportService,
      controller: new AdminWorkflowController(
        workflowService as never,
        contentImportService as never,
      ),
      workflowService,
    }
  }

  it('returns workflow job page items without changing WorkflowJobDto fields', async () => {
    const { controller, workflowService } = createController()
    const query = { pageIndex: 1, pageSize: 10 } as never

    const result = await controller.getJobPage(query)

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        displayName: '我独自升级',
        failedItemCount: 1,
        jobId: 'job-1',
        progressPercent: 50,
        status: WorkflowJobStatusEnum.RUNNING,
        successItemCount: 1,
        workflowType: 'content-import.third-party-import',
      }),
    )
    expect(workflowService.getJobPage).toHaveBeenCalledWith(query)
  })

  it('returns workflow detail with attempts and without unbounded events', async () => {
    const { controller, workflowService } = createController()

    const result = await controller.getJobDetail({ jobId: 'job-1' })

    expect(result).toEqual(
      expect.objectContaining({
        attempts: [
          expect.objectContaining({
            attemptId: 'attempt-1',
            attemptNo: 1,
            failedItemCount: 1,
            successItemCount: 1,
          }),
        ],
        jobId: 'job-1',
      }),
    )
    expect(result).not.toHaveProperty('events')
    expect(workflowService.getJobDetail).toHaveBeenCalledWith({
      jobId: 'job-1',
    })
  })

  it('returns bounded workflow records through the record page endpoint', async () => {
    const { controller, workflowService } = createController()
    const query = { jobId: 'job-1', pageIndex: 1, pageSize: 20 } as never

    const result = await controller.getRecordPage(query)

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        attemptId: 'attempt-1',
        attemptNo: 1,
        eventType: 6,
        message: '章节导入成功',
      }),
    )
    expect(workflowService.getJobRecordPage).toHaveBeenCalledWith(query)
  })

  it('returns lightweight workflow notification facts without UI copy', async () => {
    const { controller, workflowService } = createController()
    const query = {
      afterId: 20,
      createdAfter: new Date('2026-05-17T00:00:00.000Z'),
      limit: 20,
    } as never

    const result = await controller.getNotificationList(query)

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        displayName: '我独自升级',
        jobId: 'job-1',
        kind: WorkflowNotificationKindEnum.SUCCESS,
      }),
    )
    expect(result.list[0]).not.toHaveProperty('message')
    expect(result.list[0]).not.toHaveProperty('title')
    expect(workflowService.getNotificationList).toHaveBeenCalledWith(query)
  })

  it('keeps the workflow item page endpoint as a transitional compatibility facade', async () => {
    const { contentImportService, controller } = createController()
    const query = { jobId: 'job-1', pageIndex: 1, pageSize: 10 } as never

    const result = await controller.getItemPage(query)

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        imageSuccessCount: 2,
        imageTotal: 2,
        itemId: 'item-1',
        status: ContentImportItemStatusEnum.SUCCESS,
        title: '第 1 话',
      }),
    )
    expect(contentImportService.getItemPage).toHaveBeenCalledWith(query)
  })

  it('keeps cancel, archive, retry and expire actions on the workflow service contract', async () => {
    const { controller, workflowService } = createController()

    await expect(controller.cancelJob({ jobId: 'job-1' })).resolves.toEqual(
      workflowJob,
    )
    await expect(
      controller.archiveJob({ jobId: 'job-1' }),
    ).resolves.toEqual(workflowJob)
    await expect(
      controller.retryItems({ jobId: 'job-1', itemIds: ['item-1'] }),
    ).resolves.toEqual(workflowJob)
    await expect(controller.expireJob({ jobId: 'job-1' })).resolves.toEqual(
      workflowJob,
    )

    expect(workflowService.cancelJob).toHaveBeenCalledWith({ jobId: 'job-1' })
    expect(workflowService.archiveJob).toHaveBeenCalledWith({ jobId: 'job-1' })
    expect(workflowService.retryItems).toHaveBeenCalledWith({
      itemIds: ['item-1'],
      jobId: 'job-1',
    })
    expect(workflowService.expireJob).toHaveBeenCalledWith({ jobId: 'job-1' })
  })
})

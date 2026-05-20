import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BusinessException } from '@libs/platform/exceptions'
import { WorkflowCancellationError } from './workflow-cancellation'
import {
  WorkflowAttemptStatusEnum,
  WorkflowAttemptTriggerTypeEnum,
  WorkflowEventTypeEnum,
  WorkflowJobArchiveScopeEnum,
  WorkflowJobStatusEnum,
  WorkflowNotificationKindEnum,
  WorkflowOperatorTypeEnum,
} from './workflow.constant'
import { WorkflowService } from './workflow.service'

describe('WorkflowService state machine', () => {
  const baseDate = new Date('2026-05-17T03:00:00.000Z')

  function createWorkflowSchema() {
    return {
      workflowAttempt: {
        attemptId: 'attemptId',
        attemptNo: 'attemptNo',
        claimExpiresAt: 'claimExpiresAt',
        claimedBy: 'claimedBy',
        createdAt: 'attemptCreatedAt',
        errorCode: 'errorCode',
        errorMessage: 'errorMessage',
        failedItemCount: 'attemptFailedItemCount',
        finishedAt: 'attemptFinishedAt',
        heartbeatAt: 'heartbeatAt',
        id: 'attemptIdPk',
        notBeforeAt: 'notBeforeAt',
        selectedItemCount: 'attemptSelectedItemCount',
        skippedItemCount: 'attemptSkippedItemCount',
        startedAt: 'attemptStartedAt',
        status: 'attemptStatus',
        successItemCount: 'attemptSuccessItemCount',
        triggerType: 'triggerType',
        updatedAt: 'attemptUpdatedAt',
        workflowJobId: 'attemptWorkflowJobId',
      },
      workflowConflictKey: {
        conflictKey: 'conflictKey',
        createdAt: 'conflictCreatedAt',
        id: 'conflictId',
        releasedAt: 'releasedAt',
        updatedAt: 'conflictUpdatedAt',
        workflowJobId: 'conflictWorkflowJobId',
        workflowType: 'conflictWorkflowType',
      },
      workflowEvent: {
        createdAt: 'eventCreatedAt',
        detail: 'detail',
        eventType: 'eventType',
        id: 'eventId',
        message: 'message',
        workflowAttemptId: 'eventWorkflowAttemptId',
        workflowJobId: 'eventWorkflowJobId',
      },
      workflowJob: {
        archivedAt: 'archivedAt',
        cancelRequestedAt: 'cancelRequestedAt',
        createdAt: 'createdAt',
        currentAttemptFk: 'currentAttemptFk',
        displayName: 'displayName',
        expiresAt: 'expiresAt',
        failedItemCount: 'failedItemCount',
        finishedAt: 'finishedAt',
        id: 'id',
        jobId: 'jobId',
        operatorType: 'operatorType',
        operatorUserId: 'operatorUserId',
        progressDetail: 'progressDetail',
        progressMessage: 'progressMessage',
        progressPercent: 'progressPercent',
        selectedItemCount: 'selectedItemCount',
        skippedItemCount: 'skippedItemCount',
        startedAt: 'startedAt',
        status: 'status',
        successItemCount: 'successItemCount',
        summary: 'summary',
        updatedAt: 'updatedAt',
        workflowType: 'workflowType',
      },
    }
  }

  function createWorkflowJob(overrides: Record<string, unknown> = {}) {
    return {
      cancelRequestedAt: null,
      archivedAt: null,
      createdAt: baseDate,
      currentAttemptFk: null,
      displayName: '内容导入',
      expiresAt: null,
      failedItemCount: 1,
      finishedAt: null,
      id: 1n,
      jobId: 'job-1',
      operatorType: WorkflowOperatorTypeEnum.ADMIN,
      operatorUserId: 7,
      progressDetail: null,
      progressMessage: null,
      progressPercent: 0,
      selectedItemCount: 2,
      skippedItemCount: 0,
      startedAt: null,
      status: WorkflowJobStatusEnum.FAILED,
      successItemCount: 0,
      summary: null,
      updatedAt: baseDate,
      workflowType: 'content-import.third-party-import',
      ...overrides,
    }
  }

  function createWorkflowAttempt(overrides: Record<string, unknown> = {}) {
    return {
      attemptId: 'attempt-1',
      attemptNo: 1,
      claimExpiresAt: baseDate,
      claimedBy: 'worker-1',
      createdAt: baseDate,
      errorCode: null,
      errorMessage: null,
      failedItemCount: 0,
      finishedAt: null,
      heartbeatAt: baseDate,
      id: 10n,
      notBeforeAt: null,
      selectedItemCount: 2,
      skippedItemCount: 0,
      startedAt: baseDate,
      status: WorkflowAttemptStatusEnum.RUNNING,
      successItemCount: 0,
      triggerType: WorkflowAttemptTriggerTypeEnum.INITIAL_CONFIRM,
      updatedAt: baseDate,
      workflowJobId: 1n,
      ...overrides,
    }
  }

  function createWorkflowEvent(overrides: Record<string, unknown> = {}) {
    return {
      createdAt: baseDate,
      detail: null,
      eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
      id: 20n,
      message: '工作流 attempt 已完成',
      workflowAttemptId: 10n,
      workflowJobId: 1n,
      ...overrides,
    }
  }

  function createUpdateTx(returningRows: unknown[][] = []) {
    const updateSets: Record<string, unknown>[] = []
    const updateTargets: unknown[] = []
    const update = jest.fn((target?: unknown) => ({
      set: jest.fn((value: Record<string, unknown>) => {
        updateTargets.push(target)
        updateSets.push(value)
        return {
          where: jest.fn(() => ({
            returning: jest.fn(async () => returningRows.shift() ?? []),
          })),
        }
      }),
    }))

    return {
      tx: {
        insert: jest.fn(() => ({
          values: jest.fn(() => ({
            returning: jest.fn(async () => [{ id: 99n }]),
          })),
        })),
        update,
      },
      updateTargets,
      updateSets,
    }
  }

  function createSelectDb(selectRows: unknown[][]) {
    return {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(async () => [{ id: 99n }]),
        })),
      })),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(async () => selectRows.shift() ?? []),
            })),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(async () => []),
          })),
        })),
      })),
    }
  }

  function createDetailDb(selectRows: unknown[][]) {
    return {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(async () => [{ id: 99n }]),
        })),
      })),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => selectRows.shift() ?? []),
            orderBy: jest.fn(async () => selectRows.shift() ?? []),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(async () => []),
          })),
        })),
      })),
    }
  }

  function createNotificationDb(selectRows: unknown[][]) {
    const query = {
      from: jest.fn(() => query),
      innerJoin: jest.fn(() => query),
      limit: jest.fn(async () => selectRows.shift() ?? []),
      orderBy: jest.fn(() => query),
      where: jest.fn(() => query),
    }

    return {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(async () => [{ id: 99n }]),
        })),
      })),
      select: jest.fn(() => query),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(async () => []),
          })),
        })),
      })),
    }
  }

  function createService(options: { db?: unknown; tx?: ReturnType<typeof createUpdateTx>['tx'] } = {}) {
    const tx = options.tx ?? createUpdateTx().tx
    const drizzle = {
      db: options.db ?? tx,
      schema: createWorkflowSchema(),
      withTransaction: jest.fn(async (callback) => callback(tx)),
    }
    const handler = {
      cleanupExpiredDrafts: jest.fn(async () => undefined),
      cleanupRetainedResources: jest.fn(async () => undefined),
      execute: jest.fn(async () => undefined),
      prepareRetry: jest.fn(async () => undefined),
      recoverExpiredAttempt: jest.fn(async () => ({
        attemptCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 0,
        },
        jobCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 0,
        },
        recoverableItemCount: 1,
        selectedItemCount: 2,
      })),
      validateRetry: jest.fn(async () => undefined),
      workflowType: 'content-import.third-party-import',
    }
    const registry = {
      has: jest.fn(() => true),
      resolve: jest.fn(() => handler),
    }
    const service = new WorkflowService(drizzle as never, registry as never)

    return {
      drizzle,
      handler,
      registry,
      service,
      tx,
    }
  }

  function setServiceMethod(
    service: WorkflowService,
    name: string,
    implementation: unknown,
  ) {
    Object.defineProperty(service, name, {
      configurable: true,
      value: implementation,
    })
  }

  it('returns workflow detail without loading unbounded events', async () => {
    const progressDetail = {
      kind: 'content-import.image',
      workflowType: 'content-import.third-party-import',
      itemId: 'item-1',
      imageIndex: 19,
      imageTotal: 21,
    }
    const job = createWorkflowJob({ progressDetail })
    const attempt = createWorkflowAttempt()
    const db = createDetailDb([[attempt]])
    const { service } = createService({ db })
    setServiceMethod(service, 'readJob', jest.fn(async () => job))

    const result = await service.getJobDetail({ jobId: 'job-1' })

    expect(result).toEqual(
      expect.objectContaining({
        attempts: [
          expect.objectContaining({
            attemptId: 'attempt-1',
            attemptNo: 1,
          }),
        ],
        jobId: 'job-1',
        progressDetail,
      }),
    )
    expect(result).not.toHaveProperty('events')
    expect(db.select).toHaveBeenCalledTimes(1)
  })

  it('excludes archived workflow jobs from the default page', async () => {
    const activeJob = createWorkflowJob({ failedItemCount: 0 })
    const findPagination = jest.fn(async () => ({
      list: [activeJob],
      pageIndex: 1,
      pageSize: 10,
      total: 1,
    }))
    const { service } = createService()
    Object.defineProperty(service, 'drizzle', {
      configurable: true,
      value: {
        ext: { findPagination },
        schema: createWorkflowSchema(),
      },
    })

    const result = await service.getJobPage({ pageIndex: 1, pageSize: 10 })

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        archivedAt: null,
        jobId: 'job-1',
      }),
    )
    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        where: expect.anything(),
      }),
    )
  })

  it('supports archived-only and all workflow page scopes', async () => {
    const archivedAt = new Date('2026-05-18T03:00:00.000Z')
    const archivedJob = createWorkflowJob({ archivedAt })
    const findPagination = jest
      .fn()
      .mockResolvedValueOnce({
        list: [archivedJob],
        pageIndex: 1,
        pageSize: 10,
        total: 1,
      })
      .mockResolvedValueOnce({
        list: [archivedJob, createWorkflowJob()],
        pageIndex: 1,
        pageSize: 10,
        total: 2,
      })
    const { service } = createService()
    Object.defineProperty(service, 'drizzle', {
      configurable: true,
      value: {
        ext: { findPagination },
        schema: createWorkflowSchema(),
      },
    })

    const archivedResult = await service.getJobPage({
      archiveScope: WorkflowJobArchiveScopeEnum.ARCHIVED,
      pageIndex: 1,
      pageSize: 10,
    })
    const allResult = await service.getJobPage({
      archiveScope: WorkflowJobArchiveScopeEnum.ALL,
      pageIndex: 1,
      pageSize: 10,
    })

    expect(archivedResult.list[0]).toEqual(
      expect.objectContaining({
        archivedAt,
        jobId: 'job-1',
      }),
    )
    expect(allResult.total).toBe(2)
    expect(findPagination).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ where: expect.anything() }),
    )
    expect(findPagination).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ where: undefined }),
    )
  })

  it('returns bounded workflow records with attempt correlation', async () => {
    const job = createWorkflowJob()
    const attempt = createWorkflowAttempt()
    const event = {
      createdAt: baseDate,
      detail: { itemId: 'item-1' },
      eventType: WorkflowEventTypeEnum.ITEM_SUCCEEDED,
      id: 20n,
      message: '章节导入成功',
      workflowAttemptId: attempt.id,
      workflowJobId: job.id,
    }
    const { service } = createService()
    const findPagination = jest.fn(async () => ({
      list: [event],
      pageIndex: 1,
      pageSize: 20,
      total: 1,
    }))
    setServiceMethod(service, 'readJob', jest.fn(async () => job))
    setServiceMethod(
      service,
      'readAttemptsByInternalIds',
      jest.fn(async () => new Map([[attempt.id, attempt]])),
    )
    Object.defineProperty(service, 'drizzle', {
      configurable: true,
      value: {
        db: {},
        ext: { findPagination },
        schema: createWorkflowSchema(),
      },
    })

    const result = await (
      service as unknown as {
        getJobRecordPage: (input: {
          jobId: string
          pageIndex: number
          pageSize: number
        }) => Promise<{
          list: Array<{
            attemptId: string | null
            attemptNo: number | null
            eventType: WorkflowEventTypeEnum
            message: string
          }>
          pageIndex: number
          pageSize: number
          total: number
        }>
      }
    ).getJobRecordPage({
      jobId: 'job-1',
      pageIndex: 1,
      pageSize: 20,
    })

    expect(result).toEqual(
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 20,
        total: 1,
      }),
    )
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        attemptId: 'attempt-1',
        attemptNo: 1,
        eventType: WorkflowEventTypeEnum.ITEM_SUCCEEDED,
        message: '章节导入成功',
      }),
    )
    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 20,
      }),
    )
  })

  it('projects workflow notification facts from eligible audit events only', async () => {
    const successCreatedAt = new Date('2026-05-17T03:01:00.000Z')
    const retryCreatedAt = new Date('2026-05-17T03:02:00.000Z')
    const failedCreatedAt = new Date('2026-05-17T03:03:00.000Z')
    const successAttempt = createWorkflowAttempt({
      id: 10n,
      status: WorkflowAttemptStatusEnum.SUCCESS,
    })
    const retryAttempt = createWorkflowAttempt({
      id: 11n,
      notBeforeAt: new Date('2026-05-17T03:10:00.000Z'),
      triggerType: WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
    })
    const manualRetryAttempt = createWorkflowAttempt({
      id: 12n,
      triggerType: WorkflowAttemptTriggerTypeEnum.MANUAL_RETRY,
    })
    const previousAttempt = createWorkflowAttempt({
      id: 13n,
      status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
    })
    const failedAttempt = createWorkflowAttempt({
      id: 14n,
      status: WorkflowAttemptStatusEnum.FAILED,
    })
    const db = createNotificationDb([
      [
        {
          attempt: successAttempt,
          event: createWorkflowEvent({
            createdAt: successCreatedAt,
            id: 21n,
            workflowAttemptId: successAttempt.id,
          }),
          job: createWorkflowJob({
            currentAttemptFk: successAttempt.id,
            failedItemCount: 0,
            finishedAt: successCreatedAt,
            status: WorkflowJobStatusEnum.SUCCESS,
            successItemCount: 2,
          }),
        },
        {
          attempt: retryAttempt,
          event: createWorkflowEvent({
            createdAt: retryCreatedAt,
            eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
            id: 22n,
            workflowAttemptId: retryAttempt.id,
          }),
          job: createWorkflowJob({
            currentAttemptFk: retryAttempt.id,
            status: WorkflowJobStatusEnum.PENDING,
          }),
        },
        {
          attempt: manualRetryAttempt,
          event: createWorkflowEvent({
            eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
            id: 23n,
            workflowAttemptId: manualRetryAttempt.id,
          }),
          job: createWorkflowJob({
            currentAttemptFk: manualRetryAttempt.id,
            status: WorkflowJobStatusEnum.PENDING,
          }),
        },
        {
          attempt: previousAttempt,
          event: createWorkflowEvent({
            eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
            id: 24n,
            workflowAttemptId: previousAttempt.id,
          }),
          job: createWorkflowJob({
            currentAttemptFk: retryAttempt.id,
            status: WorkflowJobStatusEnum.PENDING,
          }),
        },
        {
          attempt: failedAttempt,
          event: createWorkflowEvent({
            createdAt: failedCreatedAt,
            eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
            id: 25n,
            workflowAttemptId: failedAttempt.id,
          }),
          job: createWorkflowJob({
            currentAttemptFk: failedAttempt.id,
            status: WorkflowJobStatusEnum.FAILED,
          }),
        },
        {
          attempt: createWorkflowAttempt({ id: 15n }),
          event: createWorkflowEvent({
            eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
            id: 26n,
            workflowAttemptId: 15n,
          }),
          job: createWorkflowJob({
            archivedAt: new Date('2026-05-18T00:00:00.000Z'),
            currentAttemptFk: 15n,
            status: WorkflowJobStatusEnum.SUCCESS,
          }),
        },
      ],
    ])
    const { service } = createService({ db })

    const result = await service.getNotificationList({
      afterId: 0,
      createdAfter: baseDate,
      limit: 20,
    })

    expect(result.list.map((item) => item.kind)).toEqual([
      WorkflowNotificationKindEnum.SUCCESS,
      WorkflowNotificationKindEnum.RETRYING,
      WorkflowNotificationKindEnum.FAILED,
    ])
    expect(result.list[1]).toEqual(
      expect.objectContaining({
        jobId: 'job-1',
        nextRetryAt: retryAttempt.notBeforeAt,
      }),
    )
    expect(result.list[0]).not.toHaveProperty('message')
    expect(result.list[0]).not.toHaveProperty('title')
    expect(result.nextAfterId).toBe(25)
    expect(result.nextCreatedAfter).toEqual(failedCreatedAt)
    expect(result.serverTime).toBeInstanceOf(Date)
    expect(db.select).toHaveBeenCalledTimes(1)
  })

  it('filters workflow notifications by kind after projection', async () => {
    const db = createNotificationDb([
      [
        {
          attempt: createWorkflowAttempt({
            id: 10n,
            status: WorkflowAttemptStatusEnum.SUCCESS,
          }),
          event: createWorkflowEvent({ id: 21n }),
          job: createWorkflowJob({
            currentAttemptFk: 10n,
            status: WorkflowJobStatusEnum.SUCCESS,
          }),
        },
        {
          attempt: createWorkflowAttempt({
            id: 11n,
            triggerType: WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
          }),
          event: createWorkflowEvent({
            eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
            id: 22n,
            workflowAttemptId: 11n,
          }),
          job: createWorkflowJob({
            currentAttemptFk: 11n,
            status: WorkflowJobStatusEnum.PENDING,
          }),
        },
      ],
    ])
    const { service } = createService({ db })

    const result = await service.getNotificationList({
      kinds: [WorkflowNotificationKindEnum.RETRYING],
    })

    expect(result.list).toHaveLength(1)
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        kind: WorkflowNotificationKindEnum.RETRYING,
      }),
    )
  })

  it('declares the global workflow notification cursor index', () => {
    const schemaSource = readFileSync(
      resolve(process.cwd(), 'db/schema/system/workflow-event.ts'),
      'utf8',
    )

    expect(schemaSource).toContain('workflow_event_notification_created_at_id_idx')
    expect(schemaSource).toContain('eventType} in (8, 10)')
  })

  it('does not expose a transaction-only draft path that skips creation events', () => {
    const { service } = createService()

    expect('createDraftInTransaction' in service).toBe(false)
  })

  it('builds execution contexts without exposing manual lease renewal', () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { service } = createService()

    const context = (
      service as unknown as {
        buildExecutionContext: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
        ) => Record<string, unknown>
      }
    ).buildExecutionContext(job, attempt)

    expect(context).not.toHaveProperty('renewLease')
    expect(context.updateProgress).toEqual(expect.any(Function))
    expect(context.assertStillOwned).toEqual(expect.any(Function))
  })

  it('updates progress without renewing the attempt lease or appending progress events', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { updateSets, tx } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    const appendEvent = jest.fn(async () => 1n)
    const renewLeaseForAttempt = jest.fn(async () => undefined)
    setServiceMethod(service, 'appendEvent', appendEvent)
    setServiceMethod(service, 'renewLeaseForAttempt', renewLeaseForAttempt)
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: { message: string; percent: number },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, {
      message: '下载第 43 话图片 1/100',
      percent: 10,
    })

    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          progressMessage: '下载第 43 话图片 1/100',
          progressPercent: 10,
        }),
      ]),
    )
    expect(updateSets).toHaveLength(1)
    expect(renewLeaseForAttempt).not.toHaveBeenCalled()
    expect(appendEvent).not.toHaveBeenCalled()
  })

  it('updates job counters carried by progress without touching attempt counters', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      failedItemCount: 1,
      status: WorkflowJobStatusEnum.RUNNING,
      successItemCount: 0,
    })
    const attempt = createWorkflowAttempt({
      failedItemCount: 0,
      successItemCount: 0,
    })
    const { updateSets, tx } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: {
            counters: {
              failedItemCount: number
              skippedItemCount: number
              successItemCount: number
            }
            message: string
            percent: number
          },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, {
      counters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      message: '章节导入进度已更新',
      percent: 50,
    })

    expect(updateSets).toHaveLength(1)
    expect(updateSets[0]).toEqual(
      expect.objectContaining({
        failedItemCount: 0,
        progressMessage: '章节导入进度已更新',
        progressPercent: 50,
        skippedItemCount: 0,
        successItemCount: 1,
      }),
    )
  })

  it('updates structured progress detail without changing task progress percent', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      progressPercent: 50,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const progressDetail = {
      kind: 'content-import.image',
      workflowType: 'content-import.third-party-import',
      itemId: 'item-1',
      providerChapterId: 'chapter-1',
      chapterIndex: 10,
      chapterTotal: 61,
      imageIndex: 19,
      imageTotal: 21,
    }
    const { updateSets, tx } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: { detail: Record<string, unknown>; message: string },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, {
      detail: progressDetail,
      message: '正在导入图片 19/21',
    })

    const jobUpdate = updateSets.find(
      (item) => item.progressMessage === '正在导入图片 19/21',
    )
    expect(jobUpdate).toEqual(
      expect.objectContaining({
        progressDetail,
        progressMessage: '正在导入图片 19/21',
      }),
    )
    expect(jobUpdate).not.toHaveProperty('progressPercent')
  })

  it('clears structured progress detail when detail is explicitly null', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      progressDetail: {
        kind: 'content-import.image',
        imageIndex: 1,
        imageTotal: 2,
      },
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { updateSets, tx } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: { detail: null },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, { detail: null })

    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          progressDetail: null,
        }),
      ]),
    )
  })

  it('keeps the task progress percent when only the current item message changes', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      progressPercent: 50,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { updateSets, tx } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: { message: string },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, {
      message: '正在导入第 2/4 个章节的图片',
    })

    const jobUpdate = updateSets.find(
      (item) => item.progressMessage === '正在导入第 2/4 个章节的图片',
    )
    expect(jobUpdate).toEqual(
      expect.objectContaining({
        progressMessage: '正在导入第 2/4 个章节的图片',
      }),
    )
    expect(jobUpdate).not.toHaveProperty('progressPercent')
  })

  it('keeps the current item message when only the task progress percent changes', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      progressMessage: '正在导入图片 1/10',
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { updateSets, tx } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: { percent: number },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, {
      percent: 50,
    })

    const jobUpdate = updateSets.find((item) => item.progressPercent === 50)
    expect(jobUpdate).toEqual(
      expect.objectContaining({
        progressPercent: 50,
      }),
    )
    expect(jobUpdate).not.toHaveProperty('progressMessage')
  })

  it('ignores progress updates after the attempt loses ownership', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { tx, updateSets } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => false))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: { detail: Record<string, unknown>; message: string },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, {
      detail: {
        kind: 'content-import.image',
        imageIndex: 1,
        imageTotal: 2,
      },
      message: '迟到的图片进度',
    })

    expect(updateSets).toHaveLength(0)
  })

  it('does not write progress after a cancel request is observed', async () => {
    const job = createWorkflowJob({
      cancelRequestedAt: baseDate,
      currentAttemptFk: 10n,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { tx, updateSets } = createUpdateTx([[attempt]])
    const { service } = createService({ tx })
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => false))

    await (
      service as unknown as {
        updateProgressForAttempt: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
          progress: { detail: Record<string, unknown>; message: string },
        ) => Promise<void>
      }
    ).updateProgressForAttempt(job, attempt, {
      detail: {
        kind: 'content-import.image',
        imageIndex: 2,
        imageTotal: 3,
      },
      message: '取消后的图片进度',
    })

    expect(updateSets).toHaveLength(0)
  })

  it('rejects cancellation for terminal jobs before mutating state', async () => {
    const { service, tx } = createService()
    setServiceMethod(
      service,
      'readJobWithDb',
      jest.fn(async () =>
        createWorkflowJob({ status: WorkflowJobStatusEnum.SUCCESS }),
      ),
    )

    await expect(service.cancelJob({ jobId: 'job-1' })).rejects.toBeInstanceOf(
      BusinessException,
    )
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('cancels pending jobs by cancelling attempts and releasing conflict keys', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      status: WorkflowJobStatusEnum.PENDING,
    })
    const updatedJob = {
      ...job,
      finishedAt: baseDate,
      status: WorkflowJobStatusEnum.CANCELLED,
    }
    const { tx, updateSets } = createUpdateTx([[updatedJob]])
    const { service } = createService({ tx })
    const cancelPendingAttempts = jest.fn(async () => undefined)
    const releaseConflictKeys = jest.fn(async () => undefined)
    const appendEventWithDb = jest.fn(async () => 1n)
    setServiceMethod(service, 'readJobWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'cancelPendingAttempts', cancelPendingAttempts)
    setServiceMethod(service, 'releaseConflictKeys', releaseConflictKeys)
    setServiceMethod(service, 'appendEventWithDb', appendEventWithDb)

    const result = await service.cancelJob({ jobId: 'job-1' })

    expect(result).toEqual(
      expect.objectContaining({
        jobId: 'job-1',
        status: WorkflowJobStatusEnum.CANCELLED,
      }),
    )
    expect(cancelPendingAttempts).toHaveBeenCalledWith(
      job.id,
      tx,
      expect.any(Date),
    )
    expect(releaseConflictKeys).toHaveBeenCalledWith(
      job.id,
      tx,
      expect.any(Date),
    )
    expect(appendEventWithDb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: WorkflowEventTypeEnum.CANCEL_REQUESTED,
        workflowAttemptId: 10n,
        workflowJobId: job.id,
      }),
      tx,
    )
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          progressDetail: null,
          status: WorkflowJobStatusEnum.CANCELLED,
        }),
      ]),
    )
  })

  it('clears structured progress detail immediately when a running job is cancelling', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      progressDetail: {
        kind: 'content-import.image',
        imageIndex: 1,
        imageTotal: 2,
      },
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const updatedJob = {
      ...job,
      cancelRequestedAt: baseDate,
      progressDetail: null,
      status: WorkflowJobStatusEnum.RUNNING,
    }
    const { tx, updateSets } = createUpdateTx([[updatedJob]])
    const { service } = createService({ tx })
    const cancelPendingAttempts = jest.fn(async () => undefined)
    const releaseConflictKeys = jest.fn(async () => undefined)
    setServiceMethod(service, 'readJobWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'cancelPendingAttempts', cancelPendingAttempts)
    setServiceMethod(service, 'releaseConflictKeys', releaseConflictKeys)
    setServiceMethod(service, 'appendEventWithDb', jest.fn(async () => 1n))

    const result = await service.cancelJob({ jobId: 'job-1' })

    expect(result).toEqual(
      expect.objectContaining({
        progressDetail: null,
        status: WorkflowJobStatusEnum.RUNNING,
      }),
    )
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          progressDetail: null,
          status: WorkflowJobStatusEnum.RUNNING,
        }),
      ]),
    )
    expect(cancelPendingAttempts).not.toHaveBeenCalled()
    expect(releaseConflictKeys).not.toHaveBeenCalled()
  })

  it('retries failed jobs by reusing conflict keys and restoring active list visibility', async () => {
    const job = createWorkflowJob({
      archivedAt: new Date('2026-05-18T03:00:00.000Z'),
      status: WorkflowJobStatusEnum.FAILED,
    })
    const retryAttempt = createWorkflowAttempt({
      attemptId: 'attempt-2',
      attemptNo: 2,
      id: 11n,
      triggerType: WorkflowAttemptTriggerTypeEnum.MANUAL_RETRY,
    })
    const updatedJob = {
      ...job,
      currentAttemptFk: retryAttempt.id,
      finishedAt: null,
      status: WorkflowJobStatusEnum.PENDING,
    }
    const { tx, updateSets } = createUpdateTx([[updatedJob]])
    const { handler, service } = createService({ tx })
    ;(handler.prepareRetry as jest.Mock).mockResolvedValueOnce({
      jobCounters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
    })
    const reserveConflictKeys = jest.fn(async () => undefined)
    const appendEventWithDb = jest.fn(async () => 1n)
    setServiceMethod(service, 'readJobWithDb', jest.fn(async () => job))
    setServiceMethod(
      service,
      'readJobConflictKeys',
      jest.fn(async () => ['source-scope:copy:comic:default']),
    )
    setServiceMethod(service, 'resolveNextAttemptNo', jest.fn(async () => 2))
    setServiceMethod(service, 'reserveConflictKeys', reserveConflictKeys)
    setServiceMethod(service, 'createAttemptWithDb', jest.fn(async () => retryAttempt))
    setServiceMethod(service, 'appendEventWithDb', appendEventWithDb)

    const result = await service.retryItems({
      itemIds: ['item-1'],
      jobId: 'job-1',
    })

    expect(result).toEqual(
      expect.objectContaining({
        jobId: 'job-1',
        status: WorkflowJobStatusEnum.PENDING,
      }),
    )
    expect(handler.validateRetry).toHaveBeenCalledWith({
      conflictKeys: ['source-scope:copy:comic:default'],
      jobId: 'job-1',
      selectedItemIds: ['item-1'],
      workflowType: 'content-import.third-party-import',
    })
    expect(reserveConflictKeys).toHaveBeenCalledWith(
      job,
      ['source-scope:copy:comic:default'],
      tx,
    )
    expect(handler.prepareRetry).toHaveBeenCalledWith(
      {
        conflictKeys: ['source-scope:copy:comic:default'],
        jobId: 'job-1',
        selectedItemIds: ['item-1'],
        workflowType: 'content-import.third-party-import',
      },
      2,
      tx,
    )
    expect(appendEventWithDb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
        workflowAttemptId: retryAttempt.id,
      }),
      tx,
    )
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          archivedAt: null,
          currentAttemptFk: retryAttempt.id,
          failedItemCount: 0,
          progressDetail: null,
          skippedItemCount: 0,
          status: WorkflowJobStatusEnum.PENDING,
          successItemCount: 1,
        }),
      ]),
    )
  })

  it('completes an attempt and keeps the job pending when delayed retry remains', async () => {
    const attempt = createWorkflowAttempt()
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const nextRetryAt = new Date('2026-05-17T03:10:00.000Z')
    const delayedAttempt = createWorkflowAttempt({
      attemptId: 'attempt-2',
      attemptNo: 2,
      id: 11n,
      notBeforeAt: nextRetryAt,
      selectedItemCount: 1,
      status: WorkflowAttemptStatusEnum.PENDING,
      triggerType: WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
    })
    const { updateSets, tx } = createUpdateTx([
      [{ ...attempt, status: WorkflowAttemptStatusEnum.PARTIAL_FAILED }],
      [{ ...job, currentAttemptFk: delayedAttempt.id, status: WorkflowJobStatusEnum.PENDING }],
    ])
    const { service } = createService({ tx })
    const appendEventWithDb = jest.fn(async () => 1n)
    const releaseConflictKeys = jest.fn(async () => undefined)
    setServiceMethod(service, 'readAttemptWithDb', jest.fn(async () => attempt))
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'resolveNextAttemptNo', jest.fn(async () => 2))
    setServiceMethod(
      service,
      'createAttemptWithDb',
      jest.fn(async () => delayedAttempt),
    )
    setServiceMethod(service, 'appendEventWithDb', appendEventWithDb)
    setServiceMethod(service, 'releaseConflictKeys', releaseConflictKeys)

    const result = await service.completeAttemptWithDelayedRetry({
      delayedSelectedItemCount: 1,
      attemptCounters: {
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 0,
      },
      jobCounters: {
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      nextRetryAt,
      status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
      workflowAttemptId: attempt.id,
    } as never)

    expect(result).toEqual(
      expect.objectContaining({
        status: WorkflowJobStatusEnum.PENDING,
      }),
    )
    expect(releaseConflictKeys).not.toHaveBeenCalled()
    expect(
      (service as unknown as { createAttemptWithDb: jest.Mock }).createAttemptWithDb,
    ).toHaveBeenCalledWith(
      job,
      WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
      tx,
      2,
      1,
      nextRetryAt,
    )
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failedItemCount: 1,
          status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
          successItemCount: 0,
        }),
        expect.objectContaining({
          currentAttemptFk: delayedAttempt.id,
          failedItemCount: 1,
          finishedAt: null,
          progressDetail: null,
          skippedItemCount: 0,
          status: WorkflowJobStatusEnum.PENDING,
          successItemCount: 1,
        }),
      ]),
    )
    expect(appendEventWithDb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
        workflowAttemptId: delayedAttempt.id,
      }),
      tx,
    )
  })

  it('expires retained resources and releases conflict keys for failed jobs', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      status: WorkflowJobStatusEnum.PARTIAL_FAILED,
    })
    const updatedJob = {
      ...job,
      finishedAt: baseDate,
      status: WorkflowJobStatusEnum.EXPIRED,
    }
    const { tx, updateSets } = createUpdateTx([[updatedJob]])
    const { handler, service } = createService({ tx })
    const releaseConflictKeys = jest.fn(async () => undefined)
    const appendEventWithDb = jest.fn(async () => 1n)
    setServiceMethod(service, 'readJobWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'releaseConflictKeys', releaseConflictKeys)
    setServiceMethod(service, 'appendEventWithDb', appendEventWithDb)

    const result = await service.expireJob({ jobId: 'job-1' })

    expect(result).toEqual(
      expect.objectContaining({
        jobId: 'job-1',
        status: WorkflowJobStatusEnum.EXPIRED,
      }),
    )
    expect(handler.cleanupRetainedResources).toHaveBeenCalledWith('job-1')
    expect(releaseConflictKeys).toHaveBeenCalledWith(
      job.id,
      tx,
      expect.any(Date),
    )
    expect(appendEventWithDb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: WorkflowEventTypeEnum.CLEANUP_RECORDED,
        workflowAttemptId: 10n,
      }),
      tx,
    )
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          progressDetail: null,
          status: WorkflowJobStatusEnum.EXPIRED,
        }),
      ]),
    )
  })

  it('clears structured progress detail when completing an attempt', async () => {
    const attempt = createWorkflowAttempt()
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      progressDetail: {
        kind: 'content-import.image',
        imageIndex: 1,
        imageTotal: 2,
      },
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { tx, updateSets } = createUpdateTx([
      [{ ...attempt, status: WorkflowAttemptStatusEnum.SUCCESS }],
      [{ ...job, status: WorkflowJobStatusEnum.SUCCESS }],
    ])
    const { service } = createService({ tx })
    setServiceMethod(service, 'readAttemptWithDb', jest.fn(async () => attempt))
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'releaseConflictKeys', jest.fn(async () => undefined))
    setServiceMethod(service, 'appendEventWithDb', jest.fn(async () => 1n))

    await service.completeAttempt({
      attemptCounters: {
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 0,
      },
      jobCounters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 2,
      },
      status: WorkflowAttemptStatusEnum.SUCCESS,
      workflowAttemptId: attempt.id,
    } as never)

    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failedItemCount: 1,
          successItemCount: 0,
        }),
        expect.objectContaining({
          failedItemCount: 0,
          progressDetail: null,
          status: WorkflowJobStatusEnum.SUCCESS,
          successItemCount: 2,
        }),
      ]),
    )
  })

  it('archives terminal jobs without changing lifecycle status or cleanup state', async () => {
    const archivedAt = new Date('2026-05-18T03:00:00.000Z')
    const job = createWorkflowJob({
      status: WorkflowJobStatusEnum.EXPIRED,
    })
    const updatedJob = {
      ...job,
      archivedAt,
    }
    const { tx, updateSets } = createUpdateTx([[updatedJob]])
    const { handler, service } = createService({ tx })
    setServiceMethod(service, 'readJobWithDb', jest.fn(async () => job))

    const result = await service.archiveJob({ jobId: 'job-1' })

    expect(result).toEqual(
      expect.objectContaining({
        archivedAt,
        jobId: 'job-1',
        status: WorkflowJobStatusEnum.EXPIRED,
      }),
    )
    expect(handler.cleanupRetainedResources).not.toHaveBeenCalled()
  })

  it('archives terminal jobs idempotently', async () => {
    const archivedAt = new Date('2026-05-18T03:00:00.000Z')
    const job = createWorkflowJob({
      archivedAt,
      status: WorkflowJobStatusEnum.SUCCESS,
    })
    const { service, tx } = createService()
    setServiceMethod(service, 'readJobWithDb', jest.fn(async () => job))

    const result = await service.archiveJob({ jobId: 'job-1' })

    expect(result).toEqual(
      expect.objectContaining({
        archivedAt,
        jobId: 'job-1',
        status: WorkflowJobStatusEnum.SUCCESS,
      }),
    )
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('rejects archiving non-terminal jobs before mutating state', async () => {
    const { service, tx } = createService()
    setServiceMethod(
      service,
      'readJobWithDb',
      jest.fn(async () =>
        createWorkflowJob({ status: WorkflowJobStatusEnum.RUNNING }),
      ),
    )

    await expect(service.archiveJob({ jobId: 'job-1' })).rejects.toBeInstanceOf(
      BusinessException,
    )
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('uses carried job and attempt counters when a consumed attempt is cancelled', async () => {
    const attempt = createWorkflowAttempt({
      selectedItemCount: 3,
      status: WorkflowAttemptStatusEnum.PENDING,
    })
    const job = createWorkflowJob({ status: WorkflowJobStatusEnum.PENDING })
    const { handler, service } = createService()
    const completeAttempt = jest.fn(async () => undefined)
    handler.execute.mockRejectedValueOnce(
      new WorkflowCancellationError({
        attemptCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 0,
        },
        jobCounters: {
          failedItemCount: 0,
          skippedItemCount: 1,
          successItemCount: 2,
        },
      }),
    )
    setServiceMethod(
      service,
      'claimAttempt',
      jest.fn(async () => ({ attempt, job })),
    )
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'completeAttempt', completeAttempt)

    await (
      service as unknown as {
        consumeAttempt: (attemptId: bigint) => Promise<void>
      }
    ).consumeAttempt(attempt.id)

    expect(completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 0,
        },
        jobCounters: {
          failedItemCount: 0,
          skippedItemCount: 1,
          successItemCount: 2,
        },
        status: WorkflowAttemptStatusEnum.CANCELLED,
        workflowAttemptId: attempt.id,
      }),
    )
  })

  it('uses job projection plus attempt-local counters for implicit success', async () => {
    const attempt = createWorkflowAttempt({
      attemptNo: 2,
      selectedItemCount: 1,
      status: WorkflowAttemptStatusEnum.RUNNING,
    })
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      failedItemCount: 1,
      selectedItemCount: 2,
      status: WorkflowJobStatusEnum.RUNNING,
      successItemCount: 1,
    })
    const { service } = createService()
    const leaseKeeper = {
      assertHealthy: jest.fn(),
      stop: jest.fn(async () => undefined),
    }
    const completeAttempt = jest.fn(async () => undefined)
    setServiceMethod(
      service,
      'claimAttempt',
      jest.fn(async () => ({ attempt, job })),
    )
    setServiceMethod(service, 'startAttemptLeaseKeeper', jest.fn(() => leaseKeeper))
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))
    setServiceMethod(service, 'readAttempt', jest.fn(async () => attempt))
    setServiceMethod(
      service,
      'readJobByIdWithDb',
      jest.fn(async () => ({
        ...job,
        failedItemCount: 0,
        successItemCount: 1,
      })),
    )
    setServiceMethod(service, 'completeAttempt', completeAttempt)

    await (
      service as unknown as {
        consumeAttempt: (attemptId: bigint) => Promise<void>
      }
    ).consumeAttempt(attempt.id)

    expect(completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptCounters: {
          failedItemCount: 0,
          skippedItemCount: 0,
          successItemCount: 1,
        },
        jobCounters: {
          failedItemCount: 0,
          skippedItemCount: 0,
          successItemCount: 2,
        },
        status: WorkflowAttemptStatusEnum.SUCCESS,
      }),
    )
  })

  it('starts a runtime lease keeper while consuming a claimed attempt', async () => {
    const attempt = createWorkflowAttempt({
      selectedItemCount: 3,
      status: WorkflowAttemptStatusEnum.RUNNING,
    })
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      selectedItemCount: 3,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { handler, service } = createService()
    const leaseKeeper = {
      assertHealthy: jest.fn(),
      stop: jest.fn(async () => undefined),
    }
    const startAttemptLeaseKeeper = jest.fn(() => leaseKeeper)
    const completeAttempt = jest.fn(async () => undefined)
    setServiceMethod(
      service,
      'claimAttempt',
      jest.fn(async () => ({ attempt, job })),
    )
    setServiceMethod(service, 'startAttemptLeaseKeeper', startAttemptLeaseKeeper)
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))
    setServiceMethod(service, 'readAttempt', jest.fn(async () => attempt))
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'completeAttempt', completeAttempt)

    await (
      service as unknown as {
        consumeAttempt: (attemptId: bigint) => Promise<void>
      }
    ).consumeAttempt(attempt.id)

    expect(startAttemptLeaseKeeper).toHaveBeenCalledWith(job, attempt)
    expect(handler.execute).toHaveBeenCalled()
    expect(leaseKeeper.assertHealthy).toHaveBeenCalled()
    expect(leaseKeeper.stop).toHaveBeenCalled()
    expect(completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: WorkflowAttemptStatusEnum.SUCCESS,
        workflowAttemptId: attempt.id,
      }),
    )
  })

  it('skips implicit success completion when runtime lease ownership is lost', async () => {
    const attempt = createWorkflowAttempt({
      selectedItemCount: 3,
      status: WorkflowAttemptStatusEnum.RUNNING,
    })
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      selectedItemCount: 3,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { handler, service } = createService()
    const claimLost = new Error('工作流 attempt claim 已丢失')
    claimLost.name = 'WorkflowClaimLostError'
    const leaseKeeper = {
      assertHealthy: jest.fn(() => {
        throw claimLost
      }),
      stop: jest.fn(async () => undefined),
    }
    const completeAttempt = jest.fn(async () => undefined)
    setServiceMethod(
      service,
      'claimAttempt',
      jest.fn(async () => ({ attempt, job })),
    )
    setServiceMethod(service, 'startAttemptLeaseKeeper', jest.fn(() => leaseKeeper))
    setServiceMethod(service, 'readAttempt', jest.fn(async () => attempt))
    setServiceMethod(service, 'completeAttempt', completeAttempt)

    await (
      service as unknown as {
        consumeAttempt: (attemptId: bigint) => Promise<void>
      }
    ).consumeAttempt(attempt.id)

    expect(handler.execute).toHaveBeenCalled()
    expect(completeAttempt).not.toHaveBeenCalled()
    expect(leaseKeeper.stop).toHaveBeenCalled()
  })

  it('skips failure completion when runtime lease ownership is lost before a handler error', async () => {
    const attempt = createWorkflowAttempt({
      selectedItemCount: 3,
      status: WorkflowAttemptStatusEnum.RUNNING,
    })
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      selectedItemCount: 3,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { handler, service } = createService()
    const claimLost = new Error('工作流 attempt claim 已丢失')
    claimLost.name = 'WorkflowClaimLostError'
    const leaseKeeper = {
      assertHealthy: jest.fn(() => {
        throw claimLost
      }),
      stop: jest.fn(async () => undefined),
    }
    const completeAttempt = jest.fn(async () => undefined)
    handler.execute.mockRejectedValueOnce(new Error('provider exploded'))
    setServiceMethod(
      service,
      'claimAttempt',
      jest.fn(async () => ({ attempt, job })),
    )
    setServiceMethod(service, 'startAttemptLeaseKeeper', jest.fn(() => leaseKeeper))
    setServiceMethod(service, 'completeAttempt', completeAttempt)

    await (
      service as unknown as {
        consumeAttempt: (attemptId: bigint) => Promise<void>
      }
    ).consumeAttempt(attempt.id)

    expect(completeAttempt).not.toHaveBeenCalled()
    expect(leaseKeeper.stop).toHaveBeenCalled()
  })

  it('rejects explicit completion when the caller no longer owns the attempt', async () => {
    const attempt = createWorkflowAttempt()
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { service, tx } = createService()
    const completeAttempt = jest.fn(async () => undefined)
    setServiceMethod(service, 'readAttemptByAttemptId', jest.fn(async () => attempt))
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => false))
    setServiceMethod(service, 'completeAttempt', completeAttempt)

    await expect(
      service.completeAttemptByAttemptId({
        attemptId: attempt.attemptId,
        completionOwnerClaimedBy: 'stale-worker',
        attemptCounters: {
          failedItemCount: 0,
          skippedItemCount: 0,
          successItemCount: 2,
        },
        jobCounters: {
          failedItemCount: 0,
          skippedItemCount: 0,
          successItemCount: 2,
        },
        status: WorkflowAttemptStatusEnum.SUCCESS,
      } as never),
    ).resolves.toBeUndefined()

    expect(completeAttempt).not.toHaveBeenCalled()
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('rejects explicit delayed retry completion when the caller no longer owns the attempt', async () => {
    const attempt = createWorkflowAttempt()
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { service, tx } = createService()
    const completeAttemptWithDelayedRetry = jest.fn(async () => undefined)
    setServiceMethod(service, 'readAttemptByAttemptId', jest.fn(async () => attempt))
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => false))
    setServiceMethod(
      service,
      'completeAttemptWithDelayedRetry',
      completeAttemptWithDelayedRetry,
    )

    await expect(
      service.completeAttemptWithDelayedRetryByAttemptId({
        attemptId: attempt.attemptId,
        completionOwnerClaimedBy: 'stale-worker',
        delayedSelectedItemCount: 1,
        attemptCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 1,
        },
        jobCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 1,
        },
        nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
        status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
      } as never),
    ).resolves.toBeUndefined()

    expect(completeAttemptWithDelayedRetry).not.toHaveBeenCalled()
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('skips terminal writes when explicit completion loses ownership at the final update gate', async () => {
    const attempt = createWorkflowAttempt()
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { tx, updateTargets } = createUpdateTx([[]])
    const { service } = createService({ tx })
    const appendEventWithDb = jest.fn(async () => 1n)
    const releaseConflictKeys = jest.fn(async () => undefined)
    setServiceMethod(service, 'readAttemptByAttemptId', jest.fn(async () => attempt))
    setServiceMethod(service, 'readAttemptWithDb', jest.fn(async () => attempt))
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))
    setServiceMethod(service, 'appendEventWithDb', appendEventWithDb)
    setServiceMethod(service, 'releaseConflictKeys', releaseConflictKeys)

    await expect(
      service.completeAttemptByAttemptId({
        attemptId: attempt.attemptId,
        completionOwnerClaimedBy: 'worker-1',
        attemptCounters: {
          failedItemCount: 0,
          skippedItemCount: 0,
          successItemCount: 2,
        },
        jobCounters: {
          failedItemCount: 0,
          skippedItemCount: 0,
          successItemCount: 2,
        },
        status: WorkflowAttemptStatusEnum.SUCCESS,
      } as never),
    ).resolves.toBeUndefined()

    expect(updateTargets).toEqual([createWorkflowSchema().workflowAttempt])
    expect(appendEventWithDb).not.toHaveBeenCalled()
    expect(releaseConflictKeys).not.toHaveBeenCalled()
  })

  it('skips delayed retry creation when explicit delayed completion loses ownership at the final update gate', async () => {
    const attempt = createWorkflowAttempt()
    const job = createWorkflowJob({
      currentAttemptFk: attempt.id,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const { tx, updateTargets } = createUpdateTx([[]])
    const { service } = createService({ tx })
    const appendEventWithDb = jest.fn(async () => 1n)
    const createAttemptWithDb = jest.fn()
    setServiceMethod(service, 'readAttemptByAttemptId', jest.fn(async () => attempt))
    setServiceMethod(service, 'readAttemptWithDb', jest.fn(async () => attempt))
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(service, 'tryAssertAttemptStillOwned', jest.fn(async () => true))
    setServiceMethod(service, 'appendEventWithDb', appendEventWithDb)
    setServiceMethod(service, 'createAttemptWithDb', createAttemptWithDb)

    await expect(
      service.completeAttemptWithDelayedRetryByAttemptId({
        attemptId: attempt.attemptId,
        completionOwnerClaimedBy: 'worker-1',
        delayedSelectedItemCount: 1,
        attemptCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 1,
        },
        jobCounters: {
          failedItemCount: 1,
          skippedItemCount: 0,
          successItemCount: 1,
        },
        nextRetryAt: new Date('2026-05-17T03:10:00.000Z'),
        status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
      } as never),
    ).resolves.toBeUndefined()

    expect(updateTargets).toEqual([createWorkflowSchema().workflowAttempt])
    expect(createAttemptWithDb).not.toHaveBeenCalled()
    expect(appendEventWithDb).not.toHaveBeenCalled()
  })

  it('worker pass expires drafts, recovers expired attempts, and consumes pending attempts', async () => {
    const draftJob = createWorkflowJob({
      expiresAt: new Date('2026-05-17T02:00:00.000Z'),
      status: WorkflowJobStatusEnum.DRAFT,
    })
    const expiredAttempt = createWorkflowAttempt({
      claimExpiresAt: new Date('2026-05-17T02:00:00.000Z'),
      status: WorkflowAttemptStatusEnum.RUNNING,
    })
    const pendingAttempt = createWorkflowAttempt({
      id: 11n,
      status: WorkflowAttemptStatusEnum.PENDING,
    })
    const db = createSelectDb([[draftJob], [expiredAttempt], [pendingAttempt]])
    const { service } = createService({ db })
    const expireDraftJob = jest.fn(async () => undefined)
    const recoverExpiredRunningAttempt = jest.fn(async () => undefined)
    const consumeAttempt = jest.fn(async () => undefined)
    setServiceMethod(service, 'expireDraftJob', expireDraftJob)
    setServiceMethod(
      service,
      'recoverExpiredRunningAttempt',
      recoverExpiredRunningAttempt,
    )
    setServiceMethod(service, 'consumeAttempt', consumeAttempt)

    await service.consumePendingAttempts()

    expect(expireDraftJob).toHaveBeenCalledWith(draftJob)
    expect(recoverExpiredRunningAttempt).toHaveBeenCalledWith(expiredAttempt.id)
    expect(consumeAttempt).toHaveBeenCalledWith(pendingAttempt.id)
  })

  it('worker pass does not consume attempts before notBeforeAt is due', async () => {
    const draftJob = createWorkflowJob({
      expiresAt: new Date('2026-05-17T02:00:00.000Z'),
      status: WorkflowJobStatusEnum.DRAFT,
    })
    const expiredAttempt = createWorkflowAttempt({
      claimExpiresAt: new Date('2026-05-17T02:00:00.000Z'),
      status: WorkflowAttemptStatusEnum.RUNNING,
    })
    const futureAttempt = createWorkflowAttempt({
      id: 12n,
      notBeforeAt: new Date(Date.now() + 60_000),
      status: WorkflowAttemptStatusEnum.PENDING,
    })
    const db = createSelectDb([[draftJob], [expiredAttempt], [futureAttempt]])
    const { service } = createService({ db })
    const expireDraftJob = jest.fn(async () => undefined)
    const recoverExpiredRunningAttempt = jest.fn(async () => undefined)
    const consumeAttempt = jest.fn(async () => undefined)
    setServiceMethod(service, 'expireDraftJob', expireDraftJob)
    setServiceMethod(
      service,
      'recoverExpiredRunningAttempt',
      recoverExpiredRunningAttempt,
    )
    setServiceMethod(service, 'consumeAttempt', consumeAttempt)

    await service.consumePendingAttempts()

    expect(consumeAttempt).not.toHaveBeenCalled()
  })

  it('creates a system recovery attempt when a running claim expires with recoverable items', async () => {
    const expiredAttempt = createWorkflowAttempt()
    const job = createWorkflowJob({
      currentAttemptFk: expiredAttempt.id,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const recoveryAttempt = createWorkflowAttempt({
      attemptId: 'attempt-2',
      attemptNo: 2,
      id: 11n,
      selectedItemCount: 1,
      status: WorkflowAttemptStatusEnum.PENDING,
      triggerType: WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
    })
    const { updateSets, tx } = createUpdateTx([
      [expiredAttempt],
      [{ ...job, currentAttemptFk: recoveryAttempt.id }],
    ])
    const { handler, service } = createService({ tx })
    const appendEventWithDb = jest.fn(async () => 1n)
    setServiceMethod(
      service,
      'readAttemptWithDb',
      jest.fn(async () => expiredAttempt),
    )
    setServiceMethod(service, 'readJobByIdWithDb', jest.fn(async () => job))
    setServiceMethod(
      service,
      'readJobConflictKeys',
      jest.fn(async () => ['source-scope:copy:comic:default']),
    )
    setServiceMethod(service, 'resolveNextAttemptNo', jest.fn(async () => 2))
    setServiceMethod(
      service,
      'createAttemptWithDb',
      jest.fn(async () => recoveryAttempt),
    )
    setServiceMethod(service, 'appendEventWithDb', appendEventWithDb)

    await (
      service as unknown as {
        recoverExpiredRunningAttempt: (attemptId: bigint) => Promise<void>
      }
    ).recoverExpiredRunningAttempt(expiredAttempt.id)

    expect(handler.recoverExpiredAttempt).toHaveBeenCalledWith(
      {
        conflictKeys: ['source-scope:copy:comic:default'],
        expiredAttemptNo: 1,
        jobId: 'job-1',
        workflowType: 'content-import.third-party-import',
      },
      2,
      tx,
    )
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          errorCode: 'ATTEMPT_LEASE_EXPIRED',
          status: WorkflowAttemptStatusEnum.FAILED,
        }),
        expect.objectContaining({
          currentAttemptFk: recoveryAttempt.id,
          progressDetail: null,
          status: WorkflowJobStatusEnum.PENDING,
        }),
      ]),
    )
    expect(appendEventWithDb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
        workflowAttemptId: recoveryAttempt.id,
      }),
      tx,
    )
  })
})

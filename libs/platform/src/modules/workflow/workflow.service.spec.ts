import { BusinessException } from '@libs/platform/exceptions'
import {
  WorkflowAttemptStatusEnum,
  WorkflowAttemptTriggerTypeEnum,
  WorkflowEventTypeEnum,
  WorkflowJobStatusEnum,
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

  function createUpdateTx(returningRows: unknown[][] = []) {
    const updateSets: Record<string, unknown>[] = []
    const update = jest.fn(() => ({
      set: jest.fn((value: Record<string, unknown>) => {
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
        failedItemCount: 1,
        recoverableItemCount: 1,
        selectedItemCount: 2,
        skippedItemCount: 0,
        successItemCount: 0,
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
    const job = createWorkflowJob()
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
      }),
    )
    expect(result).not.toHaveProperty('events')
    expect(db.select).toHaveBeenCalledTimes(1)
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

  it('does not expose a transaction-only draft path that skips creation events', () => {
    const { service } = createService()

    expect('createDraftInTransaction' in service).toBe(false)
  })

  it('builds execution contexts with explicit lease renewal separate from progress', async () => {
    const job = createWorkflowJob({
      currentAttemptFk: 10n,
      status: WorkflowJobStatusEnum.RUNNING,
    })
    const attempt = createWorkflowAttempt({
      claimExpiresAt: new Date(Date.now() + 60_000),
    })
    const { service } = createService()
    const renewLeaseForAttempt = jest.fn(async () => undefined)
    setServiceMethod(service, 'renewLeaseForAttempt', renewLeaseForAttempt)

    const context = (
      service as unknown as {
        buildExecutionContext: (
          job: ReturnType<typeof createWorkflowJob>,
          attempt: ReturnType<typeof createWorkflowAttempt>,
        ) => { renewLease: () => Promise<void> }
      }
    ).buildExecutionContext(job, attempt)

    expect(context.renewLease).toEqual(expect.any(Function))
    await context.renewLease()
    expect(renewLeaseForAttempt).toHaveBeenCalledWith(job, attempt)
  })

  it('updates progress and renews the lease without appending progress events', async () => {
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
    setServiceMethod(service, 'appendEvent', appendEvent)

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
          claimExpiresAt: expect.any(Date),
          heartbeatAt: expect.any(Date),
        }),
        expect.objectContaining({
          progressMessage: '下载第 43 话图片 1/100',
          progressPercent: 10,
        }),
      ]),
    )
    expect(appendEvent).not.toHaveBeenCalled()
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
    const { tx } = createUpdateTx([[updatedJob]])
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
  })

  it('retries failed jobs by reusing conflict keys and creating a retry attempt', async () => {
    const job = createWorkflowJob({ status: WorkflowJobStatusEnum.FAILED })
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
    const { tx } = createUpdateTx([[updatedJob]])
    const { handler, service } = createService({ tx })
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
      failedItemCount: 1,
      nextRetryAt,
      skippedItemCount: 0,
      status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
      successItemCount: 1,
      workflowAttemptId: attempt.id,
    })

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
          status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
        }),
        expect.objectContaining({
          currentAttemptFk: delayedAttempt.id,
          finishedAt: null,
          status: WorkflowJobStatusEnum.PENDING,
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
    const { tx } = createUpdateTx([[updatedJob]])
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

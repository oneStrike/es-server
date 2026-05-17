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

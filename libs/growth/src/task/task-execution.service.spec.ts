/// <reference types="jest" />

jest.mock('node:crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('abcdef', 'hex')),
  randomUUID: jest.fn(() => 'task-reward-claim-token'),
}))

import * as schema from '@db/schema'
import { randomUUID } from 'node:crypto'
import { GrowthRewardSettlementStatusEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { TaskDefinitionService } from './task-definition.service'
import { TaskExecutionService } from './task-execution.service'
import {
  TaskClaimModeEnum,
  TaskDefinitionStatusEnum,
  TaskInstanceStatusEnum,
  TaskRepeatCycleEnum,
  TaskStepTriggerModeEnum,
  TaskTypeEnum,
} from './task.constant'

const randomUUIDMock = randomUUID as unknown as jest.Mock<string, []>

function createThenableBuilder<TResult>(
  result: TResult,
  recorder: Record<string, ReturnType<typeof jest.fn>> = {},
) {
  const builder: Record<string, ReturnType<typeof jest.fn>> & {
    then: Promise<TResult>['then']
    catch: Promise<TResult>['catch']
    finally: Promise<TResult>['finally']
  } = {
    from: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    leftJoin: jest.fn(() => builder),
    where: jest.fn(() => builder),
    groupBy: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    offset: jest.fn(() => Promise.resolve(result)),
    set: jest.fn(() => builder),
    returning: jest.fn(() => Promise.resolve(result)),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    catch: Promise.resolve(result).catch.bind(Promise.resolve(result)),
    finally: Promise.resolve(result).finally.bind(Promise.resolve(result)),
  }

  Object.assign(recorder, builder)
  return builder
}

function objectContainsReference(
  value: unknown,
  target: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (value === target) {
    return true
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  if (seen.has(value)) {
    return false
  }

  seen.add(value)
  return Object.values(value as Record<string, unknown>).some((item) =>
    objectContainsReference(item, target, seen),
  )
}

function createExecutionService() {
  const tx = {
    insert: jest.fn(() => createThenableBuilder([])),
    update: jest.fn(() => createThenableBuilder([])),
    select: jest.fn(() => createThenableBuilder([])),
    execute: jest.fn(),
    query: {},
  }
  const db = {
    insert: jest.fn(() => createThenableBuilder([])),
    update: jest.fn(() => createThenableBuilder([])),
    select: jest.fn(() => createThenableBuilder([])),
    execute: jest.fn(),
    query: {},
  }
  const drizzle = {
    schema,
    db,
    buildPage: jest.fn(() => ({
      pageIndex: 1,
      pageSize: 20,
      limit: 20,
      offset: 0,
    })),
    withTransaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      callback(tx),
    ),
  }
  const registry = {
    resolveUniqueDimensionValue: jest.fn(),
  }
  const reward = {
    tryRewardTaskComplete: jest.fn(),
  }
  const publisher = {
    publishInTx: jest.fn(),
  }
  const notification = {
    createAutoAssignedReminderEvent: jest.fn(() => ({
      eventKey: 'task.reminder.auto_assigned',
    })),
    createRewardGrantedReminderEvent: jest.fn(() => ({
      eventKey: 'task.reminder.reward_granted',
    })),
    buildAutoAssignedReminderBizKey: jest.fn(
      (instanceId: number) => `task:auto:${instanceId}`,
    ),
    buildRewardGrantedReminderBizKey: jest.fn(
      (instanceId: number) => `task:reward:${instanceId}`,
    ),
  }

  const service = new (TaskExecutionService as any)(
    drizzle,
    registry,
    reward,
    publisher,
    notification,
  ) as TaskExecutionService

  return { service, drizzle, tx, db, registry, reward, publisher, notification }
}

function createManualTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'TASK_1',
    title: 'Manual task',
    sceneType: TaskTypeEnum.DAILY,
    status: TaskDefinitionStatusEnum.ACTIVE,
    claimMode: TaskClaimModeEnum.MANUAL,
    repeatType: TaskRepeatCycleEnum.ONCE,
    rewardItems: null,
    startAt: null,
    endAt: null,
    ...overrides,
  } as any
}

function createStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    taskId: 1,
    stepNo: 1,
    title: 'Step',
    triggerMode: TaskStepTriggerModeEnum.MANUAL,
    targetValue: 3,
    templateKey: null,
    eventCode: null,
    filterPayload: null,
    dedupeScope: null,
    ...overrides,
  } as any
}

function createInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    taskId: 1,
    userId: 202,
    cycleKey: 'once',
    status: TaskInstanceStatusEnum.PENDING,
    rewardApplicable: 0,
    snapshotPayload: {
      taskId: 1,
      code: 'TASK_1',
      title: 'Manual task',
      sceneType: TaskTypeEnum.DAILY,
      rewardItems: null,
    },
    completedAt: null,
    expiredAt: null,
    ...overrides,
  } as any
}

describe('TaskExecutionService review regressions', () => {
  it('event candidate scan only includes AUTO + EVENT task definitions', async () => {
    const { service, db } = createExecutionService()
    const selectRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    ;(db as any).select = jest.fn(() =>
      createThenableBuilder([], selectRecorder),
    )

    await (service as any).listCandidateEventSteps(
      100,
      new Date('2026-06-08T00:00:00.000Z'),
    )

    const whereCondition = selectRecorder.where.mock.calls[0]?.[0]
    expect(
      objectContainsReference(whereCondition, schema.taskDefinition.claimMode),
    ).toBe(true)
    expect(objectContainsReference(whereCondition, TaskClaimModeEnum.AUTO)).toBe(
      true,
    )
  })

  it('claimTask creates instance step immediately in the claim transaction', async () => {
    const { service, tx } = createExecutionService()
    const task = createManualTask()
    const step = createStep()
    const instance = createInstance()
    const instanceStep = { id: 303, instanceId: instance.id, stepId: step.id }

    jest
      .spyOn(service as any, 'getAvailableTaskDefinitionOrThrow')
      .mockResolvedValue(task)
    jest
      .spyOn(service as any, 'getSingleTaskStepOrThrow')
      .mockResolvedValue(step)
    jest.spyOn(service as any, 'findTaskInstance').mockResolvedValue(null)
    jest
      .spyOn(service as any, 'createOrGetTaskInstance')
      .mockResolvedValue({ instance, created: true })
    const createStepSpy = jest
      .spyOn(service as any, 'createOrGetTaskInstanceStep')
      .mockResolvedValue({ instanceStep, created: true })
    const writeLogSpy = jest
      .spyOn(service as any, 'writeTaskEventLog')
      .mockResolvedValue(undefined)

    await service.claimTask({ id: task.id }, instance.userId)

    expect(createStepSpy).toHaveBeenCalledWith(tx, instance.id, step)
    expect(writeLogSpy).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        instanceId: instance.id,
        actionType: expect.any(Number),
      }),
    )
  })

  it('reportProgress delegates progress mutation to the database-winner helper', async () => {
    const { service, tx } = createExecutionService()
    const task = createManualTask()
    const step = createStep()
    const instance = createInstance({
      status: TaskInstanceStatusEnum.IN_PROGRESS,
    })
    const instanceStep = {
      id: 303,
      instanceId: instance.id,
      stepId: step.id,
      status: TaskInstanceStatusEnum.IN_PROGRESS,
      currentValue: 0,
      targetValue: 3,
    }

    jest
      .spyOn(service as any, 'getAvailableTaskDefinitionOrThrow')
      .mockResolvedValue(task)
    jest
      .spyOn(service as any, 'getSingleTaskStepOrThrow')
      .mockResolvedValue(step)
    jest.spyOn(service as any, 'findTaskInstance').mockResolvedValue(instance)
    jest
      .spyOn(service as any, 'createOrGetTaskInstanceStep')
      .mockResolvedValue({ instanceStep, created: false })
    const progressSpy = jest
      .spyOn(service as any, 'applyTaskInstanceProgressInTx')
      .mockResolvedValue({
        instanceId: instance.id,
        instanceStepId: instanceStep.id,
        beforeValue: 0,
        afterValue: 2,
        appliedDelta: 2,
        status: TaskInstanceStatusEnum.IN_PROGRESS,
        completed: false,
      })
    jest.spyOn(service as any, 'writeTaskEventLog').mockResolvedValue(undefined)

    await service.reportProgress({ id: task.id, delta: 2 }, instance.userId)

    expect(progressSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        runner: tx,
        instance,
        instanceStep,
        delta: 2,
      }),
    )
  })

  it('getTaskInstancePage applies sceneType to both list and total queries', async () => {
    const { service, db } = createExecutionService()
    const listBuilder = createThenableBuilder([])
    const totalBuilder = createThenableBuilder([{ count: 0 }])
    db.select = jest
      .fn()
      .mockReturnValueOnce(listBuilder)
      .mockReturnValueOnce(totalBuilder)
    jest
      .spyOn(service as any, 'getTaskStepSummaryMap')
      .mockResolvedValue(new Map())
    jest
      .spyOn(service as any, 'getTaskInstanceStepViewMap')
      .mockResolvedValue(new Map())

    await service.getTaskInstancePage({ sceneType: TaskTypeEnum.DAILY })

    expect(listBuilder.leftJoin).toHaveBeenCalledWith(
      schema.taskDefinition,
      expect.anything(),
    )
    expect(totalBuilder.leftJoin).toHaveBeenCalledWith(
      schema.taskDefinition,
      expect.anything(),
    )
  })

  it('applyEventToTaskStep publishes auto-assigned reminder when an AUTO task instance is created', async () => {
    const { service, tx } = createExecutionService()
    const task = createManualTask({
      claimMode: TaskClaimModeEnum.AUTO,
      rewardItems: null,
    })
    const step = createStep({
      triggerMode: TaskStepTriggerModeEnum.EVENT,
      targetValue: 2,
    })
    const instance = createInstance({
      status: TaskInstanceStatusEnum.PENDING,
      rewardApplicable: 0,
    })
    const instanceStep = {
      id: 303,
      instanceId: instance.id,
      stepId: step.id,
      currentValue: 0,
      targetValue: step.targetValue,
    }
    const occurredAt = new Date('2026-05-06T00:00:00.000Z')

    jest.spyOn(service as any, 'findTaskInstance').mockResolvedValue(null)
    jest
      .spyOn(service as any, 'createOrGetTaskInstance')
      .mockResolvedValue({ instance, created: true })
    jest
      .spyOn(service as any, 'createOrGetTaskInstanceStep')
      .mockResolvedValue({ instanceStep, created: true })
    jest
      .spyOn(service as any, 'applyTaskInstanceProgressInTx')
      .mockResolvedValue({
        instanceId: instance.id,
        instanceStepId: instanceStep.id,
        beforeValue: 0,
        afterValue: 1,
        appliedDelta: 1,
        status: TaskInstanceStatusEnum.IN_PROGRESS,
        completed: false,
      })
    const publishSpy = jest
      .spyOn(service as any, 'publishAutoAssignedReminderInTx')
      .mockResolvedValue(undefined)
    jest.spyOn(service as any, 'writeTaskEventLog').mockResolvedValue(undefined)

    await (service as any).applyEventToTaskStep({
      task,
      step,
      userId: instance.userId,
      eventBizKey: 'event-1',
      eventCode: 1001,
      targetType: 'post',
      targetId: 88,
      occurredAt,
      context: {},
    })

    expect(publishSpy).toHaveBeenCalledWith(tx, task, instance, occurredAt)
  })

  it('settleTaskInstanceReward publishes reward-granted reminder only for the first successful settlement update', async () => {
    const { service, reward, tx } = createExecutionService()
    const settlement = { id: 909 }
    jest
      .spyOn(service as any, 'ensureTaskRewardSettlementLink')
      .mockResolvedValue(settlement)
    jest
      .spyOn(service as any, 'claimTaskRewardSettlementExecution')
      .mockResolvedValue({ token: 'task-reward-claim-token' })
    reward.tryRewardTaskComplete.mockResolvedValue({
      success: true,
      resultType: 1,
      settledAt: new Date('2026-05-06T00:00:00.000Z'),
      ledgerRecordIds: [7001],
    })
    const publishSpy = jest
      .spyOn(service as any, 'publishRewardGrantedReminderInTx')
      .mockResolvedValue(undefined)
    jest
      .spyOn(service as any, 'updateRewardSettlementResultInTx')
      .mockResolvedValue({ updated: true })

    await (service as any).settleTaskInstanceReward({
      taskId: 1,
      instanceId: 101,
      userId: 202,
      rewardItems: [{ assetType: 1, amount: 10 }],
      occurredAt: new Date('2026-05-06T00:00:00.000Z'),
    })

    expect(publishSpy).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        taskId: 1,
        instanceId: 101,
        userId: 202,
        ledgerRecordIds: [7001],
      }),
    )
  })

  it('settleTaskInstanceReward suppresses reward-granted reminders for stale settlement claims', async () => {
    const { service, reward } = createExecutionService()
    jest
      .spyOn(service as any, 'ensureTaskRewardSettlementLink')
      .mockResolvedValue({ id: 909 })
    jest
      .spyOn(service as any, 'claimTaskRewardSettlementExecution')
      .mockResolvedValue({ token: 'stale-token' })
    reward.tryRewardTaskComplete.mockResolvedValue({
      success: true,
      resultType: 1,
      settledAt: new Date('2026-05-06T00:00:00.000Z'),
      ledgerRecordIds: [7001],
    })
    const updateSpy = jest
      .spyOn(service as any, 'updateRewardSettlementResultInTx')
      .mockResolvedValue({ updated: false })
    const publishSpy = jest
      .spyOn(service as any, 'publishRewardGrantedReminderInTx')
      .mockResolvedValue(undefined)

    await (service as any).settleTaskInstanceReward({
      taskId: 1,
      instanceId: 101,
      userId: 202,
      rewardItems: [{ assetType: 1, amount: 10 }],
      occurredAt: new Date('2026-05-06T00:00:00.000Z'),
      isRetry: true,
    })

    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      909,
      'stale-token',
      expect.objectContaining({ success: true }),
    )
    expect(publishSpy).not.toHaveBeenCalled()
  })

  it('retryTaskInstanceReward rejects already-successful task reward settlements', async () => {
    const { service, db } = createExecutionService()
    db.query = {
      taskInstance: {
        findFirst: jest.fn().mockResolvedValue(
          createInstance({
            status: TaskInstanceStatusEnum.COMPLETED,
            rewardApplicable: 1,
            rewardSettlement: {
              id: 909,
              settlementStatus: 1,
            },
          }),
        ),
      },
    } as any
    const settleSpy = jest.spyOn(service as any, 'settleTaskInstanceReward')

    await expect(service.retryTaskInstanceReward(101)).rejects.toThrow(
      '任务奖励已结算成功，无需重试',
    )
    expect(settleSpy).not.toHaveBeenCalled()
  })

  it('retryTaskInstanceReward rejects terminal task reward settlements', async () => {
    const { service, db } = createExecutionService()
    db.query = {
      taskInstance: {
        findFirst: jest.fn().mockResolvedValue(
          createInstance({
            status: TaskInstanceStatusEnum.COMPLETED,
            rewardApplicable: 1,
            rewardSettlement: {
              id: 909,
              settlementStatus: 2,
            },
          }),
        ),
      },
    } as any
    const settleSpy = jest.spyOn(service as any, 'settleTaskInstanceReward')

    await expect(service.retryTaskInstanceReward(101)).rejects.toThrow(
      '任务奖励已进入终态失败，无需重试',
    )
    expect(settleSpy).not.toHaveBeenCalled()
  })

  it('retryTaskInstanceReward marks settlement execution as a retry attempt', async () => {
    const { service, db } = createExecutionService()
    db.query = {
      taskInstance: {
        findFirst: jest.fn().mockResolvedValue(
          createInstance({
            status: TaskInstanceStatusEnum.COMPLETED,
            rewardApplicable: 1,
            completedAt: new Date('2026-05-06T00:00:00.000Z'),
            rewardSettlement: {
              id: 909,
              settlementStatus: 0,
            },
          }),
        ),
      },
    } as any
    jest
      .spyOn(service as any, 'getTaskDefinitionForRewardOrThrow')
      .mockResolvedValue(
        createManualTask({
          rewardItems: [{ assetType: 1, amount: 10 }],
        }),
      )
    const settleSpy = jest
      .spyOn(service as any, 'settleTaskInstanceReward')
      .mockResolvedValue(undefined)
    jest.spyOn(service as any, 'getTaskRewardRetryResult').mockResolvedValue({
      instanceId: 101,
      rewardSettlementId: 909,
      settlementStatus: 1,
      succeeded: true,
      message: '任务奖励已补偿成功',
    })

    await service.retryTaskInstanceReward(101)

    expect(settleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 101,
        isRetry: true,
      }),
    )
  })

  it('settleTaskInstanceReward persists retry metadata before retry side effects', async () => {
    const { service, db, reward } = createExecutionService()
    const updateRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    ;(db as any).update = jest.fn(() =>
      createThenableBuilder(
        [{ id: 909, token: 'task-reward-claim-token' }],
        updateRecorder,
      ),
    )
    jest
      .spyOn(service as any, 'ensureTaskRewardSettlementLink')
      .mockResolvedValue({ id: 909 })
    reward.tryRewardTaskComplete.mockResolvedValue({
      success: false,
      resultType: 0,
      settledAt: new Date('2026-05-06T00:01:00.000Z'),
      ledgerRecordIds: [],
      errorMessage: 'reward service unavailable',
      rewardResults: [],
    })

    await (service as any).settleTaskInstanceReward({
      taskId: 1,
      instanceId: 101,
      userId: 202,
      rewardItems: [{ assetType: 1, amount: 10 }],
      occurredAt: new Date('2026-05-06T00:00:00.000Z'),
      isRetry: true,
    })

    const updatePayload = updateRecorder.set.mock.calls[0]?.[0]
    expect(updatePayload.retryCount).toBeDefined()
    expect(updatePayload.lastRetryAt).toBeInstanceOf(Date)
  })

  it('settleTaskInstanceReward stops before reward side effects when settlement claim misses', async () => {
    const { service, reward, tx, publisher } = createExecutionService()
    jest
      .spyOn(service as any, 'ensureTaskRewardSettlementLink')
      .mockResolvedValue({ id: 909 })
    jest
      .spyOn(service as any, 'claimTaskRewardSettlementExecution')
      .mockRejectedValue(
        new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '任务奖励结算事实已成功、终态或正在执行，不能重复执行',
        ),
      )

    await expect(
      (service as any).settleTaskInstanceReward({
        taskId: 1,
        instanceId: 101,
        userId: 202,
        rewardItems: [{ assetType: 1, amount: 10 }],
        occurredAt: new Date('2026-05-06T00:00:00.000Z'),
        isRetry: true,
      }),
    ).rejects.toThrow('任务奖励结算事实已成功、终态或正在执行，不能重复执行')

    expect(reward.tryRewardTaskComplete).not.toHaveBeenCalled()
    expect(tx.update).not.toHaveBeenCalled()
    expect(publisher.publishInTx).not.toHaveBeenCalled()
  })

  it('settleTaskInstanceReward allows only one active claim to reach reward side effects', async () => {
    const { service, db, reward, tx } = createExecutionService()
    jest
      .spyOn(service as any, 'ensureTaskRewardSettlementLink')
      .mockResolvedValue({ id: 909 })
    ;(db as any).update = jest
      .fn()
      .mockReturnValueOnce(
        createThenableBuilder([
          { id: 909, token: 'task-reward-claim-token' },
        ]),
      )
      .mockReturnValueOnce(createThenableBuilder([]))
    ;(tx as any).update = jest.fn(() =>
      createThenableBuilder([{ id: 909 }]),
    )

    const rewardResult = {
      success: true,
      resultType: 1,
      source: 'task_bonus',
      bizKey: 'task:complete:1:instance:101:user:202',
      dedupeResult: 'applied',
      settledAt: new Date('2026-05-06T00:01:00.000Z'),
      ledgerRecordIds: [7001],
      rewardResults: [],
    }
    let resolveReward!: (value: typeof rewardResult) => void
    reward.tryRewardTaskComplete.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReward = resolve
        }),
    )

    const input = {
      taskId: 1,
      instanceId: 101,
      userId: 202,
      rewardItems: [{ assetType: 1, amount: 10 }],
      occurredAt: new Date('2026-05-06T00:00:00.000Z'),
      isRetry: true,
    }
    const first = (service as any).settleTaskInstanceReward(input)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(reward.tryRewardTaskComplete).toHaveBeenCalledTimes(1)

    await expect(
      (service as any).settleTaskInstanceReward(input),
    ).rejects.toThrow('任务奖励结算事实已成功、终态或正在执行，不能重复执行')
    resolveReward(rewardResult)
    await expect(first).resolves.toBeUndefined()

    expect(reward.tryRewardTaskComplete).toHaveBeenCalledTimes(1)
  })

  it('settlement execution claim leases the row and result update requires the claim token', async () => {
    const { service, db, tx } = createExecutionService()
    const claimRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    const resultRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    ;(db as any).update = jest.fn(() =>
      createThenableBuilder(
        [{ id: 909, token: 'task-reward-claim-token' }],
        claimRecorder,
      ),
    )
    ;(tx as any).update = jest.fn(() =>
      createThenableBuilder([{ id: 909 }], resultRecorder),
    )

    const claim = await (service as any).claimTaskRewardSettlementExecution(
      909,
      true,
    )
    await (service as any).updateRewardSettlementResultInTx(
      tx,
      909,
      claim.token,
      {
        success: true,
        resultType: 1,
        source: 'task_bonus',
        bizKey: 'task:complete:1:instance:101:user:202',
        dedupeResult: 'applied',
        settledAt: new Date('2026-05-06T00:01:00.000Z'),
        ledgerRecordIds: [7001],
        rewardResults: [],
      },
    )

    const claimPayload = claimRecorder.set.mock.calls[0]?.[0]
    const resultPayload = resultRecorder.set.mock.calls[0]?.[0]
    const claimWhere = claimRecorder.where.mock.calls[0]?.[0]
    const resultWhere = resultRecorder.where.mock.calls[0]?.[0]
    expect(claim.token).toBe('task-reward-claim-token')
    expect(claimPayload.processingToken).toBe('task-reward-claim-token')
    expect(claimPayload.processingStartedAt).toBeInstanceOf(Date)
    expect(resultPayload.processingToken).toBeNull()
    expect(resultPayload.processingStartedAt).toBeNull()
    expect(
      objectContainsReference(
        claimWhere,
        GrowthRewardSettlementStatusEnum.TERMINAL,
      ),
    ).toBe(true)
    expect(
      objectContainsReference(
        resultWhere,
        GrowthRewardSettlementStatusEnum.TERMINAL,
      ),
    ).toBe(true)
    expect(objectContainsReference(resultWhere, 'task-reward-claim-token')).toBe(
      true,
    )
  })

  it('expired settlement lease takeover leaves stale claim results unable to overwrite', async () => {
    const { service, db, tx } = createExecutionService()
    const firstClaimRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    const secondClaimRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    const staleResultRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    randomUUIDMock
      .mockReturnValueOnce('stale-token')
      .mockReturnValueOnce('fresh-token')
      .mockReturnValue('task-reward-claim-token')
    ;(db as any).update = jest
      .fn()
      .mockReturnValueOnce(
        createThenableBuilder(
          [{ id: 909, token: 'stale-token' }],
          firstClaimRecorder,
        ),
      )
      .mockReturnValueOnce(
        createThenableBuilder(
          [{ id: 909, token: 'fresh-token' }],
          secondClaimRecorder,
        ),
      )
    ;(tx as any).update = jest.fn(() =>
      createThenableBuilder([], staleResultRecorder),
    )

    const staleClaim = await (service as any).claimTaskRewardSettlementExecution(
      909,
      false,
    )
    const freshClaim = await (service as any).claimTaskRewardSettlementExecution(
      909,
      true,
    )
    const staleUpdate = await (service as any).updateRewardSettlementResultInTx(
      tx,
      909,
      staleClaim.token,
      {
        success: true,
        resultType: 1,
        source: 'task_bonus',
        bizKey: 'task:complete:1:instance:101:user:202',
        dedupeResult: 'applied',
        settledAt: new Date('2026-05-06T00:01:00.000Z'),
        ledgerRecordIds: [7001],
        rewardResults: [],
      },
    )

    const secondClaimWhere = secondClaimRecorder.where.mock.calls[0]?.[0]
    const staleResultWhere = staleResultRecorder.where.mock.calls[0]?.[0]
    expect(staleClaim.token).toBe('stale-token')
    expect(freshClaim.token).toBe('fresh-token')
    expect(staleUpdate).toEqual({ updated: false })
    expect(
      objectContainsReference(
        secondClaimWhere,
        schema.growthRewardSettlement.processingStartedAt,
      ),
    ).toBe(true)
    expect(objectContainsReference(staleResultWhere, 'stale-token')).toBe(true)
    expect(objectContainsReference(staleResultWhere, 'fresh-token')).toBe(false)
  })

  it('retryCompletedTaskRewardsBatch scans orphaned reward settlement links', async () => {
    const { service, db } = createExecutionService()
    const selectRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    ;(db as any).select = jest.fn(() =>
      createThenableBuilder([], selectRecorder),
    )

    await service.retryCompletedTaskRewardsBatch(100)

    const whereCondition = selectRecorder.where.mock.calls[0]?.[0]
    expect(
      objectContainsReference(whereCondition, schema.growthRewardSettlement.id),
    ).toBe(true)
  })

  it('task definition pending reward count includes orphaned reward settlement links', async () => {
    const { service, db } = createExecutionService()
    const activeRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    const rewardPendingRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    ;(db as any).select = jest
      .fn()
      .mockReturnValueOnce(createThenableBuilder([], activeRecorder))
      .mockReturnValueOnce(createThenableBuilder([], rewardPendingRecorder))

    await (service as any).getTaskDefinitionRuntimeSummaryMap([1])

    const whereCondition = rewardPendingRecorder.where.mock.calls[0]?.[0]
    expect(
      objectContainsReference(whereCondition, schema.growthRewardSettlement.id),
    ).toBe(true)
  })

  it('task reconciliation pending settlement filter includes orphaned reward settlement links', () => {
    const { service } = createExecutionService()
    const condition = (
      service as any
    ).buildTaskReconciliationSettlementStatusCondition(
      GrowthRewardSettlementStatusEnum.PENDING,
    )

    expect(
      objectContainsReference(condition, schema.growthRewardSettlement.id),
    ).toBe(true)
  })

  it('retryCompletedTaskRewardsBatch reports succeeded, failed and skipped counts', async () => {
    const { service, db } = createExecutionService()
    ;(db as any).select = jest.fn(() =>
      createThenableBuilder([
        { instanceId: 101, rewardSettlementId: 901 },
        { instanceId: 102, rewardSettlementId: 902 },
        { instanceId: 103, rewardSettlementId: 903 },
        { instanceId: 104, rewardSettlementId: 904 },
      ]),
    )
    jest
      .spyOn(service, 'retryTaskInstanceReward')
      .mockImplementation(async (instanceId: number) => {
        if (instanceId === 101) {
          return {
            instanceId,
            rewardSettlementId: 901,
            settlementStatus: 1,
            succeeded: true,
            message: '任务奖励已补偿成功',
          }
        }
        if (instanceId === 102) {
          return {
            instanceId,
            rewardSettlementId: 902,
            settlementStatus: 0,
            succeeded: false,
            message: '任务奖励补偿重试已执行，当前仍未成功',
          }
        }
        if (instanceId === 103) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '任务实例没有可发放奖励，无需重试',
          )
        }
        throw new Error('settlement store unavailable')
      })

    const result = await service.retryCompletedTaskRewardsBatch(100)

    expect(result).toEqual({
      scannedCount: 4,
      succeededCount: 1,
      failedCount: 2,
      skippedCount: 1,
      failures: [
        {
          instanceId: 102,
          rewardSettlementId: 902,
          message: '任务奖励补偿重试已执行，当前仍未成功',
        },
        {
          instanceId: 104,
          rewardSettlementId: 904,
          message: 'settlement store unavailable',
        },
      ],
    })
  })
})

describe('TaskDefinitionService review regressions', () => {
  it('rejects creating MANUAL + EVENT task definitions', async () => {
    const drizzle = {
      schema,
      db: { query: {} },
      withErrorHandling: jest.fn(),
      withTransaction: jest.fn(),
    }
    const registry = {
      getTemplateByKey: jest.fn(() => ({
        templateKey: 'COMIC_WORK_VIEW',
        eventCode: 100,
        isSelectable: true,
        supportsUniqueCounting: true,
      })),
      buildFilterValues: jest.fn(() => []),
      normalizeFilterPayload: jest.fn(() => null),
    }
    const service = new TaskDefinitionService(drizzle as any, registry as any)

    await expect(
      service.createTaskDefinition(
        {
          title: 'Manual event task',
          sceneType: TaskTypeEnum.DAILY,
          status: TaskDefinitionStatusEnum.DRAFT,
          sortOrder: 0,
          claimMode: TaskClaimModeEnum.MANUAL,
          step: {
            triggerMode: TaskStepTriggerModeEnum.EVENT,
            targetValue: 1,
            templateKey: 'COMIC_WORK_VIEW',
            filters: [],
          },
        } as any,
        9,
      ),
    ).rejects.toThrow('任务执行模式仅支持自动领取+事件驱动，或手动领取+手动触发')
    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('rejects creating AUTO + MANUAL task definitions', async () => {
    const drizzle = {
      schema,
      db: { query: {} },
      withErrorHandling: jest.fn(),
      withTransaction: jest.fn(),
    }
    const registry = {
      getTemplateByKey: jest.fn(),
      buildFilterValues: jest.fn(() => []),
    }
    const service = new TaskDefinitionService(drizzle as any, registry as any)

    await expect(
      service.createTaskDefinition(
        {
          title: 'Auto manual task',
          sceneType: TaskTypeEnum.DAILY,
          status: TaskDefinitionStatusEnum.DRAFT,
          sortOrder: 0,
          claimMode: TaskClaimModeEnum.AUTO,
          step: {
            triggerMode: TaskStepTriggerModeEnum.MANUAL,
            targetValue: 1,
          },
        } as any,
        9,
      ),
    ).rejects.toThrow('任务执行模式仅支持自动领取+事件驱动，或手动领取+手动触发')
    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('rejects updates that would create an illegal execution matrix', async () => {
    const db = {
      query: {
        taskStep: {
          findFirst: jest.fn().mockResolvedValue(createStep()),
        },
      },
    }
    const drizzle = {
      schema,
      db,
      withErrorHandling: jest.fn(),
      withTransaction: jest.fn(),
    }
    const registry = {
      getTemplateByKey: jest.fn(),
      buildFilterValues: jest.fn(() => []),
    }
    const service = new TaskDefinitionService(drizzle as any, registry as any)
    jest
      .spyOn(service as any, 'getTaskDefinitionRecordOrThrow')
      .mockResolvedValue(createManualTask())

    await expect(
      service.updateTaskDefinition(
        {
          id: 1,
          claimMode: TaskClaimModeEnum.AUTO,
        },
        9,
      ),
    ).rejects.toThrow('任务执行模式仅支持自动领取+事件驱动，或手动领取+手动触发')
    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
  })

  it('blocks execution-contract updates while a task has active instances', async () => {
    const tx = {
      update: jest.fn(() => createThenableBuilder([])),
    }
    const db = {
      query: {
        taskStep: {
          findFirst: jest.fn().mockResolvedValue(createStep()),
        },
      },
    }
    const drizzle = {
      schema,
      db,
      withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
      withTransaction: jest.fn(
        async (callback: (runner: typeof tx) => unknown) => callback(tx),
      ),
    }
    const registry = {
      getTemplateByKey: jest.fn(),
      buildFilterValues: jest.fn(() => []),
    }
    const service = new TaskDefinitionService(drizzle as any, registry as any)
    jest
      .spyOn(service as any, 'getTaskDefinitionRecordOrThrow')
      .mockResolvedValue(createManualTask())
    const guardError = new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '任务已有进行中的实例，不能修改执行合同',
    )
    const guardSpy = jest
      .spyOn(service as any, 'ensureNoActiveTaskInstances')
      .mockRejectedValue(guardError)

    await expect(
      service.updateTaskDefinition(
        {
          id: 1,
          step: {
            triggerMode: TaskStepTriggerModeEnum.MANUAL,
            targetValue: 5,
          } as any,
        },
        9,
      ),
    ).rejects.toBe(guardError)

    expect(guardSpy).toHaveBeenCalledWith(expect.anything(), 1)
  })

  it('allows display-only task updates without active-instance guard', async () => {
    const tx = {
      update: jest.fn(() => createThenableBuilder([])),
    }
    const db = {
      query: {
        taskStep: {
          findFirst: jest.fn().mockResolvedValue(createStep()),
        },
      },
    }
    const drizzle = {
      schema,
      db,
      withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
      withTransaction: jest.fn(
        async (callback: (runner: typeof tx) => unknown) => callback(tx),
      ),
    }
    const registry = {
      getTemplateByKey: jest.fn(),
      buildFilterValues: jest.fn(() => []),
    }
    const service = new TaskDefinitionService(drizzle as any, registry as any)
    jest
      .spyOn(service as any, 'getTaskDefinitionRecordOrThrow')
      .mockResolvedValue(createManualTask())
    const guardSpy = jest.spyOn(service as any, 'ensureNoActiveTaskInstances')

    await service.updateTaskDefinition(
      {
        id: 1,
        title: 'Renamed task',
      },
      9,
    )

    expect(guardSpy).not.toHaveBeenCalled()
  })

  it('allows pausing a task definition while active instances exist', async () => {
    const tx = {
      update: jest.fn(() => createThenableBuilder([])),
    }
    const drizzle = {
      schema,
      db: { query: {} },
      withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
      withTransaction: jest.fn(
        async (callback: (runner: typeof tx) => unknown) => callback(tx),
      ),
    }
    const registry = {
      getTemplateByKey: jest.fn(),
      buildFilterValues: jest.fn(() => []),
    }
    const service = new TaskDefinitionService(drizzle as any, registry as any)
    jest
      .spyOn(service as any, 'getTaskDefinitionRecordOrThrow')
      .mockResolvedValue(createManualTask())
    const guardSpy = jest.spyOn(service as any, 'ensureNoActiveTaskInstances')

    await service.updateTaskDefinitionStatus(1, TaskDefinitionStatusEnum.PAUSED)

    expect(guardSpy).not.toHaveBeenCalled()
    expect(tx.update).toHaveBeenCalledWith(schema.taskDefinition)
  })
})

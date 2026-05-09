/// <reference types="jest" />

import * as schema from '@db/schema'
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
})

describe('TaskDefinitionService review regressions', () => {
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
          },
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
})

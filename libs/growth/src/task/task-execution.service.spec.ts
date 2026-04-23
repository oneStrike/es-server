import { EventDefinitionImplStatusEnum } from '@libs/growth/event-definition/event-definition.constant'
import { TaskService } from './task.service'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
import { TaskExecutionService } from './task-execution.service'
import { TaskNotificationService } from './task-notification.service'
import {
  TaskClaimModeEnum,
  TaskRepeatCycleEnum,
  TaskStepTriggerModeEnum,
} from './task.constant'

describe('task execution cycle helpers', () => {
  const service = new TaskExecutionService(
    null as never,
    null as never,
    null as never,
  )

  it('builds weekly cycle key from the Monday of the configured week', () => {
    const task = {
      repeatType: TaskRepeatCycleEnum.WEEKLY,
    } as never

    const cycleKey = (
      service as unknown as {
        buildTaskCycleKey: (task: unknown, now: Date) => string
      }
    ).buildTaskCycleKey(task, new Date('2026-04-22T08:00:00.000Z'))

    expect(cycleKey).toBe('2026-04-20')
  })

  it('expires daily instances at the next natural-day boundary', () => {
    const task = {
      repeatType: TaskRepeatCycleEnum.DAILY,
      endAt: null,
    } as never

    const expiredAt = (
      service as unknown as {
        buildTaskExpiredAt: (task: unknown, now: Date) => Date | null
      }
    ).buildTaskExpiredAt(task, new Date('2026-04-22T08:00:00.000Z'))

    expect(expiredAt?.toISOString()).toBe('2026-04-22T16:00:00.000Z')
  })

  it('caps cycle expiration by task endAt when endAt is earlier', () => {
    const task = {
      repeatType: TaskRepeatCycleEnum.DAILY,
      endAt: new Date('2026-04-22T12:00:00.000Z'),
    } as never

    const expiredAt = (
      service as unknown as {
        buildTaskExpiredAt: (task: unknown, now: Date) => Date | null
      }
    ).buildTaskExpiredAt(task, new Date('2026-04-22T08:00:00.000Z'))

    expect(expiredAt?.toISOString()).toBe('2026-04-22T12:00:00.000Z')
  })

  it('ignores legacy repeatTimezone when building cycle keys', () => {
    const task = {
      repeatType: TaskRepeatCycleEnum.DAILY,
      repeatTimezone: 'America/Los_Angeles',
    } as never

    const cycleKey = (
      service as unknown as {
        buildTaskCycleKey: (task: unknown, now: Date) => string
      }
    ).buildTaskCycleKey(task, new Date('2026-04-22T16:30:00.000Z'))

    expect(cycleKey).toBe('2026-04-23')
  })

  it('ignores legacy repeatTimezone when calculating expiration', () => {
    const task = {
      repeatType: TaskRepeatCycleEnum.DAILY,
      repeatTimezone: 'America/Los_Angeles',
      endAt: null,
    } as never

    const expiredAt = (
      service as unknown as {
        buildTaskExpiredAt: (task: unknown, now: Date) => Date | null
      }
    ).buildTaskExpiredAt(task, new Date('2026-04-22T16:30:00.000Z'))

    expect(expiredAt?.toISOString()).toBe('2026-04-23T16:00:00.000Z')
  })
})

describe('task template contract hard cutover', () => {
  it('strips eventCode from template options response', async () => {
    const service = new TaskService(
      {} as never,
      {
        listTemplates: jest.fn().mockReturnValue([
          {
            templateKey: 'COMIC_WORK_VIEW',
            eventCode: 100,
            label: '漫画作品浏览',
            implStatus: EventDefinitionImplStatusEnum.IMPLEMENTED,
            isSelectable: true,
            targetEntityType: 'comic_work',
            supportsUniqueCounting: false,
            uniqueDimension: undefined,
            availableFilterFields: [],
            warningHints: [],
          },
        ]),
      } as never,
      {} as never,
      {} as never,
    )

    await expect(service.getTaskTemplateOptions()).resolves.toEqual({
      list: [
        {
          templateKey: 'COMIC_WORK_VIEW',
          label: '漫画作品浏览',
          implStatus: EventDefinitionImplStatusEnum.IMPLEMENTED,
          isSelectable: true,
          targetEntityType: 'comic_work',
          supportsUniqueCounting: false,
          availableFilterFields: [],
          warningHints: [],
        },
      ],
    })
  })

  it('matches targetType filter against the event envelope root field', () => {
    const registry = new TaskEventTemplateRegistry({} as never)

    expect(
      registry.matchesFilterPayload(
        { targetType: 'comic_work' },
        'comic_work',
        101,
        {
          browseTargetType: 9,
        },
      ),
    ).toBe(true)

    expect(
      registry.matchesFilterPayload(
        { targetType: 'novel_work' },
        'comic_work',
        101,
        {
          browseTargetType: 9,
        },
      ),
    ).toBe(false)
  })
})

describe('task manual execution hard cutover', () => {
  function createExecutionHarness() {
    const schema = {
      taskInstance: { name: 'taskInstance' },
      taskInstanceStep: { name: 'taskInstanceStep' },
      taskEventLog: { name: 'taskEventLog' },
    }

    const updateWhere = jest.fn().mockResolvedValue(undefined)
    const updateSet = jest.fn(() => ({ where: updateWhere }))
    const update = jest.fn(() => ({ set: updateSet }))

    const taskInstanceStepInsertValues = jest.fn(() => ({
      onConflictDoNothing: () => ({
        returning: jest.fn().mockResolvedValue([
          {
            id: 9001,
            instanceId: 501,
            stepId: 601,
            status: 0,
            currentValue: 0,
            targetValue: 1,
            completedAt: null,
            context: null,
            version: 0,
            createdAt: new Date('2026-04-23T09:00:00.000Z'),
            updatedAt: new Date('2026-04-23T09:00:00.000Z'),
          },
        ]),
      }),
    }))
    const taskEventLogInsertValues = jest.fn().mockResolvedValue(undefined)
    const insert = jest.fn((table: unknown) => {
      if (table === schema.taskInstanceStep) {
        return {
          values: taskInstanceStepInsertValues,
        }
      }
      if (table === schema.taskEventLog) {
        return {
          values: taskEventLogInsertValues,
        }
      }
      throw new Error('unexpected insert target')
    })

    const tx = {
      query: {
        taskInstance: {
          findFirst: jest.fn(),
        },
        taskInstanceStep: {
          findFirst: jest.fn(),
        },
      },
      insert,
      update,
    }

    const drizzle = {
      schema,
      db: {},
      withTransaction: jest.fn(
        async (fn: (runner: unknown) => Promise<unknown>) => fn(tx),
      ),
    }
    const rewardService = {
      tryRewardTaskComplete: jest.fn(),
    }
    const service = new TaskExecutionService(
      drizzle as never,
      {} as never,
      rewardService as never,
    )

    return {
      service,
      tx,
      drizzle,
      rewardService,
      taskEventLogInsertValues,
    }
  }

  it('rejects claimTask for non-manual tasks without side effects', async () => {
    const { service, drizzle } = createExecutionHarness()
    jest
      .spyOn(service as never, 'getAvailableTaskDefinitionOrThrow')
      .mockResolvedValue({
        id: 11,
        claimMode: TaskClaimModeEnum.AUTO,
      } as never)
    jest.spyOn(service as never, 'getSingleTaskStepOrThrow').mockResolvedValue({
      id: 21,
      triggerMode: TaskStepTriggerModeEnum.MANUAL,
    } as never)

    await expect(
      service.claimTask({ id: 11 } as never, 1001),
    ).rejects.toMatchObject({
      message: '当前任务不允许手动领取或手动完成',
    })
    expect(drizzle.withTransaction).not.toHaveBeenCalled()
  })

  it('rejects reportProgress when the manual task has not been claimed', async () => {
    const { service, tx, rewardService, taskEventLogInsertValues } =
      createExecutionHarness()
    jest
      .spyOn(service as never, 'getAvailableTaskDefinitionOrThrow')
      .mockResolvedValue({
        id: 11,
        claimMode: TaskClaimModeEnum.MANUAL,
        repeatType: TaskRepeatCycleEnum.ONCE,
        rewardItems: null,
      } as never)
    jest.spyOn(service as never, 'getSingleTaskStepOrThrow').mockResolvedValue({
      id: 21,
      triggerMode: TaskStepTriggerModeEnum.MANUAL,
    } as never)
    tx.query.taskInstance.findFirst.mockResolvedValue(null)

    await expect(
      service.reportProgress({ id: 11, delta: 1 } as never, 1001),
    ).rejects.toMatchObject({
      message: '任务未领取',
    })
    expect(taskEventLogInsertValues).not.toHaveBeenCalled()
    expect(rewardService.tryRewardTaskComplete).not.toHaveBeenCalled()
  })

  it('allows completeTask to finish a fresh once/manual task after claim', async () => {
    const { service, tx, rewardService, taskEventLogInsertValues } =
      createExecutionHarness()
    jest
      .spyOn(service as never, 'getAvailableTaskDefinitionOrThrow')
      .mockResolvedValue({
        id: 11,
        claimMode: TaskClaimModeEnum.MANUAL,
        repeatType: TaskRepeatCycleEnum.ONCE,
        rewardItems: null,
      } as never)
    jest.spyOn(service as never, 'getSingleTaskStepOrThrow').mockResolvedValue({
      id: 601,
      triggerMode: TaskStepTriggerModeEnum.MANUAL,
      targetValue: 1,
    } as never)
    tx.query.taskInstance.findFirst.mockResolvedValue({
      id: 501,
      status: 0,
      taskId: 11,
      userId: 1001,
      cycleKey: 'once',
    })

    await expect(service.completeTask({ id: 11 } as never, 1001)).resolves.toBe(
      true,
    )
    expect(taskEventLogInsertValues).toHaveBeenCalledTimes(1)
    expect(rewardService.tryRewardTaskComplete).not.toHaveBeenCalled()
  })
})

describe('task reminder payload hard cutover', () => {
  it('uses instanceId in reminder payload instead of assignmentId', () => {
    const service = new TaskNotificationService()

    const event = service.createExpiringSoonReminderEvent({
      bizKey: 'task:reminder:expiring:instance:88',
      receiverUserId: 1001,
      task: {
        id: 9,
        code: 'daily_view',
        title: '浏览作品',
        type: 2,
      },
      cycleKey: '2026-04-23',
      instanceId: 88,
      expiredAt: new Date('2026-04-24T00:00:00.000Z'),
    })

    expect(event.context?.payload).toMatchObject({
      reminder: {
        kind: 'expiring_soon',
        instanceId: 88,
      },
    })
    expect(event.context?.payload).not.toHaveProperty('reminder.assignmentId')
  })
})

describe('task available list hard cutover', () => {
  it('orders candidate tasks by sortOrder then id', async () => {
    const schema = {
      taskDefinition: {
        deletedAt: Symbol('deletedAt'),
        status: Symbol('status'),
        claimMode: Symbol('claimMode'),
        startAt: Symbol('startAt'),
        endAt: Symbol('endAt'),
        sceneType: Symbol('sceneType'),
        sortOrder: Symbol('sortOrder'),
        id: Symbol('id'),
      },
    }
    const orderBy = jest.fn().mockResolvedValue([])
    const where = jest.fn(() => ({ orderBy }))
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))
    const drizzle = {
      schema,
      db: { select },
      buildPage: jest.fn().mockReturnValue({
        pageIndex: 1,
        pageSize: 20,
        limit: 20,
        offset: 0,
      }),
    }
    const service = new TaskExecutionService(
      drizzle as never,
      {} as never,
      {} as never,
    )
    ;(service as never as { filterClaimableTaskDefinitionsForUser: jest.Mock })
      .filterClaimableTaskDefinitionsForUser = jest.fn().mockResolvedValue([])
    ;(service as never as { getTaskStepSummaryMap: jest.Mock })
      .getTaskStepSummaryMap = jest.fn().mockResolvedValue(new Map())

    await expect(service.getAvailableTasks({} as never, 1001)).resolves.toEqual(
      {
        list: [],
        total: 0,
        pageIndex: 1,
        pageSize: 20,
      },
    )
    expect(orderBy).toHaveBeenCalledWith(
      schema.taskDefinition.sortOrder,
      schema.taskDefinition.id,
    )
  })
})

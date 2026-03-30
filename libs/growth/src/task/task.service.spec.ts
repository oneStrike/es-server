import {
  TaskAssignmentRewardResultTypeEnum,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskProgressActionTypeEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
  TaskTypeEnum,
} from './task.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/growth/growth-reward', () => ({
  UserGrowthRewardService: class {},
}))

jest.mock('@libs/message/outbox', () => ({
  MessageOutboxService: class {},
}))

jest.mock('@libs/message/notification', () => ({
  MessageNotificationTypeEnum: {
    COMMENT_REPLY: 1,
    COMMENT_LIKE: 2,
    CONTENT_FAVORITE: 3,
    USER_FOLLOW: 4,
    SYSTEM_ANNOUNCEMENT: 5,
    CHAT_MESSAGE: 6,
    TASK_REMINDER: 7,
  },
}))

function createUpdateTransactionHarness(rowCount: number) {
  const where = jest.fn().mockResolvedValue({ rowCount })
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))
  const logValues = jest.fn().mockResolvedValue(undefined)
  const insert = jest.fn(() => ({ values: logValues }))

  return {
    tx: { update, insert },
    insert,
    logValues,
    set,
    update,
    where,
  }
}

function createExpireTransactionHarness(
  expiredAssignments: Array<{
    assignmentId: number
    userId: number
    progress: number
  }>,
) {
  const returning = jest.fn().mockResolvedValue(expiredAssignments)
  const where = jest.fn(() => ({ returning }))
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))
  const logValues = jest.fn().mockResolvedValue(undefined)
  const insert = jest.fn(() => ({ values: logValues }))

  return {
    tx: { update, insert },
    insert,
    logValues,
    returning,
    set,
    update,
    where,
  }
}

function createSimpleSelectHarness<T>(rows: T[]) {
  const limit = jest.fn().mockResolvedValue(rows)
  const where = jest.fn(() => ({ limit }))
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))

  return {
    select,
    from,
    where,
    limit,
  }
}

function createRetryRewardQueryHarness<T>(rows: T[]) {
  const limit = jest.fn().mockResolvedValue(rows)
  const orderBy = jest.fn(() => ({ limit }))
  const where = jest.fn(() => ({ orderBy }))
  const leftJoin = jest.fn(() => ({ where }))
  const from = jest.fn(() => ({ leftJoin }))
  const select = jest.fn(() => ({ from }))

  return {
    select,
    from,
    leftJoin,
    where,
    orderBy,
    limit,
  }
}

function createDeleteTransactionHarness(
  schema: {
    task: unknown
    taskAssignment: unknown
  },
  expiredAssignments: Array<{
    assignmentId: number
    userId: number
    progress: number
  }>,
) {
  const taskWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
  const taskSet = jest.fn(() => ({ where: taskWhere }))
  const assignmentReturning = jest.fn().mockResolvedValue(expiredAssignments)
  const assignmentWhere = jest.fn(() => ({ returning: assignmentReturning }))
  const assignmentSet = jest.fn(() => ({ where: assignmentWhere }))
  const update = jest.fn((table) => {
    if (table === schema.task) {
      return { set: taskSet }
    }
    if (table === schema.taskAssignment) {
      return { set: assignmentSet }
    }
    throw new Error('unexpected table')
  })
  const logValues = jest.fn().mockResolvedValue(undefined)
  const insert = jest.fn(() => ({ values: logValues }))

  return {
    tx: {
      insert,
      query: {
        task: {
          findFirst: jest.fn().mockResolvedValue({ id: 7 }),
        },
      },
      update,
    },
    assignmentSet,
    logValues,
    taskSet,
  }
}

describe('task service rewardConfig contract', () => {
  const baseTask = {
    code: 'newbie_reward_contract',
    title: '完善个人资料',
    type: TaskTypeEnum.NEWBIE,
    status: TaskStatusEnum.DRAFT,
    priority: 10,
    isEnabled: true,
    claimMode: TaskClaimModeEnum.AUTO,
    completeMode: TaskCompleteModeEnum.AUTO,
    targetCount: 1,
  }

  it('rejects unsupported rewardConfig keys', async () => {
    const { TaskService } = await import('./task.service')

    const insert = jest.fn()
    const service = new TaskService(
      {
        db: { insert },
        schema: { task: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.createTask(
        {
          ...baseTask,
          rewardConfig: {
            points: 10,
            badgeCodes: ['newbie'],
          },
        } as any,
        7,
      ),
    ).rejects.toThrow(
      'rewardConfig 暂只支持 points、experience，暂不支持字段：badgeCodes',
    )

    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects non-positive integer reward values', async () => {
    const { TaskService } = await import('./task.service')

    const values = jest.fn()
    const insert = jest.fn(() => ({ values }))
    const service = new TaskService(
      {
        db: { insert },
        schema: { task: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.createTask(
        {
          ...baseTask,
          rewardConfig: {
            points: 0,
            experience: 3.5,
          },
        } as any,
        7,
      ),
    ).rejects.toThrow('rewardConfig.points 必须是大于 0 的整数')

    expect(values).not.toHaveBeenCalled()
  })

  it('normalizes valid rewardConfig before insert', async () => {
    const { TaskService } = await import('./task.service')

    const values = jest.fn().mockResolvedValue([{ id: 1 }])
    const insert = jest.fn(() => ({ values }))
    const service = new TaskService(
      {
        db: { insert },
        schema: { task: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.createTask(
        {
          ...baseTask,
          rewardConfig: '{"points":10,"experience":5}',
          repeatRule: '{"type":"daily"}',
        } as any,
        9,
      ),
    ).resolves.toBe(true)

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardConfig: {
          points: 10,
          experience: 5,
        },
        repeatRule: {
          type: 'daily',
        },
        createdById: 9,
        updatedById: 9,
      }),
    )
  })

  it('rejects invalid repeatRule type before insert', async () => {
    const { TaskService } = await import('./task.service')

    const values = jest.fn()
    const insert = jest.fn(() => ({ values }))
    const service = new TaskService(
      {
        db: { insert },
        schema: { task: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.createTask(
        {
          ...baseTask,
          repeatRule: {
            type: 'yearly',
          },
        } as any,
        9,
      ),
    ).rejects.toThrow('repeatRule.type 仅支持 once、daily、weekly、monthly')

    expect(values).not.toHaveBeenCalled()
  })

  it('writes reward settlement state back to assignment after completion reward', async () => {
    const { TaskService } = await import('./task.service')
    const { MessageNotificationTypeEnum } = await import('@libs/message/notification')

    const settledAt = new Date('2026-03-28T12:00:00.000Z')
    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const enqueueNotificationEvent = jest.fn().mockResolvedValue(undefined)
    const tryRewardTaskComplete = jest.fn().mockResolvedValue({
      success: true,
      resultType: TaskAssignmentRewardResultTypeEnum.APPLIED,
      settledAt,
      ledgerRecordIds: [101, 102],
      pointsReward: {
        assetType: 1,
        configuredAmount: 10,
        success: true,
        duplicated: false,
        skipped: false,
        recordId: 101,
      },
      experienceReward: {
        assetType: 2,
        configuredAmount: 5,
        success: true,
        duplicated: false,
        skipped: false,
        recordId: 102,
      },
    })

    const service = new TaskService(
      {
        db: { update },
        schema: { taskAssignment: { id: 'id' } },
        withErrorHandling: jest.fn(async (callback) => callback()),
        assertAffectedRows: jest.fn(),
      } as any,
      { tryRewardTaskComplete } as any,
      { enqueueNotificationEvent } as any,
    )

    await (service as any).emitTaskCompleteEvent(
      9,
      { id: 7, title: '完善个人资料', rewardConfig: { points: 10, experience: 5 } },
      { id: 18 },
    )

    expect(tryRewardTaskComplete).toHaveBeenCalledWith({
      userId: 9,
      taskId: 7,
      assignmentId: 18,
      rewardConfig: { points: 10, experience: 5 },
      eventEnvelope: expect.objectContaining({
        code: 'task.complete',
        key: 'TASK_COMPLETE',
        subjectId: 9,
        targetId: 18,
        subjectType: 'user',
        targetType: 'task_assignment',
        governanceStatus: 'none',
        context: {
          taskId: 7,
          assignmentId: 18,
        },
      }),
    })
    expect(set).toHaveBeenCalledWith({
      rewardStatus: TaskAssignmentRewardStatusEnum.SUCCESS,
      rewardResultType: TaskAssignmentRewardResultTypeEnum.APPLIED,
      rewardSettledAt: settledAt,
      rewardLedgerIds: [101, 102],
      lastRewardError: null,
    })
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: MessageNotificationTypeEnum.TASK_REMINDER,
        bizKey: 'task:reminder:reward:assignment:18',
        payload: expect.objectContaining({
          receiverUserId: 9,
          type: MessageNotificationTypeEnum.TASK_REMINDER,
          title: '任务奖励已到账',
          payload: expect.objectContaining({
            reminderKind: 'task_reward_granted',
            taskId: 7,
            assignmentId: 18,
            points: 10,
            experience: 5,
            ledgerRecordIds: [101, 102],
          }),
        }),
      }),
    )
  })

  it('only enqueues available reminders for recent manual tasks', async () => {
    const { TaskService } = await import('./task.service')

    const enqueueNotificationEvents = jest.fn().mockResolvedValue(undefined)
    const service = new TaskService(
      {
        db: {},
        schema: {},
      } as any,
      {} as any,
      { enqueueNotificationEvents } as any,
    )

    const now = new Date('2026-03-29T12:00:00.000Z')
    await (service as any).tryNotifyAvailableTasksFromPage(
      9,
      [
        {
          id: 101,
          title: '新手资料完善',
          claimMode: TaskClaimModeEnum.MANUAL,
          publishStartAt: new Date('2026-03-29T08:00:00.000Z'),
          createdAt: new Date('2026-03-29T07:00:00.000Z'),
          repeatRule: { type: 'once' },
        },
        {
          id: 102,
          title: '历史任务',
          claimMode: TaskClaimModeEnum.MANUAL,
          publishStartAt: new Date('2026-03-20T08:00:00.000Z'),
          createdAt: new Date('2026-03-20T07:00:00.000Z'),
          repeatRule: { type: 'once' },
        },
        {
          id: 103,
          title: '自动任务',
          claimMode: TaskClaimModeEnum.AUTO,
          publishStartAt: new Date('2026-03-29T08:00:00.000Z'),
          createdAt: new Date('2026-03-29T07:00:00.000Z'),
          repeatRule: { type: 'once' },
        },
      ],
      now,
    )

    expect(enqueueNotificationEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        bizKey: 'task:reminder:available:task:101:cycle:once:user:9',
        payload: expect.objectContaining({
          receiverUserId: 9,
          payload: expect.objectContaining({
            reminderKind: 'task_available',
            taskId: 101,
          }),
        }),
      }),
    ])
  })

  it('retries completed rewards from assignment snapshot instead of current task config', async () => {
    const { TaskService } = await import('./task.service')
    const queryHarness = createRetryRewardQueryHarness([
      {
        assignmentId: 18,
        taskId: 7,
        userId: 9,
        completedAt: new Date('2026-03-29T12:00:00.000Z'),
        taskSnapshot: {
          title: '老标题',
          rewardConfig: { points: 20, experience: 8 },
        },
        title: '新标题',
        rewardConfig: { points: 1, experience: 1 },
      },
    ])

    const service = new TaskService(
      {
        db: { select: queryHarness.select },
        schema: {
          taskAssignment: {
            id: 'id',
            taskId: 'taskId',
            userId: 'userId',
            completedAt: 'completedAt',
            taskSnapshot: 'taskSnapshot',
            deletedAt: 'deletedAt',
            status: 'status',
            rewardStatus: 'rewardStatus',
          },
          task: {
            title: 'title',
            rewardConfig: 'rewardConfig',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(service.retryCompletedAssignmentRewards()).resolves.toBeUndefined()

    expect(emitTaskCompleteEvent).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        id: 7,
        title: '老标题',
        rewardConfig: { points: 20, experience: 8 },
      }),
      expect.objectContaining({
        id: 18,
      }),
    )
  })
})

describe('task service main flows', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('keeps manual tasks in progress when reportProgress reaches the target', async () => {
    const { TaskService } = await import('./task.service')
    const txHarness = createUpdateTransactionHarness(1)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {},
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    jest.spyOn(service as any, 'findAvailableTask').mockResolvedValue({
      id: 11,
      claimMode: TaskClaimModeEnum.MANUAL,
      completeMode: TaskCompleteModeEnum.MANUAL,
      repeatRule: { type: TaskRepeatTypeEnum.ONCE },
    })
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 21,
      status: TaskAssignmentStatusEnum.PENDING,
      progress: 2,
      target: 3,
      version: 4,
      context: { source: 'app' },
    })
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.reportProgress(
        {
          taskId: 11,
          delta: 1,
          context: '{"source":"event"}',
        } as any,
        9,
      ),
    ).resolves.toBe(true)

    expect(txHarness.set).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: 3,
        status: TaskAssignmentStatusEnum.IN_PROGRESS,
        completedAt: undefined,
        context: { source: 'event' },
      }),
    )
    expect(txHarness.logValues).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 21,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.PROGRESS,
        beforeValue: 2,
        afterValue: 3,
      }),
    )
    expect(emitTaskCompleteEvent).not.toHaveBeenCalled()
  })

  it('auto-completes AUTO tasks on the first reportProgress that reaches the target', async () => {
    const { TaskService } = await import('./task.service')
    const txHarness = createUpdateTransactionHarness(1)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {},
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    jest.spyOn(service as any, 'findAvailableTask').mockResolvedValue({
      id: 12,
      claimMode: TaskClaimModeEnum.AUTO,
      completeMode: TaskCompleteModeEnum.AUTO,
      repeatRule: { type: TaskRepeatTypeEnum.ONCE },
    })
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 22,
      status: TaskAssignmentStatusEnum.IN_PROGRESS,
      progress: 1,
      target: 2,
      version: 5,
      context: null,
    })
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.reportProgress({ taskId: 12, delta: 1 } as any, 9),
    ).resolves.toBe(true)

    expect(txHarness.set).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: 2,
        status: TaskAssignmentStatusEnum.COMPLETED,
      }),
    )
    expect(txHarness.logValues).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 22,
        actionType: TaskProgressActionTypeEnum.COMPLETE,
        beforeValue: 1,
        afterValue: 2,
      }),
    )
    expect(emitTaskCompleteEvent).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ id: 12 }),
      expect.objectContaining({ id: 22 }),
    )
  })

  it('completes manual tasks only after explicit completeTask', async () => {
    const { TaskService } = await import('./task.service')
    const txHarness = createUpdateTransactionHarness(1)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {},
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    jest.spyOn(service as any, 'findAvailableTask').mockResolvedValue({
      id: 11,
      completeMode: TaskCompleteModeEnum.MANUAL,
      repeatRule: { type: TaskRepeatTypeEnum.ONCE },
    })
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 21,
      status: TaskAssignmentStatusEnum.IN_PROGRESS,
      progress: 3,
      target: 3,
      version: 4,
    })
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.completeTask({ taskId: 11 } as any, 9),
    ).resolves.toBe(true)

    expect(txHarness.set).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: 3,
        status: TaskAssignmentStatusEnum.COMPLETED,
      }),
    )
    expect(txHarness.logValues).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 21,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.COMPLETE,
        beforeValue: 3,
        afterValue: 3,
      }),
    )
    expect(emitTaskCompleteEvent).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ id: 11 }),
      expect.objectContaining({ id: 21 }),
    )
  })

  it('does not write progress logs when reportProgress loses the optimistic lock', async () => {
    const { TaskService } = await import('./task.service')
    const txHarness = createUpdateTransactionHarness(0)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {},
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    jest.spyOn(service as any, 'findAvailableTask').mockResolvedValue({
      id: 11,
      claimMode: TaskClaimModeEnum.AUTO,
      completeMode: TaskCompleteModeEnum.AUTO,
      repeatRule: { type: TaskRepeatTypeEnum.ONCE },
    })
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 21,
      status: TaskAssignmentStatusEnum.IN_PROGRESS,
      progress: 1,
      target: 2,
      version: 4,
      context: null,
    })
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.reportProgress({ taskId: 11, delta: 1 } as any, 9),
    ).rejects.toThrow('任务进度更新冲突，请重试')

    expect(txHarness.logValues).not.toHaveBeenCalled()
    expect(emitTaskCompleteEvent).not.toHaveBeenCalled()
  })

  it('does not re-complete already completed assignments on repeated reportProgress', async () => {
    const { TaskService } = await import('./task.service')
    const withTransaction = jest.fn()

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {},
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    jest.spyOn(service as any, 'findAvailableTask').mockResolvedValue({
      id: 13,
      claimMode: TaskClaimModeEnum.AUTO,
      completeMode: TaskCompleteModeEnum.AUTO,
      repeatRule: { type: TaskRepeatTypeEnum.ONCE },
    })
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 23,
      status: TaskAssignmentStatusEnum.COMPLETED,
      progress: 2,
      target: 2,
      version: 6,
      rewardStatus: TaskAssignmentRewardStatusEnum.PENDING,
    })
    const settleCompletedAssignmentRewardIfNeeded = jest
      .spyOn(service as any, 'settleCompletedAssignmentRewardIfNeeded')
      .mockResolvedValue(undefined)
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.reportProgress({ taskId: 13, delta: 1 } as any, 9),
    ).resolves.toBe(true)

    expect(settleCompletedAssignmentRewardIfNeeded).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ id: 13 }),
      expect.objectContaining({ id: 23 }),
    )
    expect(withTransaction).not.toHaveBeenCalled()
    expect(emitTaskCompleteEvent).not.toHaveBeenCalled()
  })

  it('does not write completion logs when completeTask loses the optimistic lock', async () => {
    const { TaskService } = await import('./task.service')
    const txHarness = createUpdateTransactionHarness(0)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {},
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    jest.spyOn(service as any, 'findAvailableTask').mockResolvedValue({
      id: 11,
      completeMode: TaskCompleteModeEnum.MANUAL,
      repeatRule: { type: TaskRepeatTypeEnum.ONCE },
    })
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 21,
      status: TaskAssignmentStatusEnum.IN_PROGRESS,
      progress: 3,
      target: 3,
      version: 4,
    })
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.completeTask({ taskId: 11 } as any, 9),
    ).rejects.toThrow('任务完成状态更新冲突，请重试')

    expect(txHarness.logValues).not.toHaveBeenCalled()
    expect(emitTaskCompleteEvent).not.toHaveBeenCalled()
  })

  it('rejects task actions after publishEndAt even before cron expires assignments', async () => {
    const { TaskService } = await import('./task.service')

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: {
            userId: 'userId',
            deletedAt: 'deletedAt',
          },
          task: {
            type: 'type',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )

    expect(() =>
      (service as any).assertTaskInPublishWindow(
        {
          publishStartAt: new Date('2026-03-28T00:00:00.000Z'),
          publishEndAt: new Date('2026-03-29T00:00:00.000Z'),
        },
        new Date('2026-03-29T00:00:01.000Z'),
      ),
    ).toThrow('任务已结束')
  })

  it('rejects task actions before publishStartAt', async () => {
    const { TaskService } = await import('./task.service')

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: {
            userId: 'userId',
            deletedAt: 'deletedAt',
          },
          task: {
            type: 'type',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )

    expect(() =>
      (service as any).assertTaskInPublishWindow(
        {
          publishStartAt: new Date('2026-03-31T00:00:00.000Z'),
          publishEndAt: new Date('2026-04-30T00:00:00.000Z'),
        },
        new Date('2026-03-30T23:59:59.000Z'),
      ),
    ).toThrow('任务未开始')
  })

  it('rejects partial publish-window updates that would invert start and end', async () => {
    const { TaskService } = await import('./task.service')

    const update = jest.fn()
    const service = new TaskService(
      {
        db: {
          query: {
            task: {
              findFirst: jest.fn().mockResolvedValue({
                id: 11,
                publishStartAt: new Date('2026-04-10T00:00:00.000Z'),
                publishEndAt: new Date('2026-04-20T00:00:00.000Z'),
                repeatRule: null,
                completeMode: TaskCompleteModeEnum.MANUAL,
              }),
            },
          },
          update,
        },
        schema: { task: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateTask(
        {
          id: 11,
          publishEndAt: new Date('2026-04-01T00:00:00.000Z'),
        } as any,
        9,
      ),
    ).rejects.toThrow('发布开始时间不能晚于结束时间')

    expect(update).not.toHaveBeenCalled()
  })

  it('blocks changing completeMode when active assignments already exist', async () => {
    const { TaskService } = await import('./task.service')
    const selectHarness = createSimpleSelectHarness([{ id: 101 }])
    const update = jest.fn()

    const service = new TaskService(
      {
        db: {
          query: {
            task: {
              findFirst: jest.fn().mockResolvedValue({
                id: 11,
                publishStartAt: null,
                publishEndAt: null,
                repeatRule: null,
                completeMode: TaskCompleteModeEnum.MANUAL,
              }),
            },
          },
          select: selectHarness.select,
          update,
        },
        schema: {
          task: {},
          taskAssignment: {
            id: 'id',
            taskId: 'taskId',
            deletedAt: 'deletedAt',
            status: 'status',
          },
        },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateTask(
        {
          id: 11,
          completeMode: TaskCompleteModeEnum.AUTO,
        } as any,
        9,
      ),
    ).rejects.toThrow('存在进行中的任务分配，不能修改完成方式')

    expect(update).not.toHaveBeenCalled()
  })

  it.each([
    [
      'daily',
      { type: TaskRepeatTypeEnum.DAILY },
      '2026-03-31T00:00:00.000Z',
      '2026-03-30T10:15:00.000Z',
    ],
    [
      'weekly',
      { type: TaskRepeatTypeEnum.WEEKLY },
      '2026-04-06T00:00:00.000Z',
      '2026-03-30T10:15:00.000Z',
    ],
    [
      'monthly',
      { type: TaskRepeatTypeEnum.MONTHLY },
      '2026-04-01T00:00:00.000Z',
      '2026-03-30T10:15:00.000Z',
    ],
  ])(
    'builds cycle-based expiredAt for %s tasks',
    async (_label, repeatRule, expectedExpiredAt, nowValue) => {
      const { TaskService } = await import('./task.service')
      const service = new TaskService(
        {
          db: {},
          schema: {},
        } as any,
        {} as any,
        {} as any,
      )

      const expiredAt = (service as any).buildAssignmentExpiredAt(
        {
          repeatRule,
          publishEndAt: null,
        },
        new Date(nowValue),
      )

      expect(expiredAt?.toISOString()).toBe(expectedExpiredAt)
    },
  )

  it('writes expire audit logs when cron closes overdue assignments', async () => {
    const { TaskService } = await import('./task.service')
    const txHarness = createExpireTransactionHarness([
      { assignmentId: 21, userId: 9, progress: 2 },
      { assignmentId: 22, userId: 9, progress: 0 },
    ])
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: {
            deletedAt: 'deletedAt',
            status: 'status',
            expiredAt: 'expiredAt',
            id: 'id',
            userId: 'userId',
            progress: 'progress',
            version: 'version',
          },
          taskProgressLog: {},
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    await expect(service.expireAssignments()).resolves.toBeUndefined()

    expect(txHarness.logValues).toHaveBeenCalledWith([
      {
        assignmentId: 21,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.EXPIRE,
        delta: 0,
        beforeValue: 2,
        afterValue: 2,
      },
      {
        assignmentId: 22,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.EXPIRE,
        delta: 0,
        beforeValue: 0,
        afterValue: 0,
      },
    ])
  })

  it('expires active assignments when deleting a task', async () => {
    const { TaskService } = await import('./task.service')
    const schema = {
      task: {
        id: 'taskId',
        deletedAt: 'taskDeletedAt',
      },
      taskAssignment: {
        deletedAt: 'deletedAt',
        status: 'status',
        id: 'id',
        userId: 'userId',
        progress: 'progress',
        version: 'version',
        taskId: 'taskId',
      },
      taskProgressLog: {},
    }
    const txHarness = createDeleteTransactionHarness(schema, [
      { assignmentId: 21, userId: 9, progress: 2 },
    ])
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = new TaskService(
      {
        db: {},
        schema,
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )

    await expect(service.deleteTask(7)).resolves.toBe(true)

    expect(txHarness.taskSet).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
    })
    expect(txHarness.assignmentSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TaskAssignmentStatusEnum.EXPIRED,
        expiredAt: expect.any(Date),
      }),
    )
    expect(txHarness.logValues).toHaveBeenCalledWith([
      {
        assignmentId: 21,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.EXPIRE,
        delta: 0,
        beforeValue: 2,
        afterValue: 2,
      },
    ])
  })

  it('expires overdue assignments before rebuilding auto assignments in my tasks', async () => {
    const { TaskService } = await import('./task.service')

    const service = new TaskService(
      {
        db: {},
        schema: {
          taskAssignment: {
            userId: 'userId',
            deletedAt: 'deletedAt',
          },
          task: {
            type: 'type',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )
    const expireDueAssignmentsForUser = jest
      .spyOn(service as any, 'expireDueAssignmentsForUser')
      .mockResolvedValue(undefined)
    const ensureAutoAssignmentsForUser = jest
      .spyOn(service as any, 'ensureAutoAssignmentsForUser')
      .mockResolvedValue(undefined)
    jest.spyOn(service as any, 'queryTaskAssignmentPage').mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
    })

    await expect(
      service.getMyTasks({ pageIndex: 1, pageSize: 20 } as any, 9),
    ).resolves.toMatchObject({
      list: [],
      total: 0,
    })

    expect(expireDueAssignmentsForUser).toHaveBeenCalledWith(
      9,
      expect.any(Date),
    )
    expect(ensureAutoAssignmentsForUser).toHaveBeenCalledWith(
      9,
      expect.any(Date),
    )
    expect(expireDueAssignmentsForUser.mock.invocationCallOrder[0]).toBeLessThan(
      ensureAutoAssignmentsForUser.mock.invocationCallOrder[0],
    )
  })
})

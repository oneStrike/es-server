import { sql } from 'drizzle-orm'
import {
  getTaskTypeFilterValues,
  normalizeTaskType,
  TaskAssignmentRewardResultTypeEnum,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskObjectiveTypeEnum,
  TaskProgressActionTypeEnum,
  TaskProgressSourceEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
  TaskTypeEnum,
  TaskUserVisibleStatusEnum,
} from '../task.constant'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/growth/growth-reward/growth-reward.service', () => ({
  UserGrowthRewardService: class {}
}))

jest.mock('@libs/message/outbox/outbox.service', () => ({
  MessageOutboxService: class {}
}))

jest.mock('@libs/message/notification/notification.constant', () => ({
  MessageNotificationDispatchStatusEnum: {
    DELIVERED: 'delivered',
    FAILED: 'failed',
    RETRYING: 'retrying',
    SKIPPED_DUPLICATE: 'skipped_duplicate',
    SKIPPED_SELF: 'skipped_self',
    SKIPPED_PREFERENCE: 'skipped_preference',
  },
  MessageNotificationTypeEnum: {
    COMMENT_REPLY: 1,
    COMMENT_LIKE: 2,
    CONTENT_FAVORITE: 3,
    USER_FOLLOW: 4,
    SYSTEM_ANNOUNCEMENT: 5,
    CHAT_MESSAGE: 6,
    TASK_REMINDER: 7,
  }
}))

async function createTaskDefinitionService(
  drizzle: unknown,
  userGrowthRewardService: unknown = {},
  messageOutboxService: unknown = {},
) {
  const { TaskDefinitionService } = await import('../task-definition.service')

  return new TaskDefinitionService(
    drizzle as any,
    userGrowthRewardService as any,
    messageOutboxService as any,
  )
}

async function createTaskExecutionService(
  drizzle: unknown,
  userGrowthRewardService: unknown = {},
  messageOutboxService: unknown = {},
) {
  const { TaskExecutionService } = await import('../task-execution.service')

  return new TaskExecutionService(
    drizzle as any,
    userGrowthRewardService as any,
    messageOutboxService as any,
  )
}

async function createTaskRuntimeService(
  drizzle: unknown,
  taskExecutionService: unknown,
  userGrowthRewardService: unknown = {},
  messageOutboxService: unknown = {},
) {
  const { TaskRuntimeService } = await import('../task-runtime.service')

  return new TaskRuntimeService(
    drizzle as any,
    userGrowthRewardService as any,
    messageOutboxService as any,
    taskExecutionService as any,
  )
}

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

function createEventProgressTransactionHarness(params?: {
  duplicate?: boolean
  rowCount?: number
}) {
  const returningLog = jest
    .fn()
    .mockResolvedValue(params?.duplicate ? [] : [{ id: 1 }])
  const onConflictDoNothing = jest.fn(() => ({ returning: returningLog }))
  const values = jest.fn(() => ({ onConflictDoNothing }))
  const insert = jest.fn(() => ({ values }))
  const where = jest
    .fn()
    .mockResolvedValue({ rowCount: params?.rowCount ?? 1 })
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))

  return {
    tx: { insert, update },
    insert,
    onConflictDoNothing,
    returningLog,
    set,
    values,
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

function createOrderedSelectHarness<T>(rows: T[]) {
  const orderBy = jest.fn().mockResolvedValue(rows)
  const where = jest.fn(() => ({ orderBy }))
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))

  return {
    select,
    from,
    where,
    orderBy,
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

function createTaskAssignmentPageQueryHarness<TListItem>(
  listRows: TListItem[],
  countRows: Array<{ count: number }>,
) {
  let listSelection: Record<string, unknown> | undefined
  let countSelection: Record<string, unknown> | undefined

  const listOrderBy = jest.fn().mockResolvedValue(listRows)
  const listOffset = jest.fn(() => ({ orderBy: listOrderBy }))
  const listLimit = jest.fn(() => ({ offset: listOffset }))
  const listWhere = jest.fn(() => ({ limit: listLimit }))
  const listLeftJoin = jest.fn(() => ({ where: listWhere }))
  const listFrom = jest.fn(() => ({ leftJoin: listLeftJoin }))

  const countWhere = jest.fn().mockResolvedValue(countRows)
  const countLeftJoin = jest.fn(() => ({ where: countWhere }))
  const countFrom = jest.fn(() => ({
    leftJoin: countLeftJoin,
    where: countWhere,
  }))

  const select = jest
    .fn()
    .mockImplementationOnce((selection: Record<string, unknown>) => {
      listSelection = selection
      return { from: listFrom }
    })
    .mockImplementationOnce((selection: Record<string, unknown>) => {
      countSelection = selection
      return { from: countFrom }
    })

  return {
    countFrom,
    countLeftJoin,
    countWhere,
    getCountSelection: () => countSelection,
    getListSelection: () => listSelection,
    listFrom,
    listLeftJoin,
    listOrderBy,
    listWhere,
    select,
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
    type: TaskTypeEnum.ONBOARDING,
    status: TaskStatusEnum.DRAFT,
    priority: 10,
    isEnabled: true,
    claimMode: TaskClaimModeEnum.AUTO,
    completeMode: TaskCompleteModeEnum.AUTO,
    objectiveType: TaskObjectiveTypeEnum.MANUAL,
    targetCount: 1,
  }

  it('rejects unsupported rewardConfig keys', async () => {
    const insert = jest.fn()
    const service = await createTaskDefinitionService(
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
    const values = jest.fn()
    const insert = jest.fn(() => ({ values }))
    const service = await createTaskDefinitionService(
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
    const values = jest.fn().mockResolvedValue([{ id: 1 }])
    const insert = jest.fn(() => ({ values }))
    const service = await createTaskDefinitionService(
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
    const values = jest.fn()
    const insert = jest.fn(() => ({ values }))
    const service = await createTaskDefinitionService(
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

  it('rejects EVENT_COUNT tasks without eventCode', async () => {
    const values = jest.fn()
    const insert = jest.fn(() => ({ values }))
    const service = await createTaskDefinitionService(
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
          objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
        } as any,
        9,
      ),
    ).rejects.toThrow('EVENT_COUNT 任务必须配置 eventCode')

    expect(values).not.toHaveBeenCalled()
  })

  it('rejects eventCode on MANUAL tasks', async () => {
    const values = jest.fn()
    const insert = jest.fn(() => ({ values }))
    const service = await createTaskDefinitionService(
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
          eventCode: 300,
        } as any,
        9,
      ),
    ).rejects.toThrow(
      'MANUAL 任务不能配置 eventCode，请改为 EVENT_COUNT 或清空 eventCode',
    )

    expect(values).not.toHaveBeenCalled()
  })

  it('rejects non-positive targetCount before insert', async () => {
    const values = jest.fn()
    const insert = jest.fn(() => ({ values }))
    const service = await createTaskDefinitionService(
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
          targetCount: 0,
        } as any,
        9,
      ),
    ).rejects.toThrow('targetCount 必须是大于 0 的整数')

    expect(values).not.toHaveBeenCalled()
  })

  it('normalizes objective fields before insert', async () => {
    const values = jest.fn().mockResolvedValue([{ id: 1 }])
    const insert = jest.fn(() => ({ values }))
    const service = await createTaskDefinitionService(
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
          objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
          eventCode: '300',
          objectiveConfig: '{"sectionId":10}',
        } as any,
        9,
      ),
    ).resolves.toBe(true)

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
        eventCode: 300,
        objectiveConfig: {
          sectionId: 10,
        },
      }),
    )
  })

  it('writes reward settlement state back to assignment after completion reward', async () => {
    const { MessageNotificationTypeEnum } = await import('@libs/message/notification/notification.constant')

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

    const service = await createTaskExecutionService(
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

  it('writes failed reward settlement state with default error message', async () => {
    const settledAt = new Date('2026-03-28T12:30:00.000Z')
    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))

    const service = await createTaskExecutionService(
      {
        db: { update },
        schema: { taskAssignment: { id: 'id' } },
        withErrorHandling: jest.fn(async (callback) => callback()),
        assertAffectedRows: jest.fn(),
      } as any,
      {} as any,
      {} as any,
    )

    await (service as any).syncTaskAssignmentRewardState(18, {
      success: false,
      resultType: TaskAssignmentRewardResultTypeEnum.FAILED,
      source: 'task_bonus',
      bizKey: 'task:reward:18',
      dedupeResult: 'failed',
      settledAt,
      ledgerRecordIds: [],
      pointsReward: {
        assetType: 1,
        configuredAmount: 10,
        success: false,
        duplicated: false,
        skipped: false,
      },
      experienceReward: {
        assetType: 2,
        configuredAmount: 0,
        success: false,
        duplicated: false,
        skipped: true,
      },
    } as any)

    expect(set).toHaveBeenCalledWith({
      rewardStatus: TaskAssignmentRewardStatusEnum.FAILED,
      rewardResultType: TaskAssignmentRewardResultTypeEnum.FAILED,
      rewardSettledAt: settledAt,
      rewardLedgerIds: [],
      lastRewardError: '任务奖励发放失败，请稍后重试',
    })
  })

  it('only enqueues available reminders for recent manual tasks', async () => {
    const enqueueNotificationEvents = jest.fn().mockResolvedValue(undefined)
    const service = await createTaskExecutionService(
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

    const service = await createTaskExecutionService(
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

    await expect(
      service.retryCompletedAssignmentRewardsBatch(),
    ).resolves.toEqual({
      scannedCount: 1,
      triggeredCount: 1,
    })

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

  it('builds reward task record with snapshot-first fallback', async () => {
    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {},
      } as any,
      {} as any,
      {} as any,
    )

    const result = (service as any).buildTaskRewardTaskRecord(
      7,
      {
        code: 'daily_read_live',
        title: '每日阅读-live',
        type: TaskTypeEnum.DAILY,
        rewardConfig: { points: 1 },
      },
      {
        taskSnapshot: {
          title: '每日阅读-snapshot',
          rewardConfig: { points: 5 },
        },
      },
    )

    expect(result).toEqual({
      id: 7,
      code: 'daily_read_live',
      title: '每日阅读-snapshot',
      type: TaskTypeEnum.DAILY,
      rewardConfig: { points: 5 },
    })
  })
})

describe('task type compatibility', () => {
  it('normalizes legacy task type values into stable scene types', () => {
    expect(normalizeTaskType(1)).toBe(TaskTypeEnum.ONBOARDING)
    expect(normalizeTaskType(3)).toBe(TaskTypeEnum.DAILY)
    expect(normalizeTaskType(5)).toBe(TaskTypeEnum.CAMPAIGN)
  })

  it('builds compatible filter values for stable scene queries', () => {
    expect(getTaskTypeFilterValues(TaskTypeEnum.ONBOARDING)).toEqual([1])
    expect(getTaskTypeFilterValues(TaskTypeEnum.DAILY)).toEqual([2, 3])
    expect(getTaskTypeFilterValues(TaskTypeEnum.CAMPAIGN)).toEqual([4, 5])
  })
})

describe('task snapshot contract', () => {
  it('freezes execution-critical fields in assignment snapshot', async () => {
    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {
          taskAssignment: {
            userId: 'userId',
            deletedAt: 'deletedAt',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )

    const snapshot = (service as any).buildTaskSnapshot({
      id: 7,
      code: 'daily_read',
      title: '每日阅读',
      description: '每天阅读一章',
      cover: 'https://example.com/task.png',
      type: TaskTypeEnum.DAILY,
      claimMode: TaskClaimModeEnum.MANUAL,
      completeMode: TaskCompleteModeEnum.AUTO,
      objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
      eventCode: 300,
      objectiveConfig: { sectionId: 10 },
      repeatRule: { type: TaskRepeatTypeEnum.DAILY, timezone: 'Asia/Shanghai' },
      publishStartAt: new Date('2026-03-28T00:00:00.000Z'),
      publishEndAt: new Date('2026-03-31T00:00:00.000Z'),
      rewardConfig: { points: 10, experience: 5 },
      targetCount: 3,
    })

    expect(snapshot).toMatchObject({
      id: 7,
      code: 'daily_read',
      title: '每日阅读',
      description: '每天阅读一章',
      cover: 'https://example.com/task.png',
      type: TaskTypeEnum.DAILY,
      claimMode: TaskClaimModeEnum.MANUAL,
      completeMode: TaskCompleteModeEnum.AUTO,
      objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
      eventCode: 300,
      objectiveConfig: { sectionId: 10 },
      repeatRule: { type: TaskRepeatTypeEnum.DAILY, timezone: 'Asia/Shanghai' },
      rewardConfig: { points: 10, experience: 5 },
      targetCount: 3,
    })
  })
})

describe('task service main flows', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('keeps manual tasks in progress when reportProgress reaches the target', async () => {
    const txHarness = createUpdateTransactionHarness(1)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskExecutionService(
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
    const txHarness = createUpdateTransactionHarness(1)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskExecutionService(
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
    const txHarness = createUpdateTransactionHarness(1)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskExecutionService(
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
    const txHarness = createUpdateTransactionHarness(0)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskExecutionService(
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
    const withTransaction = jest.fn()

    const service = await createTaskExecutionService(
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
    const txHarness = createUpdateTransactionHarness(0)
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskExecutionService(
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

  it('advances EVENT_COUNT tasks from business events and auto-completes at target', async () => {
    const { GrowthRuleTypeEnum } = await import('../../growth-rule.constant')
    const { EventEnvelopeGovernanceStatusEnum } = await import(
      '../../event-definition/event-envelope.type'
    )
    const txHarness = createEventProgressTransactionHarness()
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {
            assignmentId: 'assignmentId',
            eventBizKey: 'eventBizKey',
            id: 'id',
          },
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )
    jest.spyOn(service as any, 'findEventProgressTasks').mockResolvedValue([
      {
        id: 11,
        code: 'comment_daily',
        claimMode: TaskClaimModeEnum.AUTO,
        completeMode: TaskCompleteModeEnum.AUTO,
        objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
        eventCode: GrowthRuleTypeEnum.CREATE_COMMENT,
        objectiveConfig: { sectionId: 10 },
        repeatRule: { type: TaskRepeatTypeEnum.ONCE },
      },
    ])
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 21,
      status: TaskAssignmentStatusEnum.IN_PROGRESS,
      progress: 1,
      target: 2,
      version: 4,
      claimedAt: new Date('2026-03-31T08:00:00.000Z'),
    })
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.consumeEventProgress({
        bizKey: 'comment:create:18:user:9',
        eventEnvelope: {
          code: GrowthRuleTypeEnum.CREATE_COMMENT,
          key: 'CREATE_COMMENT',
          subjectType: 'user',
          subjectId: 9,
          targetType: 'comment',
          targetId: 18,
          operatorId: 9,
          occurredAt: new Date('2026-03-31T09:00:00.000Z'),
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
          context: {
            sectionId: 10,
          },
        },
      }),
    ).resolves.toEqual({
      matchedTaskIds: [11],
      progressedAssignmentIds: [],
      completedAssignmentIds: [21],
      duplicateAssignmentIds: [],
    })

    expect(txHarness.values).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 21,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.COMPLETE,
        progressSource: TaskProgressSourceEnum.EVENT,
        eventCode: GrowthRuleTypeEnum.CREATE_COMMENT,
        eventBizKey: 'comment:create:18:user:9',
      }),
    )
    expect(txHarness.set).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: 2,
        status: TaskAssignmentStatusEnum.COMPLETED,
        completedAt: new Date('2026-03-31T09:00:00.000Z'),
      }),
    )
    expect(emitTaskCompleteEvent).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ id: 11 }),
      expect.objectContaining({ id: 21 }),
    )
  })

  it('does not re-apply duplicate event bizKeys for the same assignment', async () => {
    const { GrowthRuleTypeEnum } = await import('../../growth-rule.constant')
    const { EventEnvelopeGovernanceStatusEnum } = await import(
      '../../event-definition/event-envelope.type'
    )
    const txHarness = createEventProgressTransactionHarness({ duplicate: true })
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {
            assignmentId: 'assignmentId',
            eventBizKey: 'eventBizKey',
            id: 'id',
          },
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )
    jest.spyOn(service as any, 'findEventProgressTasks').mockResolvedValue([
      {
        id: 11,
        claimMode: TaskClaimModeEnum.AUTO,
        completeMode: TaskCompleteModeEnum.AUTO,
        objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
        eventCode: GrowthRuleTypeEnum.CREATE_COMMENT,
        objectiveConfig: null,
        repeatRule: { type: TaskRepeatTypeEnum.ONCE },
      },
    ])
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 21,
      status: TaskAssignmentStatusEnum.IN_PROGRESS,
      progress: 1,
      target: 2,
      version: 4,
      claimedAt: new Date('2026-03-31T08:00:00.000Z'),
    })
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.consumeEventProgress({
        bizKey: 'comment:create:18:user:9',
        eventEnvelope: {
          code: GrowthRuleTypeEnum.CREATE_COMMENT,
          key: 'CREATE_COMMENT',
          subjectType: 'user',
          subjectId: 9,
          targetType: 'comment',
          targetId: 18,
          occurredAt: new Date('2026-03-31T09:00:00.000Z'),
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
        },
      }),
    ).resolves.toEqual({
      matchedTaskIds: [11],
      progressedAssignmentIds: [],
      completedAssignmentIds: [],
      duplicateAssignmentIds: [21],
    })

    expect(txHarness.set).not.toHaveBeenCalled()
    expect(emitTaskCompleteEvent).not.toHaveBeenCalled()
  })

  it('does not backfill pre-claim events for MANUAL EVENT_COUNT tasks', async () => {
    const { GrowthRuleTypeEnum } = await import('../../growth-rule.constant')
    const { EventEnvelopeGovernanceStatusEnum } = await import(
      '../../event-definition/event-envelope.type'
    )
    const withTransaction = jest.fn()

    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {
          taskAssignment: { version: 'version', id: 'id' },
          taskProgressLog: {
            assignmentId: 'assignmentId',
            eventBizKey: 'eventBizKey',
            id: 'id',
          },
        },
        withTransaction,
      } as any,
      {} as any,
      {} as any,
    )
    jest.spyOn(service as any, 'findEventProgressTasks').mockResolvedValue([
      {
        id: 11,
        claimMode: TaskClaimModeEnum.MANUAL,
        completeMode: TaskCompleteModeEnum.MANUAL,
        objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
        eventCode: GrowthRuleTypeEnum.CREATE_COMMENT,
        objectiveConfig: null,
        repeatRule: { type: TaskRepeatTypeEnum.ONCE },
      },
    ])
    jest.spyOn(service as any, 'findAssignmentByUniqueKey').mockResolvedValue({
      id: 21,
      status: TaskAssignmentStatusEnum.PENDING,
      progress: 0,
      target: 2,
      version: 4,
      claimedAt: new Date('2026-03-31T10:00:00.000Z'),
    })

    await expect(
      service.consumeEventProgress({
        bizKey: 'comment:create:18:user:9',
        eventEnvelope: {
          code: GrowthRuleTypeEnum.CREATE_COMMENT,
          key: 'CREATE_COMMENT',
          subjectType: 'user',
          subjectId: 9,
          targetType: 'comment',
          targetId: 18,
          occurredAt: new Date('2026-03-31T09:00:00.000Z'),
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
        },
      }),
    ).resolves.toEqual({
      matchedTaskIds: [11],
      progressedAssignmentIds: [],
      completedAssignmentIds: [],
      duplicateAssignmentIds: [],
    })

    expect(withTransaction).not.toHaveBeenCalled()
  })

  it('rejects task actions after publishEndAt even before cron expires assignments', async () => {
    const service = await createTaskExecutionService(
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
    const service = await createTaskExecutionService(
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
    const update = jest.fn()
    const service = await createTaskDefinitionService(
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
    const selectHarness = createSimpleSelectHarness([{ id: 101 }])
    const update = jest.fn()

    const service = await createTaskDefinitionService(
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

  it('blocks changing publish window when active assignments already exist', async () => {
    const selectHarness = createSimpleSelectHarness([{ id: 101 }])
    const update = jest.fn()

    const service = await createTaskDefinitionService(
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
          publishEndAt: new Date('2026-04-18T00:00:00.000Z'),
        } as any,
        9,
      ),
    ).rejects.toThrow('存在进行中的任务分配，不能修改发布时间窗口')

    expect(update).not.toHaveBeenCalled()
  })

  it('returns only manual tasks that are still claimable in current cycle', async () => {
    const taskSelectHarness = createOrderedSelectHarness([
      {
        id: 101,
        createdAt: new Date('2026-03-29T00:00:00.000Z'),
        updatedAt: new Date('2026-03-29T00:00:00.000Z'),
        code: 'manual_available',
        title: '可领取手动任务',
        description: '尚未领取',
        cover: null,
        type: TaskTypeEnum.DAILY,
        priority: 20,
        claimMode: TaskClaimModeEnum.MANUAL,
        completeMode: TaskCompleteModeEnum.MANUAL,
        targetCount: 1,
        rewardConfig: { points: 10 },
        publishStartAt: null,
        publishEndAt: null,
        repeatRule: { type: TaskRepeatTypeEnum.DAILY },
      },
      {
        id: 102,
        createdAt: new Date('2026-03-29T00:00:00.000Z'),
        updatedAt: new Date('2026-03-29T00:00:00.000Z'),
        code: 'manual_claimed',
        title: '已领取手动任务',
        description: '当前周期已有 assignment',
        cover: null,
        type: TaskTypeEnum.DAILY,
        priority: 10,
        claimMode: TaskClaimModeEnum.MANUAL,
        completeMode: TaskCompleteModeEnum.MANUAL,
        targetCount: 1,
        rewardConfig: { points: 5 },
        publishStartAt: null,
        publishEndAt: null,
        repeatRule: { type: TaskRepeatTypeEnum.DAILY },
      },
      {
        id: 103,
        createdAt: new Date('2026-03-29T00:00:00.000Z'),
        updatedAt: new Date('2026-03-29T00:00:00.000Z'),
        code: 'auto_task',
        title: '自动任务',
        description: '不应出现在可领取页',
        cover: null,
        type: TaskTypeEnum.DAILY,
        priority: 30,
        claimMode: TaskClaimModeEnum.AUTO,
        completeMode: TaskCompleteModeEnum.AUTO,
        targetCount: 1,
        rewardConfig: { points: 2 },
        publishStartAt: null,
        publishEndAt: null,
        repeatRule: { type: TaskRepeatTypeEnum.DAILY },
      },
    ])
    const assignmentFrom = jest.fn(() => ({
      where: jest.fn().mockResolvedValue([
        {
          taskId: 102,
          cycleKey: '2026-03-30',
        },
      ]),
    }))
    const select = jest
      .fn()
      .mockImplementationOnce(() => ({ from: taskSelectHarness.from }))
      .mockImplementationOnce(() => ({ from: assignmentFrom }))

    const service = await createTaskExecutionService(
      {
        db: { select },
        schema: {
          task: {
            priority: 'priority',
            createdAt: 'createdAt',
          },
          taskAssignment: {
            taskId: 'taskId',
            cycleKey: 'cycleKey',
            userId: 'userId',
            deletedAt: 'deletedAt',
          },
        },
        buildPage: jest.fn(() => ({
          pageIndex: 1,
          pageSize: 20,
          limit: 20,
          offset: 0,
        })),
      } as any,
      {} as any,
      {} as any,
    )
    jest
      .spyOn(service as any, 'ensureAutoAssignmentsForUser')
      .mockResolvedValue(undefined)
    jest
      .spyOn(service as any, 'tryNotifyAvailableTasksFromPage')
      .mockResolvedValue(undefined)
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-03-30T10:15:00.000Z'))

    const result = await service.getAvailableTasks(
      { pageIndex: 1, pageSize: 20 } as any,
      9,
    )

    expect(result.list).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.list[0]).toMatchObject({
      id: 101,
      code: 'manual_available',
      claimMode: TaskClaimModeEnum.MANUAL,
    })
  })

  it.each([
    [
      'daily',
      { type: TaskRepeatTypeEnum.DAILY },
      '2026-03-30T16:00:00.000Z',
      '2026-03-30T10:15:00.000Z',
    ],
    [
      'weekly',
      { type: TaskRepeatTypeEnum.WEEKLY },
      '2026-04-05T16:00:00.000Z',
      '2026-03-30T10:15:00.000Z',
    ],
    [
      'monthly',
      { type: TaskRepeatTypeEnum.MONTHLY },
      '2026-03-31T16:00:00.000Z',
      '2026-03-30T10:15:00.000Z',
    ],
  ])(
    'builds cycle-based expiredAt for %s tasks',
    async (_label, repeatRule, expectedExpiredAt, nowValue) => {
      const service = await createTaskExecutionService(
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
    const txHarness = createExpireTransactionHarness([
      { assignmentId: 21, userId: 9, progress: 2 },
      { assignmentId: 22, userId: 9, progress: 0 },
    ])
    const withTransaction = jest.fn(async (callback) => callback(txHarness.tx))

    const service = await createTaskRuntimeService(
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
      {} as any,
    )

    await expect(service.expireAssignments()).resolves.toBeUndefined()

    expect(txHarness.logValues).toHaveBeenCalledWith([
      {
        assignmentId: 21,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.EXPIRE,
        progressSource: TaskProgressSourceEnum.SYSTEM,
        delta: 0,
        beforeValue: 2,
        afterValue: 2,
        eventCode: null,
        eventBizKey: null,
        eventOccurredAt: null,
        context: undefined,
      },
      {
        assignmentId: 22,
        userId: 9,
        actionType: TaskProgressActionTypeEnum.EXPIRE,
        progressSource: TaskProgressSourceEnum.SYSTEM,
        delta: 0,
        beforeValue: 0,
        afterValue: 0,
        eventCode: null,
        eventBizKey: null,
        eventOccurredAt: null,
        context: undefined,
      },
    ])
  })

  it('expires active assignments when deleting a task', async () => {
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

    const service = await createTaskDefinitionService(
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
        progressSource: TaskProgressSourceEnum.SYSTEM,
        delta: 0,
        beforeValue: 2,
        afterValue: 2,
        eventCode: null,
        eventBizKey: null,
        eventOccurredAt: null,
        context: undefined,
      },
    ])
  })

  it('expires overdue assignments before rebuilding auto assignments in my tasks', async () => {
    const service = await createTaskExecutionService(
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

  it('queries assignment pages with a stable task summary and avoids task join in plain count queries', async () => {
    const queryHarness = createTaskAssignmentPageQueryHarness(
      [
        {
          assignment: {
            id: 88,
            taskId: 7,
          },
          task: {
            id: 7,
            code: 'daily_read',
            title: '每日阅读',
            description: '阅读任意章节',
            cover: 'https://example.com/task.png',
            type: TaskTypeEnum.DAILY,
            objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
            eventCode: 300,
            objectiveConfig: { sectionId: 10 },
            rewardConfig: { points: 3 },
            targetCount: 1,
            completeMode: TaskCompleteModeEnum.AUTO,
            claimMode: TaskClaimModeEnum.MANUAL,
          },
        },
      ],
      [{ count: 3 }],
    )
    const buildOrderBy = jest.fn().mockReturnValue({
      orderBy: { id: 'desc' },
      orderBySql: [sql`task_assignment.id desc`],
    })
    const buildPage = jest.fn().mockReturnValue({
      pageIndex: 2,
      pageSize: 10,
      limit: 10,
      offset: 10,
    })
    const service = await createTaskExecutionService(
      {
        db: {
          select: queryHarness.select,
        },
        schema: {
          taskAssignment: {
            id: 'assignment.id',
            taskId: 'assignment.taskId',
          },
          task: {
            id: 'task.id',
            code: 'task.code',
            title: 'task.title',
            description: 'task.description',
            cover: 'task.cover',
            type: 'task.type',
            objectiveType: 'task.objectiveType',
            eventCode: 'task.eventCode',
            objectiveConfig: 'task.objectiveConfig',
            rewardConfig: 'task.rewardConfig',
            targetCount: 'task.targetCount',
            completeMode: 'task.completeMode',
            claimMode: 'task.claimMode',
          },
        },
        buildOrderBy,
        buildPage,
      } as any,
      {} as any,
      {} as any,
    )

    const result = await (service as any).queryTaskAssignmentPage({
      assignmentWhereClause: sql`task_assignment.user_id = 9`,
      pageIndex: 2,
      pageSize: 10,
    })

    expect(buildPage).toHaveBeenCalledWith({
      pageIndex: 2,
      pageSize: 10,
    })
    expect(buildOrderBy).toHaveBeenCalled()
    expect(queryHarness.countLeftJoin).not.toHaveBeenCalled()
    expect(queryHarness.listOrderBy).toHaveBeenCalledTimes(1)
    expect(
      Object.keys(
        (queryHarness.getListSelection() as { task: Record<string, unknown> }).task,
      ),
    ).toEqual([
      'id',
      'code',
      'title',
      'description',
      'cover',
      'type',
      'objectiveType',
      'eventCode',
      'objectiveConfig',
      'rewardConfig',
      'targetCount',
      'completeMode',
      'claimMode',
    ])
    expect(result).toMatchObject({
      total: 3,
      pageIndex: 2,
      pageSize: 10,
      list: [
        {
          id: 88,
          taskId: 7,
          task: {
            id: 7,
            code: 'daily_read',
            title: '每日阅读',
            description: '阅读任意章节',
            cover: 'https://example.com/task.png',
            type: TaskTypeEnum.DAILY,
            objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
            targetCount: 1,
            completeMode: TaskCompleteModeEnum.AUTO,
            claimMode: TaskClaimModeEnum.MANUAL,
          },
        },
      ],
    })
  })

  it('joins task in count queries when task-side filters are present', async () => {
    const queryHarness = createTaskAssignmentPageQueryHarness([], [{ count: 0 }])
    const service = await createTaskExecutionService(
      {
        db: {
          select: queryHarness.select,
        },
        schema: {
          taskAssignment: {
            id: 'assignment.id',
            taskId: 'assignment.taskId',
          },
          task: {
            id: 'task.id',
            code: 'task.code',
            title: 'task.title',
            description: 'task.description',
            cover: 'task.cover',
            type: 'task.type',
            objectiveType: 'task.objectiveType',
            eventCode: 'task.eventCode',
            objectiveConfig: 'task.objectiveConfig',
            rewardConfig: 'task.rewardConfig',
            targetCount: 'task.targetCount',
            completeMode: 'task.completeMode',
            claimMode: 'task.claimMode',
          },
        },
        buildOrderBy: jest.fn().mockReturnValue({
          orderBy: { id: 'desc' },
          orderBySql: [sql`task_assignment.id desc`],
        }),
        buildPage: jest.fn().mockReturnValue({
          pageIndex: 1,
          pageSize: 20,
          limit: 20,
          offset: 0,
        }),
      } as any,
      {} as any,
      {} as any,
    )

    await (service as any).queryTaskAssignmentPage({
      assignmentWhereClause: sql`task_assignment.user_id = 9`,
      taskWhereClause: sql`task.type = 3`,
    })

    expect(queryHarness.countLeftJoin).toHaveBeenCalledTimes(1)
  })

  it('maps my tasks with snapshot fallback and reward pending visible status', async () => {
    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {
          taskAssignment: {
            userId: 'userId',
            deletedAt: 'deletedAt',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )
    jest
      .spyOn(service as any, 'expireDueAssignmentsForUser')
      .mockResolvedValue(undefined)
    jest
      .spyOn(service as any, 'ensureAutoAssignmentsForUser')
      .mockResolvedValue(undefined)
    jest.spyOn(service as any, 'queryTaskAssignmentPage').mockResolvedValue({
      list: [
        {
          id: 31,
          createdAt: new Date('2026-03-31T00:00:00.000Z'),
          updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          taskId: 7,
          userId: 9,
          cycleKey: '2026-03-31',
          status: TaskAssignmentStatusEnum.COMPLETED,
          rewardStatus: TaskAssignmentRewardStatusEnum.PENDING,
          rewardResultType: null,
          progress: 1,
          target: 1,
          version: 1,
          claimedAt: new Date('2026-03-31T00:00:00.000Z'),
          completedAt: new Date('2026-03-31T01:00:00.000Z'),
          expiredAt: null,
          rewardSettledAt: null,
          rewardLedgerIds: [],
          lastRewardError: 'reward pending',
          taskSnapshot: {
            id: 7,
            code: 'complete_profile',
            title: '完善资料',
            description: '上传头像并设置昵称',
            type: TaskTypeEnum.ONBOARDING,
            objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
            eventCode: 10,
            rewardConfig: { points: 5 },
            targetCount: 1,
            completeMode: TaskCompleteModeEnum.MANUAL,
            claimMode: TaskClaimModeEnum.MANUAL,
          },
          task: null,
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
    })

    const result = await service.getMyTasks(
      { pageIndex: 1, pageSize: 20 } as any,
      9,
    )

    expect(result.list[0]).toMatchObject({
      visibleStatus: TaskUserVisibleStatusEnum.REWARD_PENDING,
      rewardStatus: TaskAssignmentRewardStatusEnum.PENDING,
      lastRewardError: 'reward pending',
      task: {
        id: 7,
        code: 'complete_profile',
        title: '完善资料',
        description: '上传头像并设置昵称',
        type: TaskTypeEnum.ONBOARDING,
        objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
      },
    })
  })

  it('enriches admin task page rows with runtime health summary', async () => {
    const findPagination = jest.fn().mockResolvedValue({
      list: [
        {
          id: 7,
          createdAt: new Date('2026-03-31T00:00:00.000Z'),
          updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          code: 'daily_read',
          title: '每日阅读',
          description: '阅读任意章节',
          cover: null,
          type: 3,
          status: TaskStatusEnum.PUBLISHED,
          priority: 10,
          isEnabled: true,
          claimMode: TaskClaimModeEnum.MANUAL,
          completeMode: TaskCompleteModeEnum.AUTO,
          objectiveType: TaskObjectiveTypeEnum.EVENT_COUNT,
          eventCode: 300,
          objectiveConfig: null,
          targetCount: 1,
          rewardConfig: { points: 3 },
          publishStartAt: null,
          publishEndAt: null,
          repeatRule: { type: TaskRepeatTypeEnum.DAILY },
          createdById: 1,
          updatedById: 1,
          deletedAt: null,
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
    })

    const service = await createTaskDefinitionService(
      {
        db: {},
        schema: { task: { deletedAt: 'deletedAt' } },
        ext: { findPagination },
      } as any,
      {} as any,
      {} as any,
    )
    jest.spyOn(service as any, 'getTaskRuntimeHealthMap').mockResolvedValue(
      new Map([
        [
          7,
          {
            activeAssignmentCount: 12,
            pendingRewardCompensationCount: 2,
            latestReminder: {
              reminderKind: 'task_reward_granted',
              status: 'delivered',
              failureReason: null,
              lastAttemptAt: new Date('2026-03-31T08:00:00.000Z'),
              updatedAt: new Date('2026-03-31T08:00:01.000Z'),
            },
          },
        ],
      ]),
    )

    const result = await service.getTaskPage({ pageIndex: 1, pageSize: 20 } as any)

    expect(result.list[0]).toMatchObject({
      id: 7,
      type: TaskTypeEnum.DAILY,
      activeAssignmentCount: 12,
      pendingRewardCompensationCount: 2,
      latestReminder: {
        reminderKind: 'task_reward_granted',
        status: 'delivered',
      },
    })
  })

  it('maps admin task assignment page rows to unified visible status', async () => {
    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {
          taskAssignment: {
            deletedAt: 'deletedAt',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )
    jest.spyOn(service as any, 'queryTaskAssignmentPage').mockResolvedValue({
      list: [
        {
          id: 88,
          createdAt: new Date('2026-03-31T00:00:00.000Z'),
          updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          taskId: 7,
          userId: 9,
          cycleKey: '2026-03-31',
          status: TaskAssignmentStatusEnum.COMPLETED,
          rewardStatus: TaskAssignmentRewardStatusEnum.SUCCESS,
          rewardResultType: TaskAssignmentRewardResultTypeEnum.APPLIED,
          progress: 1,
          target: 1,
          version: 1,
          claimedAt: new Date('2026-03-31T00:00:00.000Z'),
          completedAt: new Date('2026-03-31T01:00:00.000Z'),
          expiredAt: null,
          rewardSettledAt: new Date('2026-03-31T01:00:01.000Z'),
          rewardLedgerIds: [201],
          lastRewardError: null,
          taskSnapshot: {
            id: 7,
            code: 'daily_read',
            title: '每日阅读',
            type: TaskTypeEnum.DAILY,
            rewardConfig: { points: 3 },
            targetCount: 1,
            completeMode: TaskCompleteModeEnum.AUTO,
            claimMode: TaskClaimModeEnum.MANUAL,
          },
          task: null,
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
    })

    const result = await service.getTaskAssignmentPage({
      pageIndex: 1,
      pageSize: 20,
    } as any)

    expect(result.list[0]).toMatchObject({
      id: 88,
      visibleStatus: TaskUserVisibleStatusEnum.REWARD_GRANTED,
      task: {
        id: 7,
        code: 'daily_read',
        title: '每日阅读',
      },
    })
  })

  it('builds reconciliation rows with latest event and reward reminder summary', async () => {
    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {
          taskAssignment: {
            deletedAt: 'deletedAt',
          },
        },
      } as any,
      {} as any,
      {} as any,
    )
    jest
      .spyOn(service as any, 'queryAssignmentIdsByEventFilter')
      .mockResolvedValue(undefined)
    jest
      .spyOn(service as any, 'queryAssignmentIdsByRewardReminderFilter')
      .mockResolvedValue(undefined)
    jest.spyOn(service as any, 'queryTaskAssignmentPage').mockResolvedValue({
      list: [
        {
          id: 88,
          createdAt: new Date('2026-03-31T00:00:00.000Z'),
          updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          taskId: 7,
          userId: 9,
          cycleKey: '2026-03-31',
          status: TaskAssignmentStatusEnum.COMPLETED,
          rewardStatus: TaskAssignmentRewardStatusEnum.FAILED,
          rewardResultType: TaskAssignmentRewardResultTypeEnum.FAILED,
          progress: 1,
          target: 1,
          version: 1,
          claimedAt: new Date('2026-03-31T00:00:00.000Z'),
          completedAt: new Date('2026-03-31T01:00:00.000Z'),
          expiredAt: null,
          rewardSettledAt: null,
          rewardLedgerIds: [],
          lastRewardError: 'timeout',
          taskSnapshot: {
            id: 7,
            code: 'daily_read',
            title: '每日阅读',
            type: TaskTypeEnum.DAILY,
            rewardConfig: { points: 3 },
            targetCount: 1,
          },
          task: null,
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
    })
    jest.spyOn(service as any, 'getAssignmentEventProgressMap').mockResolvedValue(
      new Map([
        [
          88,
          {
            eventCode: 10,
            eventBizKey: 'comment:create:topic:100:user:9',
            eventOccurredAt: new Date('2026-03-31T00:30:00.000Z'),
          },
        ],
      ]),
    )
    jest
      .spyOn(service as any, 'getAssignmentRewardReminderMap')
      .mockResolvedValue(
        new Map([
          [
            88,
            {
              bizKey: 'task:reminder:reward:assignment:88',
              status: 'failed',
              failureReason: 'template missing',
              lastAttemptAt: new Date('2026-03-31T01:00:01.000Z'),
            },
          ],
        ]),
      )

    const result = await service.getTaskAssignmentReconciliationPage({
      pageIndex: 1,
      pageSize: 20,
    } as any)

    expect(result.list[0]).toMatchObject({
      id: 88,
      visibleStatus: TaskUserVisibleStatusEnum.REWARD_PENDING,
      latestEventCode: 10,
      latestEventBizKey: 'comment:create:topic:100:user:9',
      rewardReminder: {
        bizKey: 'task:reminder:reward:assignment:88',
        status: 'failed',
        failureReason: 'template missing',
      },
    })
  })

  it('retries a single completed assignment reward through task complete event', async () => {
    const service = await createTaskExecutionService(
      {
        db: {},
        schema: {},
      } as any,
      {} as any,
      {} as any,
    )
    const emitTaskCompleteEvent = jest
      .spyOn(service as any, 'emitTaskCompleteEvent')
      .mockResolvedValue(undefined)
    Object.defineProperty(service as any, 'db', {
      value: {
        query: {
          taskAssignment: {
            findFirst: jest.fn().mockResolvedValue({
              id: 88,
              taskId: 7,
              userId: 9,
              status: TaskAssignmentStatusEnum.COMPLETED,
              rewardStatus: TaskAssignmentRewardStatusEnum.FAILED,
              completedAt: new Date('2026-03-31T01:00:00.000Z'),
              taskSnapshot: {
                id: 7,
                code: 'daily_read',
                title: '每日阅读',
                type: TaskTypeEnum.DAILY,
                rewardConfig: { points: 3 },
              },
              task: {
                code: 'daily_read',
                title: '每日阅读',
                type: TaskTypeEnum.DAILY,
                rewardConfig: { points: 3 },
              },
            }),
          },
        },
      },
    })

    await expect(service.retryTaskAssignmentReward(88)).resolves.toBe(true)
    expect(emitTaskCompleteEvent).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        id: 7,
        rewardConfig: { points: 3 },
      }),
      expect.objectContaining({ id: 88 }),
    )
  })
})

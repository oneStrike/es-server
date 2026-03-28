import {
  TaskAssignmentRewardResultTypeEnum,
  TaskAssignmentRewardStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
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
})

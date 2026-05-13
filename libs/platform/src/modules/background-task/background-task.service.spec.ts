import { BusinessException } from '@libs/platform/exceptions'
import {
  BackgroundTaskStatusEnum,
  BACKGROUND_TASK_DEFAULT_MAX_RETRY,
} from './background-task.constant'
import { BackgroundTaskService } from './background-task.service'

describe('BackgroundTaskService', () => {
  function createBackgroundTaskRow(overrides: Record<string, unknown> = {}) {
    const now = new Date('2026-05-13T03:00:00.000Z')
    return {
      id: 1,
      taskId: 'task-1',
      taskType: 'content.third-party-comic-import',
      status: BackgroundTaskStatusEnum.PROCESSING,
      payload: { comicId: 'comic-1' },
      progress: { percent: 0, message: '处理中' },
      result: null,
      error: null,
      residue: null,
      rollbackError: null,
      retryCount: 0,
      maxRetries: BACKGROUND_TASK_DEFAULT_MAX_RETRY,
      cancelRequestedAt: null,
      claimedBy: 'worker-1',
      claimExpiresAt: now,
      startedAt: now,
      finalizingAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  function createInsertChain(row: Record<string, unknown>) {
    const returning = jest.fn(async () => [row])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))

    return { insert, returning, values }
  }

  function createService(row: Record<string, unknown>) {
    const insertChain = createInsertChain(row)
    const drizzle = {
      db: {
        insert: insertChain.insert,
      },
      schema: {
        backgroundTask: {},
      },
      withErrorHandling: jest.fn((fn) => fn()),
    }
    const registry = {
      has: jest.fn(() => true),
    }

    return {
      drizzle,
      insertChain,
      registry,
      service: new BackgroundTaskService(drizzle as never, registry as never),
    }
  }

  it('creates pending task records without executing handler work', async () => {
    const createdAt = new Date('2026-05-13T03:00:00.000Z')
    const { insertChain, registry, service } = createService({
      id: 1n,
      taskId: 'task-1',
      taskType: 'content.third-party-comic-import',
      status: BackgroundTaskStatusEnum.PENDING,
      payload: { comicId: 'comic-1' },
      progress: { percent: 0, message: '等待执行' },
      result: null,
      error: null,
      residue: null,
      rollbackError: null,
      retryCount: 0,
      maxRetries: BACKGROUND_TASK_DEFAULT_MAX_RETRY,
      cancelRequestedAt: null,
      claimedBy: null,
      claimExpiresAt: null,
      startedAt: null,
      finalizingAt: null,
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    })

    const task = await service.createTask({
      taskType: 'content.third-party-comic-import',
      payload: { comicId: 'comic-1' },
    })

    expect(registry.has).toHaveBeenCalledWith(
      'content.third-party-comic-import',
    )
    expect(insertChain.insert).toHaveBeenCalled()
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'content.third-party-comic-import',
        status: BackgroundTaskStatusEnum.PENDING,
        payload: { comicId: 'comic-1' },
      }),
    )
    expect(task).toEqual(
      expect.objectContaining({
        taskId: 'task-1',
        taskType: 'content.third-party-comic-import',
        status: BackgroundTaskStatusEnum.PENDING,
      }),
    )
  })

  it('rejects creating tasks without a registered handler', async () => {
    const { registry, service } = createService({})
    registry.has.mockReturnValue(false)

    await expect(
      service.createTask({
        taskType: 'missing.handler',
        payload: {},
      }),
    ).rejects.toThrow(BusinessException)
  })

  it('rolls back instead of marking success when cancellation wins during finalizing', async () => {
    const cancelRequestedAt = new Date('2026-05-13T03:01:00.000Z')
    const row = createBackgroundTaskRow()
    const selectRows = [
      createBackgroundTaskRow({ cancelRequestedAt: null }),
      createBackgroundTaskRow({
        cancelRequestedAt: null,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
      createBackgroundTaskRow({
        cancelRequestedAt,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
      createBackgroundTaskRow({
        cancelRequestedAt,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
    ]
    const updateReturningRows = [
      [
        createBackgroundTaskRow({
          finalizingAt: cancelRequestedAt,
          status: BackgroundTaskStatusEnum.FINALIZING,
        }),
      ],
      [],
      [],
    ]
    const updateSets: Record<string, unknown>[] = []
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [selectRows.shift()]),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((value: Record<string, unknown>) => {
          updateSets.push(value)
          return {
            where: jest.fn(() => ({
              returning: jest.fn(async () => updateReturningRows.shift() ?? []),
            })),
          }
        }),
      })),
    }
    const drizzle = {
      db,
      schema: {
        backgroundTask: {},
      },
    }
    const handler = {
      taskType: 'content.third-party-comic-import',
      finalize: jest.fn(async () => ({ ok: true })),
      prepare: jest.fn(),
      rollback: jest.fn(async () => undefined),
    }
    const registry = {
      resolve: jest.fn(() => handler),
    }
    const service = new BackgroundTaskService(
      drizzle as never,
      registry as never,
    )

    await service.executeClaimedTask(row as never)

    expect(handler.finalize).toHaveBeenCalled()
    expect(handler.rollback).toHaveBeenCalled()
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: BackgroundTaskStatusEnum.CANCELLED }),
      ]),
    )
  })

  it('does not report a non-cancel success conflict as cancelled', async () => {
    const row = createBackgroundTaskRow()
    const selectRows = [
      createBackgroundTaskRow({ cancelRequestedAt: null }),
      createBackgroundTaskRow({
        cancelRequestedAt: null,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
      createBackgroundTaskRow({
        cancelRequestedAt: null,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
      createBackgroundTaskRow({
        cancelRequestedAt: null,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
    ]
    const updateReturningRows = [
      [
        createBackgroundTaskRow({
          status: BackgroundTaskStatusEnum.FINALIZING,
        }),
      ],
      [],
      [],
    ]
    const updateSets: Record<string, unknown>[] = []
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [selectRows.shift()]),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((value: Record<string, unknown>) => {
          updateSets.push(value)
          return {
            where: jest.fn(() => ({
              returning: jest.fn(async () => updateReturningRows.shift() ?? []),
            })),
          }
        }),
      })),
    }
    const drizzle = {
      db,
      schema: {
        backgroundTask: {},
      },
    }
    const handler = {
      taskType: 'content.third-party-comic-import',
      finalize: jest.fn(async () => ({ ok: true })),
      prepare: jest.fn(),
      rollback: jest.fn(async () => undefined),
    }
    const registry = {
      resolve: jest.fn(() => handler),
    }
    const service = new BackgroundTaskService(
      drizzle as never,
      registry as never,
    )

    await service.executeClaimedTask(row as never)

    expect(handler.rollback).toHaveBeenCalled()
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: BackgroundTaskStatusEnum.FAILED }),
      ]),
    )
    expect(updateSets).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: BackgroundTaskStatusEnum.CANCELLED }),
      ]),
    )
  })

  it('reclaims expired finalizing tasks and routes them into rollback recovery', async () => {
    const now = new Date('2026-05-13T03:00:00.000Z')
    const staleFinalizing = createBackgroundTaskRow({
      cancelRequestedAt: null,
      claimExpiresAt: new Date('2026-05-13T02:54:00.000Z'),
      finalizingAt: new Date('2026-05-13T02:53:00.000Z'),
      status: BackgroundTaskStatusEnum.FINALIZING,
    })
    const selectRows = [
      staleFinalizing,
      createBackgroundTaskRow({
        cancelRequestedAt: null,
        claimExpiresAt: new Date('2026-05-13T03:05:00.000Z'),
        finalizingAt: staleFinalizing.finalizingAt,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
    ]
    const updateReturningRows = [
      [
        createBackgroundTaskRow({
          claimExpiresAt: new Date('2026-05-13T03:05:00.000Z'),
          finalizingAt: staleFinalizing.finalizingAt,
          status: BackgroundTaskStatusEnum.FINALIZING,
        }),
      ],
      [],
    ]
    const updateSets: Record<string, unknown>[] = []
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            const limit = jest.fn(async () => [selectRows.shift()])
            return {
              limit,
              orderBy: jest.fn(() => ({
                limit,
              })),
            }
          }),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((value: Record<string, unknown>) => {
          updateSets.push(value)
          return {
            where: jest.fn(() => ({
              returning: jest.fn(async () => updateReturningRows.shift() ?? []),
            })),
          }
        }),
      })),
    }
    const drizzle = {
      db,
      schema: {
        backgroundTask: {},
      },
    }
    const handler = {
      taskType: 'content.third-party-comic-import',
      finalize: jest.fn(),
      prepare: jest.fn(),
      rollback: jest.fn(async () => undefined),
    }
    const registry = {
      resolve: jest.fn(() => handler),
    }
    const service = new BackgroundTaskService(
      drizzle as never,
      registry as never,
    )

    jest.useFakeTimers().setSystemTime(now)
    try {
      const claimed = await service.claimNextTask('worker-2')
      await service.executeClaimedTask(claimed as never)
    } finally {
      jest.useRealTimers()
    }

    expect(handler.prepare).not.toHaveBeenCalled()
    expect(handler.finalize).not.toHaveBeenCalled()
    expect(handler.rollback).toHaveBeenCalled()
    expect(updateSets[0]).toEqual(
      expect.objectContaining({
        claimedBy: 'worker-2',
        finalizingAt: staleFinalizing.finalizingAt,
        status: BackgroundTaskStatusEnum.FINALIZING,
      }),
    )
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: BackgroundTaskStatusEnum.FAILED }),
      ]),
    )
  })
})

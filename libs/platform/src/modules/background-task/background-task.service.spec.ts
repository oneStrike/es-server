import { BusinessException } from '@libs/platform/exceptions'
import { Logger } from '@nestjs/common'
import type { BackgroundTaskExecutionContext } from './types'
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

  function createPagingService() {
    const findPagination = jest.fn(async () => ({
      list: [createBackgroundTaskRow()],
      pageIndex: 1,
      pageSize: 10,
      total: 1,
    }))
    const drizzle = {
      db: {},
      ext: {
        findPagination,
      },
      schema: {
        backgroundTask: {
          createdAt: 'createdAt',
          id: 'id',
          status: 'status',
          taskId: 'taskId',
          taskType: 'taskType',
        },
      },
    }

    return {
      findPagination,
      service: new BackgroundTaskService(drizzle as never, {} as never),
    }
  }

  function collectDateValues(value: unknown) {
    const dates: Date[] = []
    const visited = new WeakSet<object>()

    function visit(item: unknown) {
      if (item instanceof Date) {
        dates.push(item)
        return
      }
      if (Array.isArray(item)) {
        item.forEach(visit)
        return
      }
      if (typeof item !== 'object' || item === null || visited.has(item)) {
        return
      }
      visited.add(item)
      Object.values(item).forEach(visit)
    }

    visit(value)
    return dates
  }

  function getLastPaginationWhere(findPagination: jest.Mock) {
    const lastCall = findPagination.mock.calls.at(-1)
    return lastCall?.[1]?.where
  }

  function createFailingExecutionHarness(error: Error, rollbackError?: Error) {
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
    ]
    const updateReturningRows = [
      [
        createBackgroundTaskRow({
          status: BackgroundTaskStatusEnum.FINALIZING,
        }),
      ],
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
      prepare: jest.fn(async () => undefined),
      finalize: jest.fn(async () => {
        throw error
      }),
      rollback: jest.fn(async () => {
        if (rollbackError) {
          throw rollbackError
        }
      }),
    }
    const registry = {
      resolve: jest.fn(() => handler),
    }
    const service = new BackgroundTaskService(
      drizzle as never,
      registry as never,
    )

    return { handler, row, service, updateSets }
  }

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

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

  it('filters page results from the created start datetime', async () => {
    const { findPagination, service } = createPagingService()

    await service.getTaskPage({
      pageIndex: 1,
      pageSize: 10,
      startDate: '2026-05-13 08:30:00',
    })

    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        where: expect.anything(),
      }),
    )
  })

  it('filters page results until the created end datetime', async () => {
    const { findPagination, service } = createPagingService()

    await service.getTaskPage({
      endDate: '2026-05-13 18:45:00',
      pageIndex: 1,
      pageSize: 10,
    })

    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        where: expect.anything(),
      }),
    )
  })

  it('normalizes date-only created end filters to the end of the app day', async () => {
    const { findPagination, service } = createPagingService()

    await service.getTaskPage({
      endDate: '2026-05-13',
      pageIndex: 1,
      pageSize: 10,
    })

    expect(
      collectDateValues(getLastPaginationWhere(findPagination)).map((date) =>
        date.toISOString(),
      ),
    ).toContain('2026-05-13T15:59:59.999Z')
  })

  it('ignores invalid created datetime filters without failing pagination', async () => {
    const { findPagination, service } = createPagingService()

    await service.getTaskPage({
      endDate: 'still-not-a-date',
      pageIndex: 1,
      pageSize: 10,
      startDate: 'not-a-date',
    })

    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        where: undefined,
      }),
    )
  })

  it('ignores impossible created datetime filters', async () => {
    const { findPagination, service } = createPagingService()

    await service.getTaskPage({
      endDate: '2026-02-31 18:45:00',
      pageIndex: 1,
      pageSize: 10,
    })

    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        where: undefined,
      }),
    )
  })

  it('accepts ISO created datetime filters', async () => {
    const { findPagination, service } = createPagingService()

    await service.getTaskPage({
      pageIndex: 1,
      pageSize: 10,
      startDate: '2026-05-13T08:30:00.000Z',
    })

    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        where: expect.anything(),
      }),
    )
  })

  it('rolls back instead of marking success when cancellation wins during finalizing', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
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
    expect(loggerErrorSpy).not.toHaveBeenCalled()
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

  it('creates monotonic progress reporter snapshots and renews the claim', async () => {
    const row = createBackgroundTaskRow()
    const selectRows = [
      createBackgroundTaskRow({ cancelRequestedAt: null }),
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
      [
        createBackgroundTaskRow({
          status: BackgroundTaskStatusEnum.SUCCESS,
        }),
      ],
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
    const handler = {
      taskType: 'content.third-party-comic-import',
      finalize: jest.fn(async (context: BackgroundTaskExecutionContext) => {
        const reporter = context.createProgressReporter({
          startPercent: 10,
          endPercent: 95,
          total: 4,
          stage: 'image-import',
          unit: 'image',
        })
        await reporter.advance({ message: '导入第 1 张图片' })
        await reporter.advance({ amount: 0, message: '刷新当前图片提示' })
        await reporter.advance({
          current: 4,
          detail: { providerImageId: 'image-004' },
          message: '图片导入完成',
        })
        await reporter.advance({
          current: 1,
          message: '迟到的旧进度不应回退当前图片',
        })
        return { ok: true }
      }),
      rollback: jest.fn(async () => undefined),
    }
    const service = new BackgroundTaskService(
      {
        db,
        schema: { backgroundTask: {} },
      } as never,
      { resolve: jest.fn(() => handler) } as never,
    )

    await service.executeClaimedTask(row as never)

    const progressUpdates = updateSets.filter((set) => 'progress' in set)
    expect(progressUpdates).toEqual([
      expect.objectContaining({
        claimExpiresAt: expect.any(Date),
        progress: expect.objectContaining({
          current: 1,
          percent: 31,
          stage: 'image-import',
          total: 4,
          unit: 'image',
        }),
      }),
      expect.objectContaining({
        progress: expect.objectContaining({
          current: 1,
          percent: 31,
          message: '刷新当前图片提示',
        }),
      }),
      expect.objectContaining({
        progress: expect.objectContaining({
          current: 4,
          detail: { providerImageId: 'image-004' },
          percent: 95,
          total: 4,
        }),
      }),
      expect.objectContaining({
        progress: expect.objectContaining({
          current: 4,
          message: '迟到的旧进度不应回退当前图片',
          percent: 95,
          total: 4,
        }),
      }),
    ])
  })

  it('persists sanitized failure cause when rollback succeeds', async () => {
    const error = new Error('Superbed 上传失败', {
      cause: {
        provider: 'superbed',
        operation: 'upload',
        transportCode: 'ECONNABORTED',
        token: 'secret-token',
        responseData: {
          err: 1,
          msg: 'timeout',
          token: 'secret-token',
        },
      },
    })
    const { row, service, updateSets } = createFailingExecutionHarness(error)

    await service.executeClaimedTask(row as never)

    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: BackgroundTaskStatusEnum.FAILED,
          error: {
            name: 'Error',
            message: 'Superbed 上传失败',
            cause: {
              provider: 'superbed',
              operation: 'upload',
              transportCode: 'ECONNABORTED',
              responseData: {
                err: 1,
                msg: 'timeout',
              },
            },
          },
        }),
      ]),
    )

    const failedUpdate = updateSets.find(
      (set) => set.status === BackgroundTaskStatusEnum.FAILED,
    )
    const serializedPersistedError = JSON.stringify(failedUpdate?.error)
    expect(serializedPersistedError).not.toContain('secret-token')
    expect(serializedPersistedError).not.toMatch(
      /authorization|cookie|headers|body|form|config|request|password|secret|token/i,
    )
  })

  it('logs sanitized diagnostics for ordinary task failures', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
    const error = new Error('Superbed 上传失败', {
      cause: {
        provider: 'superbed',
        operation: 'upload',
        transportCode: 'ECONNABORTED',
        token: 'secret-token',
        responseData: {
          err: 1,
          msg: 'timeout',
          token: 'secret-token',
        },
      },
    })
    const { row, service } = createFailingExecutionHarness(error)

    await service.executeClaimedTask(row as never)

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'background_task_failed',
        taskId: 'task-1',
        taskType: 'content.third-party-comic-import',
        error: expect.objectContaining({
          message: 'Superbed 上传失败',
          cause: expect.objectContaining({
            provider: 'superbed',
            operation: 'upload',
            transportCode: 'ECONNABORTED',
          }),
        }),
      }),
    )

    const serializedLogPayload = JSON.stringify(
      loggerErrorSpy.mock.calls.flat(),
    )
    expect(serializedLogPayload).not.toContain('secret-token')
    expect(serializedLogPayload).not.toMatch(
      /authorization|cookie|headers|body|form|config|request|password|secret|token/i,
    )
  })

  it('redacts sensitive values embedded in persisted errors and failure logs', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
    const error = new Error('token = secret-token upload failed', {
      cause: {
        provider: 'superbed',
        operation: 'upload',
        message: 'authorization: secret-token',
        responseData: {
          err: 1,
          msg: 'token = secret-token',
          message: '"token": "secret-token"',
          error: 'Bearer secret-token',
        },
        nestedError: new Error('token = secret-token nested'),
      },
    })
    const { row, service, updateSets } = createFailingExecutionHarness(error)

    await service.executeClaimedTask(row as never)

    const failedUpdate = updateSets.find(
      (set) => set.status === BackgroundTaskStatusEnum.FAILED,
    )
    expect(failedUpdate?.error).toEqual({
      name: 'Error',
      message: '[REDACTED] upload failed',
      cause: {
        provider: 'superbed',
        operation: 'upload',
        message: '[REDACTED]',
        responseData: {
          err: 1,
          msg: '[REDACTED]',
          message: '"[REDACTED]"',
          error: 'Bearer [REDACTED]',
        },
        nestedError: {
          name: 'Error',
          message: '[REDACTED] nested',
        },
      },
    })

    const serializedPersistedError = JSON.stringify(failedUpdate?.error)
    const serializedLogPayload = JSON.stringify(
      loggerErrorSpy.mock.calls.flat(),
    )
    expect(serializedPersistedError).not.toContain('secret-token')
    expect(serializedLogPayload).not.toContain('secret-token')
  })

  it('logs sanitized rollback failure diagnostics', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
    const error = new Error('Superbed 上传失败', {
      cause: {
        provider: 'superbed',
        operation: 'upload',
      },
    })
    const rollbackError = new Error('token = secret-token rollback failed', {
      cause: {
        message: 'authorization: secret-token',
        responseData: {
          msg: 'Bearer secret-token',
          error: '"token": "secret-token"',
        },
      },
    })
    const { row, service, updateSets } = createFailingExecutionHarness(
      error,
      rollbackError,
    )

    await service.executeClaimedTask(row as never)

    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: BackgroundTaskStatusEnum.ROLLBACK_FAILED,
          error: expect.objectContaining({
            message: 'Superbed 上传失败',
          }),
          rollbackError: {
            name: 'Error',
            message: '[REDACTED] rollback failed',
            cause: {
              message: '[REDACTED]',
              responseData: {
                msg: 'Bearer [REDACTED]',
                error: '"[REDACTED]"',
              },
            },
          },
        }),
      ]),
    )
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'background_task_rollback_failed',
        taskId: 'task-1',
        taskType: 'content.third-party-comic-import',
        error: expect.objectContaining({
          message: 'Superbed 上传失败',
        }),
        rollbackError: expect.objectContaining({
          message: '[REDACTED] rollback failed',
        }),
      }),
    )
    const serializedLogPayload = JSON.stringify(
      loggerErrorSpy.mock.calls.flat(),
    )
    expect(serializedLogPayload).not.toContain('secret-token')
    expect(serializedLogPayload).not.toMatch(
      /authorization|cookie|headers|body|form|config|request|password|secret|token/i,
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

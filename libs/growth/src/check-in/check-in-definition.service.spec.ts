import type { DrizzleService } from '@db/core'
import { BusinessException } from '@libs/platform/exceptions'
import { CheckInDefinitionService } from './check-in-definition.service'
import {
  CheckInActivityStreakStatusEnum,
  CheckInDailyStreakConfigStatusEnum,
  CheckInDailyStreakPublishStrategyEnum,
} from './check-in.constant'

function createDefinitionHarness(options?: {
  currentDailyConfig?: Record<string, unknown> | null
  latestDailyConfig?: Record<string, unknown> | null
  dailyHistoryPage?: Record<string, unknown>
  dailyHistoryDetail?: Record<string, unknown> | null
  activityDetail?: Record<string, unknown> | null
  activityPage?: Record<string, unknown>
  activityProgress?: Record<string, unknown> | null
  streakGrant?: Record<string, unknown> | null
}) {
  const insertPayloads: Array<Record<string, unknown>> = []
  const updatePayloads: Array<Record<string, unknown>> = []

  const tx = {
    execute: jest.fn().mockResolvedValue(undefined),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue(
              options?.latestDailyConfig ? [options.latestDailyConfig] : [],
            ),
        }),
      }),
    }),
    update: jest.fn().mockImplementation(() => {
      const chain = {
        set: jest.fn((payload: Record<string, unknown>) => {
          updatePayloads.push(payload)
          return chain
        }),
        where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        returning: jest.fn().mockResolvedValue([{ id: 99 }]),
      }
      return chain
    }),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn((payload: Record<string, unknown>) => {
        insertPayloads.push(payload)
        return {
          returning: jest.fn().mockResolvedValue([{ id: 99 }]),
        }
      }),
    })),
    query: {
      checkInDailyStreakConfig: {
        findFirst: jest
          .fn()
          .mockResolvedValue(options?.dailyHistoryDetail ?? null),
      },
      checkInActivityStreak: {
        findFirst: jest.fn().mockResolvedValue(options?.activityDetail ?? null),
      },
      checkInActivityStreakProgress: {
        findFirst: jest
          .fn()
          .mockResolvedValue(options?.activityProgress ?? null),
      },
      checkInStreakGrant: {
        findFirst: jest.fn().mockResolvedValue(options?.streakGrant ?? null),
      },
    },
  }

  const drizzle = {
    withTransaction: async <T>(callback: (runner: typeof tx) => Promise<T>) =>
      callback(tx),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    ext: {
      findPagination: jest
        .fn()
        .mockResolvedValueOnce(
          options?.dailyHistoryPage ?? {
            list: [],
            pageIndex: 1,
            pageSize: 15,
            total: 0,
          },
        )
        .mockResolvedValueOnce(
          options?.activityPage ?? {
            list: [],
            pageIndex: 1,
            pageSize: 15,
            total: 0,
          },
        ),
    },
    db: {
      insert: jest.fn().mockImplementation(() => ({
        values: jest.fn((payload: Record<string, unknown>) => {
          insertPayloads.push(payload)
          return {
            returning: jest.fn().mockResolvedValue([{ id: 99 }]),
          }
        }),
      })),
      update: jest.fn().mockImplementation(() => {
        const chain = {
          set: jest.fn((payload: Record<string, unknown>) => {
            updatePayloads.push(payload)
            return chain
          }),
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
          returning: jest.fn().mockResolvedValue([{ id: 99 }]),
        }
        return chain
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockResolvedValue(
                options?.latestDailyConfig ? [options.latestDailyConfig] : [],
              ),
          }),
        }),
      }),
      query: {
        checkInDailyStreakConfig: {
          findFirst: jest
            .fn()
            .mockResolvedValue(options?.dailyHistoryDetail ?? null),
        },
        checkInActivityStreak: {
          findFirst: jest
            .fn()
            .mockResolvedValue(options?.activityDetail ?? null),
        },
        checkInActivityStreakProgress: {
          findFirst: jest
            .fn()
            .mockResolvedValue(options?.activityProgress ?? null),
        },
        checkInStreakGrant: {
          findFirst: jest.fn().mockResolvedValue(options?.streakGrant ?? null),
        },
      },
    },
    schema: {
      checkInConfig: {},
      checkInDailyStreakConfig: {
        id: 'id',
        version: 'version',
        effectiveFrom: 'effectiveFrom',
      },
      checkInDailyStreakProgress: {},
      checkInActivityStreak: {
        id: 'id',
        status: 'status',
      },
      checkInActivityStreakProgress: {},
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {},
      checkInStreakGrant: {},
      growthRewardSettlement: {},
    },
  } as unknown as DrizzleService

  return {
    drizzle,
    tx,
    insertPayloads,
    updatePayloads,
  }
}

describe('checkInDefinitionService', () => {
  it('publishes a new daily streak config version and supersedes current and future configs', async () => {
    const harness = createDefinitionHarness({
      latestDailyConfig: { id: 10, version: 2 },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest
      .spyOn(service as any, 'resolveDailyPublishEffectiveFrom')
      .mockReturnValue(new Date('2026-04-20T00:00:00.000Z'))
    jest
      .spyOn(service as any, 'findLatestDailyStreakConfig')
      .mockResolvedValue({ id: 10, version: 2 })
    jest.spyOn(service as any, 'listDailyStreakConfigs').mockResolvedValue([
      {
        id: 10,
        version: 2,
        status: CheckInDailyStreakConfigStatusEnum.ACTIVE,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.IMMEDIATE,
        effectiveFrom: new Date('2026-04-18T00:00:00.000Z'),
        effectiveTo: null,
      },
      {
        id: 11,
        version: 3,
        status: CheckInDailyStreakConfigStatusEnum.SCHEDULED,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
        effectiveFrom: new Date('2026-04-21T00:00:00.000Z'),
        effectiveTo: null,
      },
    ])
    jest
      .spyOn(service as any, 'resolveDailyStreakConfigStatus')
      .mockReturnValueOnce(CheckInDailyStreakConfigStatusEnum.ACTIVE)

    await service.publishDailyStreakConfig(
      {
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.SCHEDULED_AT,
        rewardRules: [],
        effectiveFrom: '2026-04-20T00:00:00.000Z',
      } as never,
      9,
    )

    expect(harness.insertPayloads[0]).toMatchObject({
      version: 3,
      status: CheckInDailyStreakConfigStatusEnum.SCHEDULED,
      publishStrategy: CheckInDailyStreakPublishStrategyEnum.SCHEDULED_AT,
      updatedById: 9,
    })
    expect(harness.updatePayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectiveTo: new Date('2026-04-20T00:00:00.000Z'),
          status: CheckInDailyStreakConfigStatusEnum.ACTIVE,
          updatedById: 9,
        }),
        expect.objectContaining({
          status: CheckInDailyStreakConfigStatusEnum.TERMINATED,
          updatedById: 9,
        }),
      ]),
    )
    expect(harness.tx.execute).toHaveBeenCalled()
  })

  it('rejects backdated scheduled daily config publishes', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-19T12:00:00.000Z'))

    try {
      const service = new CheckInDefinitionService(
        createDefinitionHarness().drizzle,
        {} as never,
      )

      expect(() =>
        (service as any).resolveDailyPublishEffectiveFrom(
          CheckInDailyStreakPublishStrategyEnum.SCHEDULED_AT,
          '2026-04-19T11:59:59.000Z',
        ),
      ).toThrow('指定时间生效必须晚于当前时间')
    } finally {
      jest.useRealTimers()
    }
  })

  it('terminates scheduled daily config and bridges predecessor effectiveTo', async () => {
    const harness = createDefinitionHarness({
      dailyHistoryDetail: {
        id: 12,
        version: 3,
        status: CheckInDailyStreakConfigStatusEnum.SCHEDULED,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
        rewardRules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'listDailyStreakConfigs').mockResolvedValue([
      {
        id: 13,
        version: 4,
        status: CheckInDailyStreakConfigStatusEnum.SCHEDULED,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.SCHEDULED_AT,
        effectiveFrom: new Date('2026-04-25T00:00:00.000Z'),
        effectiveTo: null,
      },
      {
        id: 12,
        version: 3,
        status: CheckInDailyStreakConfigStatusEnum.SCHEDULED,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
      },
      {
        id: 11,
        version: 2,
        status: CheckInDailyStreakConfigStatusEnum.ACTIVE,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.IMMEDIATE,
        effectiveFrom: new Date('2026-04-18T00:00:00.000Z'),
        effectiveTo: new Date('2026-04-22T00:00:00.000Z'),
      },
    ])
    jest
      .spyOn(service as any, 'resolveDailyStreakConfigStatus')
      .mockImplementation((config: any, at: Date) => {
        if (config.status === CheckInDailyStreakConfigStatusEnum.TERMINATED) {
          return CheckInDailyStreakConfigStatusEnum.TERMINATED
        }
        if (config.effectiveFrom > at) {
          return CheckInDailyStreakConfigStatusEnum.SCHEDULED
        }
        if (config.effectiveTo && config.effectiveTo <= at) {
          return CheckInDailyStreakConfigStatusEnum.EXPIRED
        }
        return CheckInDailyStreakConfigStatusEnum.ACTIVE
      })

    await service.terminateDailyStreakConfig({ id: 12 }, 9)

    expect(harness.updatePayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: CheckInDailyStreakConfigStatusEnum.TERMINATED,
          updatedById: 9,
        }),
        expect.objectContaining({
          effectiveTo: new Date('2026-04-25T00:00:00.000Z'),
          updatedById: 9,
        }),
      ]),
    )
  })

  it('returns daily streak config history page items', async () => {
    const harness = createDefinitionHarness({
      dailyHistoryPage: {
        list: [
          {
            id: 3,
            version: 3,
            status: CheckInDailyStreakConfigStatusEnum.ACTIVE,
            publishStrategy: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
            effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
            effectiveTo: null,
            rewardRules: [],
            createdAt: new Date('2026-04-19T00:00:00.000Z'),
            updatedAt: new Date('2026-04-19T00:00:00.000Z'),
          },
        ],
        pageIndex: 1,
        pageSize: 15,
        total: 1,
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    const result = await service.getDailyStreakConfigHistoryPage({
      pageIndex: 1,
      pageSize: 15,
    } as never)

    expect(result.list[0]).toMatchObject({
      id: 3,
      version: 3,
      publishStrategy: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
    })
  })

  it('returns daily streak config history detail', async () => {
    const harness = createDefinitionHarness({
      dailyHistoryDetail: {
        id: 2,
        version: 2,
        status: CheckInDailyStreakConfigStatusEnum.EXPIRED,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.SCHEDULED_AT,
        effectiveFrom: new Date('2026-04-10T00:00:00.000Z'),
        effectiveTo: new Date('2026-04-18T00:00:00.000Z'),
        rewardRules: [
          {
            ruleCode: 'day-7',
            streakDays: 7,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest
      .spyOn(service as any, 'parseDailyStreakConfigDefinition')
      .mockReturnValue({
        version: 2,
        status: CheckInDailyStreakConfigStatusEnum.EXPIRED,
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.SCHEDULED_AT,
        effectiveFrom: new Date('2026-04-10T00:00:00.000Z'),
        effectiveTo: new Date('2026-04-18T00:00:00.000Z'),
        rewardRules: [{ ruleCode: 'day-7', streakDays: 7 }],
      })

    const result = await service.getDailyStreakConfigHistoryDetail({ id: 2 })

    expect(result).toMatchObject({
      id: 2,
      version: 2,
      rewardRules: [{ ruleCode: 'day-7', streakDays: 7 }],
    })
  })

  it('creates activity streaks through the activity model', async () => {
    const harness = createDefinitionHarness()
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await service.createActivityStreak(
      {
        activityKey: 'summer-sign-in',
        title: '夏日连续签到',
        status: CheckInActivityStreakStatusEnum.PUBLISHED,
        effectiveFrom: '2026-04-19T00:00:00.000Z',
        effectiveTo: '2026-04-26T23:59:59.999Z',
        rewardRules: [],
      } as never,
      9,
    )

    expect(harness.insertPayloads[0]).toMatchObject({
      activityKey: 'summer-sign-in',
      title: '夏日连续签到',
      status: CheckInActivityStreakStatusEnum.PUBLISHED,
      updatedById: 9,
    })
  })

  it('updates activity streak status', async () => {
    const harness = createDefinitionHarness()
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await service.updateActivityStreakStatus(
      {
        id: 12,
        status: CheckInActivityStreakStatusEnum.DISABLED,
      } as never,
      9,
    )

    expect(harness.updatePayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: CheckInActivityStreakStatusEnum.DISABLED,
          updatedById: 9,
        }),
      ]),
    )
  })

  it('rejects missing daily streak config history detail', async () => {
    const harness = createDefinitionHarness({ dailyHistoryDetail: null })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await expect(
      service.getDailyStreakConfigHistoryDetail({ id: 2 }),
    ).rejects.toThrow(BusinessException)
  })

  it('blocks deleting activity streaks that already have facts', async () => {
    const harness = createDefinitionHarness({
      activityDetail: { id: 8 },
      activityProgress: { id: 1 },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await expect(service.deleteActivityStreak({ id: 8 })).rejects.toThrow(
      BusinessException,
    )
  })
})

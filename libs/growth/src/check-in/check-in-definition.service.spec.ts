/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import { CheckInDefinitionService } from './check-in-definition.service'
import {
  CheckInActivityStreakStatusEnum,
  CheckInDailyStreakConfigStatusEnum,
  CheckInDailyStreakPublishStrategyEnum,
} from './check-in.constant'

function createDefinitionHarness(options?: {
  latestDailyConfig?: { id: number; version: number } | null
  currentDailyConfig?: {
    id: number
    effectiveFrom: Date
    effectiveTo: Date | null
    status: number
  } | null
  updatedActivityRows?: Array<{ id: number }>
}) {
  const insertCalls: Array<{ table: string; payload: unknown }> = []
  const updatePayloads: Array<Record<string, unknown>> = []

  const schema = {
    checkInConfig: {},
    checkInMakeupFact: {},
    checkInMakeupAccount: {},
    checkInRecord: {},
    checkInDailyStreakConfig: { __table: 'dailyConfig', id: 'id' },
    checkInDailyStreakRule: { __table: 'dailyRule', id: 'id' },
    checkInDailyStreakRuleRewardItem: {
      __table: 'dailyRuleRewardItem',
      id: 'id',
    },
    checkInDailyStreakProgress: {},
    checkInActivityStreak: { __table: 'activity', id: 'id' },
    checkInActivityStreakRule: { __table: 'activityRule', id: 'id' },
    checkInActivityStreakRuleRewardItem: {
      __table: 'activityRuleRewardItem',
      id: 'id',
    },
    checkInStreakGrant: {},
    checkInStreakGrantRewardItem: {},
    growthRewardSettlement: {},
  }

  let insertedDailyRuleId = 300
  let insertedActivityRuleId = 500

  const selectRowsByTable = (tableName?: string) => {
    if (tableName === 'dailyConfig') {
      const rows: Array<Record<string, unknown>> = []
      if (options?.currentDailyConfig) {
        rows.push(options.currentDailyConfig)
      }
      if (
        options?.latestDailyConfig &&
        !rows.some((row) => row.id === options.latestDailyConfig?.id)
      ) {
        rows.push(options.latestDailyConfig)
      }
      return rows
    }
    if (tableName === 'activityRule') {
      return []
    }
    return []
  }

  const buildSelectChain = (tableName?: string) => {
    const rows = selectRowsByTable(tableName)
    return {
      where: jest.fn().mockResolvedValue(rows),
      orderBy: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }
  }

  const tx = {
    execute: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn((table: { __table?: string }) => ({
      values: jest.fn((payload: unknown) => {
        insertCalls.push({ table: table.__table ?? 'unknown', payload })

        if (table.__table === 'dailyConfig') {
          return {
            returning: jest.fn().mockResolvedValue([{ id: 101 }]),
          }
        }

        if (table.__table === 'dailyRule') {
          const rows = Array.isArray(payload) ? payload : [payload]
          return {
            returning: jest
              .fn()
              .mockResolvedValue(
                rows.map(() => ({ id: insertedDailyRuleId++ })),
              ),
          }
        }

        if (table.__table === 'dailyRuleRewardItem') {
          return {
            returning: jest.fn().mockResolvedValue([]),
          }
        }

        if (table.__table === 'activity') {
          return {
            returning: jest.fn().mockResolvedValue([{ id: 201 }]),
          }
        }

        if (table.__table === 'activityRule') {
          const rows = Array.isArray(payload) ? payload : [payload]
          return {
            returning: jest
              .fn()
              .mockResolvedValue(
                rows.map(() => ({ id: insertedActivityRuleId++ })),
              ),
          }
        }

        if (table.__table === 'activityRuleRewardItem') {
          return {
            returning: jest.fn().mockResolvedValue([]),
          }
        }

        return {
          returning: jest.fn().mockResolvedValue([]),
        }
      }),
    })),
    update: jest.fn().mockImplementation((table: { __table?: string }) => {
      const updatedActivityRows = options?.updatedActivityRows ?? [{ id: 201 }]
      const chain = {
        set: jest.fn((payload: Record<string, unknown>) => {
          updatePayloads.push(payload)
          return chain
        }),
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(
            table.__table === 'activity' ? updatedActivityRows : [],
          ),
        }),
      }
      return chain
    }),
    query: {
      checkInDailyStreakConfig: {
        findFirst: jest
          .fn()
          .mockResolvedValue(options?.currentDailyConfig ?? null),
      },
      checkInActivityStreak: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    },
    select: jest.fn().mockReturnValue({
      from: jest.fn((table: { __table?: string }) =>
        buildSelectChain(table.__table),
      ),
    }),
  }

  const drizzle = {
    withTransaction: async <T>(callback: (runner: typeof tx) => Promise<T>) =>
      callback(tx),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    db: tx,
    schema,
    ext: {
      findPagination: jest.fn().mockResolvedValue({
        list: [],
        total: 0,
        pageIndex: 1,
        pageSize: 20,
      }),
    },
  } as unknown as DrizzleService

  return {
    drizzle,
    insertCalls,
    updatePayloads,
  }
}

describe('checkInDefinitionService relational streak persistence', () => {
  it('publishes daily streak config via head + rule + reward-item tables', async () => {
    const harness = createDefinitionHarness({
      latestDailyConfig: { id: 11, version: 2 },
      currentDailyConfig: {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInDailyStreakConfigStatusEnum.ACTIVE,
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest
      .spyOn(service as any, 'findLatestDailyStreakConfig')
      .mockResolvedValue({
        id: 11,
        version: 2,
      })
    jest.spyOn(service as any, 'listDailyStreakConfigs').mockResolvedValue([
      {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInDailyStreakConfigStatusEnum.ACTIVE,
      },
    ])

    await service.publishDailyStreakConfig(
      {
        publishStrategy: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
        rewardRules: [
          {
            ruleCode: 'day-3',
            streakDays: 3,
            repeatable: false,
            rewardItems: [
              { assetType: 1, assetKey: '', amount: 10 },
              { assetType: 2, assetKey: '', amount: 5 },
            ],
          },
          {
            ruleCode: 'day-7',
            streakDays: 7,
            repeatable: true,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 20 }],
          },
        ],
      } as never,
      9,
    )

    expect(harness.insertCalls.map((item) => item.table)).toEqual([
      'dailyConfig',
      'dailyRule',
      'dailyRuleRewardItem',
    ])

    const dailyConfigInsert = harness.insertCalls.find(
      (item) => item.table === 'dailyConfig',
    )?.payload as Record<string, unknown>
    expect(dailyConfigInsert).toMatchObject({
      version: 3,
      publishStrategy: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
      updatedById: 9,
    })
    expect(dailyConfigInsert).not.toHaveProperty('rewardRules')

    const dailyRuleInsert = harness.insertCalls.find(
      (item) => item.table === 'dailyRule',
    )?.payload as Array<Record<string, unknown>>
    expect(dailyRuleInsert).toHaveLength(2)
    expect(dailyRuleInsert).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          configId: 101,
          streakDays: 3,
          ruleCode: 'day-3',
        }),
        expect.objectContaining({
          configId: 101,
          streakDays: 7,
          ruleCode: 'day-7',
        }),
      ]),
    )

    const dailyRewardItemInsert = harness.insertCalls.find(
      (item) => item.table === 'dailyRuleRewardItem',
    )?.payload as Array<Record<string, unknown>>
    expect(dailyRewardItemInsert).toHaveLength(3)
    expect(dailyRewardItemInsert).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 300,
          assetType: 1,
          amount: 10,
        }),
        expect.objectContaining({
          ruleId: 300,
          assetType: 2,
          amount: 5,
        }),
        expect.objectContaining({
          ruleId: 301,
          assetType: 1,
          amount: 20,
        }),
      ]),
    )
  })

  it('creates activity streak via activity head + rule + reward-item tables', async () => {
    const harness = createDefinitionHarness()
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await service.createActivityStreak(
      {
        activityKey: 'summer-sign',
        title: '夏日连续签到',
        status: CheckInActivityStreakStatusEnum.PUBLISHED,
        effectiveFrom: '2026-04-20T00:00:00.000Z',
        effectiveTo: '2026-04-30T23:59:59.999Z',
        rewardRules: [
          {
            ruleCode: 'activity-day-2',
            streakDays: 2,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
          },
        ],
      } as never,
      9,
    )

    expect(harness.insertCalls.map((item) => item.table)).toEqual([
      'activity',
      'activityRule',
      'activityRuleRewardItem',
    ])

    const activityInsert = harness.insertCalls.find(
      (item) => item.table === 'activity',
    )?.payload as Record<string, unknown>
    expect(activityInsert).toMatchObject({
      activityKey: 'summer-sign',
      title: '夏日连续签到',
      status: CheckInActivityStreakStatusEnum.PUBLISHED,
      updatedById: 9,
    })
    expect(activityInsert).not.toHaveProperty('rewardRules')

    const activityRuleInsert = harness.insertCalls.find(
      (item) => item.table === 'activityRule',
    )?.payload as Array<Record<string, unknown>>
    expect(activityRuleInsert).toEqual([
      expect.objectContaining({
        activityId: 201,
        streakDays: 2,
        ruleCode: 'activity-day-2',
      }),
    ])

    const activityRewardItemInsert = harness.insertCalls.find(
      (item) => item.table === 'activityRuleRewardItem',
    )?.payload as Array<Record<string, unknown>>
    expect(activityRewardItemInsert).toEqual([
      expect.objectContaining({
        ruleId: 500,
        assetType: 1,
        amount: 8,
      }),
    ])
  })

  it('rejects activity updates for nonexistent ids before rewriting rules', async () => {
    const harness = createDefinitionHarness({
      updatedActivityRows: [],
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await expect(
      service.updateActivityStreak(
        {
          id: 999,
          activityKey: 'summer-sign',
          title: '夏日连续签到',
          status: CheckInActivityStreakStatusEnum.PUBLISHED,
          effectiveFrom: '2026-04-20T00:00:00.000Z',
          effectiveTo: '2026-04-30T23:59:59.999Z',
          rewardRules: [
            {
              ruleCode: 'activity-day-2',
              streakDays: 2,
              rewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
            },
          ],
        } as never,
        9,
      ),
    ).rejects.toThrow('活动连续签到不存在')

    expect(harness.insertCalls).toEqual([])
  })
})

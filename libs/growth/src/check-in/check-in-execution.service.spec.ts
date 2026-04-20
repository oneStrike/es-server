/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import { CheckInExecutionService } from './check-in-execution.service'
import {
  CheckInDailyStreakConfigStatusEnum,
  CheckInStreakScopeTypeEnum,
} from './check-in.constant'

function createDrizzleStub() {
  const insertCalls: Array<{ table: string; payload: unknown }> = []
  const schema = {
    checkInConfig: {},
    checkInDailyStreakConfig: { __table: 'dailyConfig', id: 'id' },
    checkInDailyStreakRule: { __table: 'dailyRule', id: 'id' },
    checkInDailyStreakRuleRewardItem: {
      __table: 'dailyRuleRewardItem',
      id: 'id',
    },
    checkInDailyStreakProgress: {
      __table: 'dailyProgress',
      id: 'id',
      version: 'version',
    },
    checkInActivityStreak: {},
    checkInActivityStreakRule: {},
    checkInActivityStreakRuleRewardItem: {},
    checkInActivityStreakProgress: {},
    checkInMakeupFact: {},
    checkInMakeupAccount: {},
    checkInRecord: { signDate: 'signDate', id: 'id' },
    checkInStreakGrant: {
      __table: 'grant',
      id: 'id',
      userId: 'userId',
      bizKey: 'bizKey',
    },
    checkInStreakGrantRewardItem: { __table: 'grantRewardItem', id: 'id' },
    growthRewardSettlement: {},
  }

  const tx = {
    insert: jest.fn((table: { __table?: string }) => ({
      values: jest.fn((payload: unknown) => {
        insertCalls.push({ table: table.__table ?? 'unknown', payload })
        if (table.__table === 'grant') {
          return {
            onConflictDoNothing: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ id: 401 }]),
            }),
          }
        }
        return {
          onConflictDoNothing: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([]),
          }),
          returning: jest.fn().mockResolvedValue([{ id: 1 }]),
        }
      }),
    })),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
    query: {
      checkInDailyStreakProgress: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          userId: 7,
          currentStreak: 2,
          streakStartedAt: '2026-04-19',
          lastSignedDate: '2026-04-20',
          version: 0,
        }),
      },
    },
  }

  const drizzle = {
    withTransaction: async <T>(callback: (runner: typeof tx) => Promise<T>) =>
      callback(tx),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    db: tx,
    schema,
  } as unknown as DrizzleService

  return { drizzle, tx, insertCalls }
}

describe('checkInExecutionService relational grant snapshot writes', () => {
  it('writes grant head and reward-item rows separately for daily streak grants', async () => {
    const harness = createDrizzleStub()
    const service = new CheckInExecutionService(
      harness.drizzle,
      {} as never,
      {} as never,
    )

    jest.spyOn(service as any, 'listDailyStreakConfigs').mockResolvedValue([
      {
        id: 9,
        status: CheckInDailyStreakConfigStatusEnum.ACTIVE,
        effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
        effectiveTo: null,
      },
    ])
    jest
      .spyOn(service as any, 'resolveDailyStreakConfigForSignDate')
      .mockReturnValue({
        id: 9,
      })
    jest.spyOn(service as any, 'loadDailyStreakRewardRules').mockResolvedValue([
      {
        ruleCode: 'day-3',
        streakDays: 3,
        repeatable: false,
        status: 1,
        rewardItems: [
          { assetType: 1, assetKey: '', amount: 10 },
          { assetType: 2, assetKey: '', amount: 5 },
        ],
      },
    ])
    jest
      .spyOn(service as any, 'listUserRecords')
      .mockResolvedValue([
        { signDate: '2026-04-18' },
        { signDate: '2026-04-19' },
        { signDate: '2026-04-20' },
      ])
    jest.spyOn(service as any, 'recomputeStreakAggregation').mockReturnValue({
      currentStreak: 3,
      streakStartedAt: '2026-04-18',
      lastSignedDate: '2026-04-20',
      streakByDate: {
        '2026-04-18': 1,
        '2026-04-19': 2,
        '2026-04-20': 3,
      },
    })
    jest
      .spyOn(service as any, 'resolveEligibleScopeGrantRules')
      .mockReturnValue([
        {
          rule: {
            ruleCode: 'day-3',
            streakDays: 3,
            repeatable: false,
            status: 1,
            rewardItems: [
              { assetType: 1, assetKey: '', amount: 10 },
              { assetType: 2, assetKey: '', amount: 5 },
            ],
          },
          triggerSignDate: '2026-04-20',
        },
      ])
    ;(harness.tx.select as jest.Mock).mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    })
    ;(harness.tx.select as jest.Mock).mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: 301, ruleCode: 'day-3' }]),
      }),
    })
    jest
      .spyOn(service as any, 'updateDailyProgress')
      .mockResolvedValue(undefined)

    const result = await (service as any).processDailyStreakGrants(
      7,
      harness.tx,
      new Date('2026-04-20T09:00:00.000Z'),
    )

    expect(result).toEqual([401])
    expect(harness.insertCalls.map((item) => item.table)).toEqual([
      'grant',
      'grantRewardItem',
    ])

    const grantInsert = harness.insertCalls.find(
      (item) => item.table === 'grant',
    )?.payload as Record<string, unknown>
    expect(grantInsert).toMatchObject({
      userId: 7,
      scopeType: CheckInStreakScopeTypeEnum.DAILY,
      configVersionId: 9,
      dailyRuleId: 301,
      ruleCode: 'day-3',
      streakDays: 3,
    })
    expect(grantInsert).not.toHaveProperty('rewardItems')

    const rewardItemInsert = harness.insertCalls.find(
      (item) => item.table === 'grantRewardItem',
    )?.payload as Array<Record<string, unknown>>
    expect(rewardItemInsert).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grantId: 401,
          assetType: 1,
          amount: 10,
        }),
        expect.objectContaining({
          grantId: 401,
          assetType: 2,
          amount: 5,
        }),
      ]),
    )
  })

  it('reuses the initially loaded activity rule rows for grant snapshots', async () => {
    const harness = createDrizzleStub()
    const service = new CheckInExecutionService(
      harness.drizzle,
      {} as never,
      {} as never,
    )

    jest
      .spyOn(service as any, 'listEffectiveActivityStreaks')
      .mockResolvedValue([{ id: 21 }])
    jest
      .spyOn(service as any, 'getOrCreateActivityProgress')
      .mockResolvedValue({ id: 1, version: 0 })
    jest
      .spyOn(service as any, 'listActivityScopedRecords')
      .mockResolvedValue([
        { signDate: '2026-04-19' },
        { signDate: '2026-04-20' },
      ])
    jest.spyOn(service as any, 'recomputeStreakAggregation').mockReturnValue({
      currentStreak: 2,
      streakStartedAt: '2026-04-19',
      lastSignedDate: '2026-04-20',
      streakByDate: {
        '2026-04-19': 1,
        '2026-04-20': 2,
      },
    })
    jest
      .spyOn(service as any, 'loadActivityStreakRewardRuleRows')
      .mockResolvedValue([
        {
          id: 701,
          ruleCode: 'activity-day-2',
          streakDays: 2,
          repeatable: false,
          status: 1,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
        },
      ])
    jest
      .spyOn(service as any, 'resolveEligibleScopeGrantRules')
      .mockReturnValue([
        {
          rule: {
            ruleCode: 'activity-day-2',
            streakDays: 2,
            repeatable: false,
            status: 1,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
          },
          triggerSignDate: '2026-04-20',
        },
      ])
    jest
      .spyOn(service as any, 'updateActivityProgress')
      .mockResolvedValue(undefined)
    ;(harness.tx.select as jest.Mock)
      .mockImplementationOnce(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      }))
      .mockImplementation(() => {
        throw new Error('unexpected second select')
      })

    const result = await (service as any).processActivityStreakGrants(
      7,
      '2026-04-20',
      harness.tx,
    )

    expect(result).toEqual([401])
    expect(harness.tx.select).toHaveBeenCalledTimes(1)

    const grantInsert = harness.insertCalls.find(
      (item) => item.table === 'grant',
    )?.payload as Record<string, unknown>
    expect(grantInsert).toMatchObject({
      userId: 7,
      scopeType: CheckInStreakScopeTypeEnum.ACTIVITY,
      activityId: 21,
      activityRuleId: 701,
      ruleCode: 'activity-day-2',
      streakDays: 2,
    })
  })
})

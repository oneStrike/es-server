/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import { CheckInRuntimeService } from './check-in-runtime.service'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInStreakConfigStatusEnum,
  CheckInStreakPublishStrategyEnum,
} from './check-in.constant'

function createDrizzleStub() {
  return {
    db: {
      query: {
        checkInStreakProgress: {
          findFirst: jest.fn(),
        },
      },
      select: jest.fn(),
    },
    schema: {
      appUser: {
        id: 'id',
        nickname: 'nickname',
        avatarUrl: 'avatarUrl',
      },
      checkInConfig: {},
      checkInStreakRule: {},
      checkInStreakRuleRewardItem: {},
      checkInStreakProgress: {},
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {},
      checkInStreakGrant: {},
      checkInStreakGrantRewardItem: {},
      growthRewardSettlement: {},
    },
    ext: {
      findPagination: jest.fn(),
    },
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService
}

describe('checkInRuntimeService per-rule streak reads', () => {
  it('derives nextReward from active streak-day records', async () => {
    const drizzle = createDrizzleStub()
    const service = new CheckInRuntimeService(drizzle, {} as never)

    jest.spyOn(service as any, 'getRequiredConfig').mockResolvedValue({
      id: 1,
      enabled: 1,
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodicAllowance: 2,
      baseRewardItems: null,
      dateRewardRules: [],
      patternRewardRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    jest.spyOn(service as any, 'buildCurrentMakeupAccountView').mockResolvedValue({
      eventAvailable: 0,
      periodEndDate: '2026-04-26',
      periodKey: 'week-2026-04-20',
      periodStartDate: '2026-04-20',
      periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodicGranted: 2,
      periodicRemaining: 2,
      periodicUsed: 0,
    })
    jest.spyOn(service as any, 'listActiveStreakRulesAt').mockResolvedValue([
      {
        effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
        effectiveTo: null,
        publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
        repeatable: false,
        rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.ACTIVE,
        streakDays: 3,
        version: 2,
      },
      {
        effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
        effectiveTo: null,
        publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
        repeatable: false,
        rewardItems: [{ assetType: 1, assetKey: '', amount: 20 }],
        ruleCode: 'streak-day-7',
        status: CheckInStreakConfigStatusEnum.ACTIVE,
        streakDays: 7,
        version: 1,
      },
    ])
    ;(drizzle.db.query.checkInStreakProgress.findFirst as jest.Mock).mockResolvedValue({
      currentStreak: 4,
      id: 1,
      lastSignedDate: '2026-04-20',
      streakStartedAt: '2026-04-17',
      userId: 7,
      version: 0,
    })
    jest.spyOn(service as any, 'getLatestRecord').mockResolvedValue(null)
    jest.spyOn(service as any, 'hasRecordForDate').mockResolvedValue(true)
    jest.spyOn(service as any, 'toConfigDetailView').mockReturnValue({ id: 1 })

    const summary = await service.getSummary(7)

    expect(summary.streak.currentStreak).toBe(4)
    expect(summary.streak.nextReward).toMatchObject({
      ruleCode: 'streak-day-7',
      streakDays: 7,
    })
  })

  it('throws when multiple active records exist for the same streak day', async () => {
    const drizzle = createDrizzleStub()
    const service = new CheckInRuntimeService(drizzle, {} as never)

    expect(() =>
      (service as any).assertNoDuplicatedActiveStreakDays([
        { id: 1, streakDays: 3 },
        { id: 2, streakDays: 3 },
      ]),
    ).toThrow('连续签到规则存在多个生效版本')
  })

  it('treats a scheduled row whose effective time has arrived as the next reward', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T12:00:00.000Z'))

    const drizzle = createDrizzleStub()
    const service = new CheckInRuntimeService(drizzle, {} as never)

    jest.spyOn(service as any, 'getRequiredConfig').mockResolvedValue({
      id: 1,
      enabled: 1,
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodicAllowance: 2,
      baseRewardItems: null,
      dateRewardRules: [],
      patternRewardRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    jest.spyOn(service as any, 'buildCurrentMakeupAccountView').mockResolvedValue({
      eventAvailable: 0,
      periodEndDate: '2026-04-26',
      periodKey: 'week-2026-04-20',
      periodStartDate: '2026-04-20',
      periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodicGranted: 2,
      periodicRemaining: 2,
      periodicUsed: 0,
    })
    jest.spyOn(service as any, 'listActiveStreakRulesAt').mockResolvedValue([
      {
        effectiveFrom: new Date('2026-04-20T09:00:00.000Z'),
        effectiveTo: null,
        publishStrategy: CheckInStreakPublishStrategyEnum.SCHEDULED_AT,
        repeatable: false,
        rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        ruleCode: 'streak-day-7',
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
        streakDays: 7,
        version: 1,
      },
    ])
    ;(drizzle.db.query.checkInStreakProgress.findFirst as jest.Mock).mockResolvedValue({
      currentStreak: 4,
      id: 1,
      lastSignedDate: '2026-04-20',
      streakStartedAt: '2026-04-17',
      userId: 7,
      version: 0,
    })
    jest.spyOn(service as any, 'getLatestRecord').mockResolvedValue(null)
    jest.spyOn(service as any, 'hasRecordForDate').mockResolvedValue(true)
    jest.spyOn(service as any, 'toConfigDetailView').mockReturnValue({ id: 1 })

    const summary = await service.getSummary(7)

    expect(summary.streak.nextReward).toMatchObject({
      ruleCode: 'streak-day-7',
      streakDays: 7,
    })

    jest.useRealTimers()
  })
})

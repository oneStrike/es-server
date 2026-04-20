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
        checkInStreakConfig: {
          findFirst: jest.fn(),
        },
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
      checkInStreakConfig: {},
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

describe('checkInRuntimeService unified streak reads', () => {
  it('derives nextReward from loaded streak rule rows', async () => {
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
      periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodKey: 'week-2026-04-20',
      periodStartDate: '2026-04-20',
      periodEndDate: '2026-04-26',
      periodicGranted: 2,
      periodicUsed: 0,
      periodicRemaining: 2,
      eventAvailable: 0,
    })
    jest.spyOn(service as any, 'getRequiredCurrentStreakConfig').mockResolvedValue({
      id: 9,
      version: 3,
      status: CheckInStreakConfigStatusEnum.ACTIVE,
      publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
      effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
      effectiveTo: null,
    })
    jest.spyOn(service as any, 'loadStreakRewardRules').mockResolvedValue([
      {
        ruleCode: 'day-3',
        streakDays: 3,
        repeatable: false,
        status: 1,
        rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
      },
      {
        ruleCode: 'day-7',
        streakDays: 7,
        repeatable: false,
        status: 1,
        rewardItems: [{ assetType: 1, assetKey: '', amount: 20 }],
      },
    ])
    ;(drizzle.db.query.checkInStreakProgress.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      currentStreak: 4,
      streakStartedAt: '2026-04-17',
      lastSignedDate: '2026-04-20',
      version: 0,
    })
    jest.spyOn(service as any, 'getLatestRecord').mockResolvedValue(null)
    jest.spyOn(service as any, 'hasRecordForDate').mockResolvedValue(true)
    jest.spyOn(service as any, 'toConfigDetailView').mockReturnValue({ id: 1 })

    const summary = await service.getSummary(7)

    expect(summary.streak.currentStreak).toBe(4)
    expect(summary.streak.nextReward).toMatchObject({
      ruleCode: 'day-7',
      streakDays: 7,
    })
  })
})

import type { DrizzleService } from '@db/core'
import { inspect } from 'node:util'
import { BusinessException } from '@libs/platform/exceptions'
import { CheckInRuntimeService } from './check-in-runtime.service'
import {
  CheckInActivityStreakStatusEnum,
  CheckInMakeupPeriodTypeEnum,
} from './check-in.constant'

const deprecatedRoundConfigField = 'round' + 'ConfigId'
const deprecatedRoundIterationField = 'round' + 'Iteration'

function createDrizzleStub() {
  const makeSelectChain = () => {
    const joinedChain = {
      where: jest.fn().mockReturnThis(),
    }
    const fromChain = {
      where: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnValue(joinedChain),
      orderBy: jest.fn().mockResolvedValue([]),
      limit: jest.fn().mockResolvedValue([]),
    }

    return {
      from: jest.fn().mockReturnValue(fromChain),
    }
  }

  return {
    db: {
      query: {
        checkInDailyStreakProgress: {
          findFirst: jest.fn(),
        },
        checkInDailyStreakConfig: {
          findFirst: jest.fn(),
        },
      },
      select: jest.fn().mockImplementation(() => makeSelectChain()),
    },
    schema: {
      appUser: {
        id: 'id',
        nickname: 'nickname',
        avatarUrl: 'avatarUrl',
      },
      checkInConfig: {},
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {
        id: 'id',
        userId: 'userId',
        signDate: 'signDate',
        rewardSettlementId: 'rewardSettlementId',
      },
      checkInDailyStreakConfig: {},
      checkInDailyStreakProgress: {},
      checkInActivityStreak: {},
      checkInActivityStreakProgress: {},
      checkInStreakGrant: {
        id: 'id',
        userId: 'userId',
        triggerSignDate: 'triggerSignDate',
        scopeType: 'scopeType',
        configVersionId: 'configVersionId',
        activityId: 'activityId',
        rewardSettlementId: 'rewardSettlementId',
      },
      growthRewardSettlement: {
        id: 'id',
        settlementStatus: 'settlementStatus',
      },
    },
    ext: {
      findPagination: jest.fn(),
    },
    buildPage: jest.fn(),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService
}

describe('checkInRuntimeService', () => {
  it('resets stale daily streaks before deriving summary next reward', async () => {
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
    jest
      .spyOn(service as any, 'buildCurrentMakeupAccountView')
      .mockResolvedValue({
        periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
        periodKey: 'week-2026-04-13',
        periodStartDate: '2026-04-13',
        periodEndDate: '2026-04-19',
        periodicGranted: 2,
        periodicUsed: 0,
        periodicRemaining: 2,
        eventAvailable: 0,
      })
    jest
      .spyOn(service as any, 'getRequiredCurrentDailyStreakConfig')
      .mockResolvedValue({
        id: 10,
        version: 3,
        status: 2,
        publishStrategy: 2,
        effectiveFrom: new Date(),
        effectiveTo: null,
        rewardRules: [],
        nextRoundStrategy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ;(
      drizzle.db.query.checkInDailyStreakProgress.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 1,
      userId: 7,
      currentStreak: 4,
      streakStartedAt: '2026-04-10',
      lastSignedDate: '2026-01-01',
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;(
      drizzle.db.query.checkInDailyStreakConfig.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 99,
      version: 7,
      status: 2,
      publishStrategy: 2,
      effectiveFrom: new Date(),
      effectiveTo: null,
      rewardRules: [{ ruleCode: 'rule-1', streakDays: 1 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    jest.spyOn(service as any, 'getLatestRecord').mockResolvedValue(null)
    jest.spyOn(service as any, 'hasRecordForDate').mockResolvedValue(false)
    jest.spyOn(service as any, 'parseRewardDefinition').mockReturnValue({
      baseRewardItems: null,
      dateRewardRules: [],
      patternRewardRules: [],
    })
    jest
      .spyOn(service as any, 'parseDailyStreakConfigDefinition')
      .mockReturnValue({
        version: 7,
        status: 2,
        publishStrategy: 2,
        effectiveFrom: new Date(),
        effectiveTo: null,
        rewardRules: [{ ruleCode: 'rule-1', streakDays: 1 }],
      })
    jest.spyOn(service as any, 'toConfigDetailView').mockReturnValue({ id: 1 })
    const nextReward = { ruleCode: 'rule-1', streakDays: 1 }
    const resolveNextStreakRewardSpy = jest
      .spyOn(service as any, 'resolveNextStreakReward')
      .mockReturnValue(nextReward)

    const summary = await service.getSummary(7)

    expect(summary.streak.currentStreak).toBe(0)
    expect(summary.streak.lastSignedDate).toBeUndefined()
    expect(summary.streak.streakStartedAt).toBeUndefined()
    expect(summary.streak.nextReward).toBe(nextReward)
    expect(summary.streak).not.toHaveProperty(deprecatedRoundConfigField)
    expect(summary.streak).not.toHaveProperty('roundCode')
    expect(summary.streak).not.toHaveProperty(deprecatedRoundIterationField)
    expect(summary.streak).not.toHaveProperty('round')
    expect(resolveNextStreakRewardSpy).toHaveBeenCalledWith(
      [{ ruleCode: 'rule-1', streakDays: 1 }],
      0,
    )
  })

  it('uses the user-bound daily config version instead of the latest current config in summary calculations', async () => {
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
    jest
      .spyOn(service as any, 'buildCurrentMakeupAccountView')
      .mockResolvedValue({
        periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
        periodKey: 'week-2026-04-13',
        periodStartDate: '2026-04-13',
        periodEndDate: '2026-04-19',
        periodicGranted: 2,
        periodicUsed: 0,
        periodicRemaining: 2,
        eventAvailable: 0,
      })
    jest
      .spyOn(service as any, 'getRequiredCurrentDailyStreakConfig')
      .mockResolvedValue({
        id: 10,
        version: 3,
        status: 2,
        publishStrategy: 2,
        effectiveFrom: new Date(),
        effectiveTo: null,
        rewardRules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ;(
      drizzle.db.query.checkInDailyStreakProgress.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 1,
      userId: 7,
      configVersionId: 99,
      currentStreak: 4,
      streakStartedAt: '2026-04-10',
      lastSignedDate: '2026-04-18',
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;(
      drizzle.db.query.checkInDailyStreakConfig.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 99,
      version: 7,
      status: 3,
      publishStrategy: 3,
      effectiveFrom: new Date('2026-04-10T00:00:00.000Z'),
      effectiveTo: null,
      rewardRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    jest.spyOn(service as any, 'getLatestRecord').mockResolvedValue(null)
    jest.spyOn(service as any, 'hasRecordForDate').mockResolvedValue(false)
    jest.spyOn(service as any, 'parseRewardDefinition').mockReturnValue({
      baseRewardItems: null,
      dateRewardRules: [],
      patternRewardRules: [],
    })
    jest
      .spyOn(service as any, 'parseDailyStreakConfigDefinition')
      .mockReturnValue({
        version: 7,
        status: 3,
        publishStrategy: 3,
        effectiveFrom: new Date('2026-04-10T00:00:00.000Z'),
        effectiveTo: null,
        rewardRules: [],
      })
    jest.spyOn(service as any, 'toConfigDetailView').mockReturnValue({ id: 1 })
    jest.spyOn(service as any, 'resolveNextStreakReward').mockReturnValue(null)

    const summary = await service.getSummary(7)

    expect(summary.streak.currentStreak).toBe(4)
    expect(summary.streak.streakStartedAt).toBe('2026-04-10')
    expect(summary.streak.lastSignedDate).toBe('2026-04-18')
    expect(summary.streak).not.toHaveProperty(deprecatedRoundConfigField)
    expect(summary.streak).not.toHaveProperty('roundCode')
    expect(summary.streak).not.toHaveProperty('version')
  })

  it('passes an active-streak filter into leaderboard pagination', async () => {
    const drizzle = createDrizzleStub()
    const service = new CheckInRuntimeService(drizzle, {} as never)
    const whereToken = { kind: 'active-streak-filter' }
    jest
      .spyOn(service as any, 'buildActiveDailyStreakProgressWhere')
      .mockReturnValue(whereToken)
    ;(drizzle.ext.findPagination as jest.Mock).mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
    })

    await service.getLeaderboardPage({ pageIndex: 1, pageSize: 20 } as never)

    expect(drizzle.ext.findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        where: whereToken,
      }),
    )
  })

  it('combines grant-side reconciliation filters into one correlated exists clause', () => {
    const drizzle = createDrizzleStub()
    const fromChain = {
      where: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue([]),
      limit: jest.fn().mockResolvedValue([]),
    }
    ;(drizzle.db.select as jest.Mock).mockImplementation(() => ({
      from: jest.fn().mockReturnValue(fromChain),
    }))
    const service = new CheckInRuntimeService(drizzle, {} as never)

    const condition = (service as any).buildGrantReconciliationCondition({
      scopeType: 1,
      activityId: 22,
    })
    const inspected = inspect(fromChain.where.mock.calls[0]?.[0], { depth: 20 })

    expect(condition).toBeDefined()
    expect(inspected).toContain("'scopeType'")
    expect(inspected).toContain("'activityId'")
    expect(inspected).toContain("'triggerSignDate'")
  })

  it('uses frozen record reward snapshot for signed calendar days', async () => {
    const drizzle = createDrizzleStub()
    const service = new CheckInRuntimeService(drizzle, {} as never)

    jest.spyOn(service as any, 'getRequiredConfig').mockResolvedValue({
      id: 1,
      enabled: 1,
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodicAllowance: 2,
      baseRewardItems: [{ assetType: 1, assetKey: '', amount: 99 }],
      dateRewardRules: [],
      patternRewardRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    jest.spyOn(service as any, 'parseRewardDefinition').mockReturnValue({
      baseRewardItems: [{ assetType: 1, assetKey: '', amount: 99 }],
      dateRewardRules: [],
      patternRewardRules: [],
    })
    jest
      .spyOn(service as any, 'buildCurrentMakeupAccountView')
      .mockResolvedValue({
        periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
        periodKey: 'week-2026-04-13',
        periodStartDate: '2026-04-13',
        periodEndDate: '2026-04-13',
        periodicGranted: 2,
        periodicUsed: 0,
        periodicRemaining: 2,
        eventAvailable: 0,
      })
    jest.spyOn(service as any, 'listRecordsInDateRange').mockResolvedValue([
      {
        id: 5,
        userId: 7,
        signDate: '2026-04-13',
        recordType: 1,
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        rewardSettlementId: null,
      },
    ])
    jest
      .spyOn(service as any, 'buildSettlementMapById')
      .mockResolvedValue(new Map())
    jest
      .spyOn(service as any, 'buildGrantMapForRecords')
      .mockResolvedValue(new Map())
    jest.spyOn(service as any, 'resolveRewardForDate').mockReturnValue({
      resolvedRewardSourceType: 1,
      resolvedRewardRuleKey: null,
      resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 99 }],
    })

    const calendar = await service.getCalendar(7)

    expect(calendar.days[0]?.rewardItems).toEqual([
      { assetType: 1, assetKey: '', amount: 10 },
    ])
  })

  it('rejects invisible activity details for app clients', async () => {
    const drizzle = createDrizzleStub()
    const service = new CheckInRuntimeService(drizzle, {} as never)

    ;(
      drizzle.db.query as unknown as Record<string, { findFirst: jest.Mock }>
    ).checkInActivityStreak = {
      findFirst: jest.fn().mockResolvedValue({
        id: 8,
        activityKey: 'summer-sign-in',
        title: '夏日连续签到',
        status: CheckInActivityStreakStatusEnum.DRAFT,
        effectiveFrom: new Date('2099-04-19T00:00:00.000Z'),
        effectiveTo: new Date('2099-04-26T23:59:59.999Z'),
        rewardRules: [],
      }),
    }

    await expect(service.getActivityDetail({ id: 8 }, 7)).rejects.toThrow(
      BusinessException,
    )
  })
})

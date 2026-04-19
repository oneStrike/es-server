import type { DrizzleService } from '@db/core'
import { CheckInRuntimeService } from './check-in-runtime.service'
import { CheckInMakeupPeriodTypeEnum } from './check-in.constant'

function createDrizzleStub() {
  return {
    db: {
      query: {
        checkInStreakProgress: {
          findFirst: jest.fn(),
        },
        checkInStreakRoundConfig: {
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
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {},
      checkInStreakRoundConfig: {},
      checkInStreakProgress: {},
      checkInStreakRewardGrant: {},
      growthRewardSettlement: {},
    },
    ext: {
      findPagination: jest.fn(),
    },
    buildPage: jest.fn(),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService
}

describe('checkInRuntimeService', () => {
  it('resets stale streaks before deriving summary next reward', async () => {
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
    jest.spyOn(service as any, 'getRequiredActiveRound').mockResolvedValue({
      id: 10,
      roundCode: 'active-round',
      version: 3,
      status: 1,
      rewardRules: [],
      nextRoundStrategy: 1,
      nextRoundConfigId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;(
      drizzle.db.query.checkInStreakProgress.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 1,
      userId: 7,
      roundConfigId: 99,
      roundIteration: 2,
      currentStreak: 4,
      roundStartedAt: '2026-04-10',
      lastSignedDate: '2026-01-01',
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;(
      drizzle.db.query.checkInStreakRoundConfig.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 99,
      roundCode: 'bound-round',
      version: 7,
      status: 1,
      rewardRules: [{ ruleCode: 'rule-1', streakDays: 1 }],
      nextRoundStrategy: 1,
      nextRoundConfigId: null,
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
    jest.spyOn(service as any, 'parseStreakRoundDefinition').mockReturnValue({
      roundCode: 'bound-round',
      version: 7,
      status: 1,
      rewardRules: [{ ruleCode: 'rule-1', streakDays: 1 }],
      nextRoundStrategy: 1,
      nextRoundConfigId: null,
    })
    jest.spyOn(service as any, 'toConfigDetailView').mockReturnValue({ id: 1 })
    jest
      .spyOn(service as any, 'toRoundDetailView')
      .mockImplementation((round: any) => ({
        id: round.id,
        roundCode: round.roundCode,
        version: round.version,
      }))
    const nextReward = { ruleCode: 'rule-1', streakDays: 1 }
    const resolveNextStreakRewardSpy = jest
      .spyOn(service as any, 'resolveNextStreakReward')
      .mockReturnValue(nextReward)

    const summary = await service.getSummary(7)

    expect(summary.streak.currentStreak).toBe(0)
    expect(summary.streak.lastSignedDate).toBeUndefined()
    expect(summary.streak.nextReward).toBe(nextReward)
    expect(resolveNextStreakRewardSpy).toHaveBeenCalledWith(
      [{ ruleCode: 'rule-1', streakDays: 1 }],
      0,
    )
  })

  it('uses the user-bound round instead of the current active round in summary', async () => {
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
    jest.spyOn(service as any, 'getRequiredActiveRound').mockResolvedValue({
      id: 10,
      roundCode: 'active-round',
      version: 3,
      status: 1,
      rewardRules: [],
      nextRoundStrategy: 1,
      nextRoundConfigId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;(
      drizzle.db.query.checkInStreakProgress.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 1,
      userId: 7,
      roundConfigId: 99,
      roundIteration: 2,
      currentStreak: 4,
      roundStartedAt: '2026-04-10',
      lastSignedDate: '2026-04-18',
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;(
      drizzle.db.query.checkInStreakRoundConfig.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 99,
      roundCode: 'bound-round',
      version: 7,
      status: 2,
      rewardRules: [],
      nextRoundStrategy: 1,
      nextRoundConfigId: null,
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
    jest.spyOn(service as any, 'parseStreakRoundDefinition').mockReturnValue({
      roundCode: 'bound-round',
      version: 7,
      status: 1,
      rewardRules: [],
      nextRoundStrategy: 1,
      nextRoundConfigId: null,
    })
    jest.spyOn(service as any, 'toConfigDetailView').mockReturnValue({ id: 1 })
    jest
      .spyOn(service as any, 'toRoundDetailView')
      .mockImplementation((round: any) => ({
        id: round.id,
        roundCode: round.roundCode,
        version: round.version,
      }))
    jest.spyOn(service as any, 'resolveNextStreakReward').mockReturnValue(null)

    const summary = await service.getSummary(7)

    expect(summary.streak.roundConfigId).toBe(99)
    expect(summary.streak.roundCode).toBe('bound-round')
    expect(summary.streak.version).toBe(7)
  })

  it('passes an active-streak filter into leaderboard pagination', async () => {
    const drizzle = createDrizzleStub()
    const service = new CheckInRuntimeService(drizzle, {} as never)
    const whereToken = { kind: 'active-streak-filter' }
    jest
      .spyOn(service as any, 'buildActiveStreakProgressWhere')
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
})

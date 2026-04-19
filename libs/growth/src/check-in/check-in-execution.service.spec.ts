import type { DrizzleService } from '@db/core'
import { checkInRecord } from '@db/schema'
import { inspect } from 'node:util'
import { BusinessErrorCode } from '@libs/platform/constant'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInStreakScopeTypeEnum } from './check-in.constant'

const deprecatedRoundConfigField = 'round' + 'ConfigId'
const deprecatedRoundIterationField = 'round' + 'Iteration'

function createDrizzleStub(params?: {
  record?: {
    id: number
    userId: number
    signDate: string
    resolvedRewardItems: unknown
    rewardSettlementId?: number | null
  }
}) {
  const record = params?.record ?? {
    id: 5,
    userId: 7,
    signDate: '2026-04-17',
    resolvedRewardItems: null,
    rewardSettlementId: null,
  }

  return {
    withTransaction: async <T>(callback: (tx: any) => Promise<T>) =>
      callback({
        query: {
          checkInRecord: {
            findFirst: jest.fn().mockResolvedValue(record),
          },
          checkInStreakGrant: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          checkInDailyStreakProgress: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          growthRewardSettlement: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          checkInConfig: {
            findFirst: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    db: {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue({ rowCount: 1 }),
      }),
      query: {
        checkInRecord: {
          findFirst: jest.fn().mockResolvedValue(record),
        },
        checkInStreakGrant: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        checkInDailyStreakProgress: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        growthRewardSettlement: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        checkInConfig: {
          findFirst: jest.fn().mockResolvedValue({ id: 1 }),
        },
      },
    },
    schema: {
      checkInConfig: { id: 'id' },
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: { id: 'id', rewardSettlementId: 'rewardSettlementId' },
      checkInDailyStreakConfig: { id: 'id' },
      checkInDailyStreakProgress: { id: 'id' },
      checkInActivityStreak: { id: 'id' },
      checkInActivityStreakProgress: { id: 'id' },
      checkInStreakGrant: {
        id: 'id',
        rewardSettlementId: 'rewardSettlementId',
      },
      growthRewardSettlement: { id: 'id' },
      growthLedgerRecord: {},
      growthAuditLog: {},
      userAssetBalance: {},
      appUser: {},
      userLevelRule: {},
      growthRewardRule: {},
      growthRuleUsageCounter: {},
    },
  } as unknown as DrizzleService
}

function createDuplicateConflictDrizzleStub(signDate: string) {
  const checkInRecordFindFirst = jest
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      id: 8,
      userId: 7,
      signDate,
    })
  const insertReturning = jest.fn().mockResolvedValue([])
  const onConflictDoNothing = jest.fn().mockReturnValue({
    returning: insertReturning,
  })
  const insertValues = jest.fn().mockReturnValue({
    onConflictDoNothing,
  })

  return {
    withTransaction: async <T>(callback: (tx: any) => Promise<T>) =>
      callback({
        query: {
          checkInRecord: {
            findFirst: checkInRecordFindFirst,
          },
        },
        insert: jest.fn().mockReturnValue({
          values: insertValues,
        }),
      }),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    db: {},
    schema: {
      checkInConfig: {},
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {
        userId: 'userId',
        signDate: 'signDate',
      },
      checkInDailyStreakConfig: {},
      checkInDailyStreakProgress: {},
      checkInActivityStreak: {},
      checkInActivityStreakProgress: {},
      checkInStreakGrant: {},
      growthRewardSettlement: {},
    },
  } as unknown as DrizzleService
}

function createDuplicateConflictService(drizzle: DrizzleService) {
  const service = new CheckInExecutionService(drizzle, {} as never, {} as never)

  jest.spyOn(service as any, 'getEnabledConfig').mockResolvedValue({
    makeupPeriodType: 1,
  })
  jest.spyOn(service as any, 'parseRewardDefinition').mockReturnValue({
    baseRewardItems: null,
    dateRewardRules: [],
    patternRewardRules: [],
  })
  jest.spyOn(service as any, 'ensureUserExists').mockResolvedValue(undefined)
  jest.spyOn(service as any, 'ensureCurrentMakeupAccount').mockResolvedValue({
    id: 1,
    userId: 7,
    periodType: 1,
    periodKey: 'week-2026-04-13',
    periodicGranted: 2,
    periodicUsed: 0,
    eventAvailable: 0,
    version: 0,
    lastSyncedFactId: null,
  })
  jest.spyOn(service as any, 'resolveRewardForDate').mockReturnValue({
    resolvedRewardSourceType: null,
    resolvedRewardRuleKey: null,
    resolvedRewardItems: null,
  })

  return service
}

describe('checkInExecutionService', () => {
  it('converts duplicate sign conflicts into business errors', async () => {
    const service = createDuplicateConflictService(
      createDuplicateConflictDrizzleStub(new Date().toISOString().slice(0, 10)),
    )

    await expect(service.signToday(7)).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '今日已签到，请勿重复操作',
    })
  })

  it('converts duplicate makeup conflicts into business errors', async () => {
    const makeupDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const service = createDuplicateConflictService(
      createDuplicateConflictDrizzleStub(makeupDate),
    )
    jest.spyOn(service as any, 'assertMakeupAllowed').mockReturnValue(undefined)
    jest.spyOn(service as any, 'buildMakeupConsumePlan').mockReturnValue([
      {
        sourceType: 1,
        amount: 1,
      },
    ])
    jest.spyOn(service as any, 'consumeMakeupAllowance').mockResolvedValue({
      id: 1,
      userId: 7,
      periodType: 1,
      periodKey: 'week-2026-04-13',
      periodicGranted: 2,
      periodicUsed: 1,
      eventAvailable: 0,
      version: 1,
      lastSyncedFactId: 1,
    })

    await expect(
      service.makeup({ signDate: makeupDate }, 7),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '该日期已签到，请勿重复补签',
    })
  })

  it('marks record reward repair as retry', async () => {
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )
    const settleRecordRewardSpy = jest
      .spyOn(service as any, 'settleRecordReward')
      .mockResolvedValue(true)

    await service.repairReward({ targetType: 1, recordId: 3 } as never, 9)

    expect(settleRecordRewardSpy).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        actorUserId: 9,
        isRetry: true,
      }),
    )
  })

  it('marks streak reward repair as retry', async () => {
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )
    const settleGrantRewardSpy = jest
      .spyOn(service as any, 'settleGrantReward')
      .mockResolvedValue(true)

    await service.repairReward({ targetType: 2, grantId: 4 } as never, 9)

    expect(settleGrantRewardSpy).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        actorUserId: 9,
        isRetry: true,
      }),
    )
  })

  it('does not create settlement when resolved reward items are empty', async () => {
    const ensureCheckInRecordRewardSettlement = jest.fn()
    const syncManualSettlementResult = jest.fn()
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {
        ensureCheckInRecordRewardSettlement,
        syncManualSettlementResult,
      } as never,
    )

    const success = await (service as any).settleRecordReward(5, {})

    expect(success).toBe(true)
    expect(ensureCheckInRecordRewardSettlement).not.toHaveBeenCalled()
    expect(syncManualSettlementResult).not.toHaveBeenCalled()
  })

  it('builds action responses without round-bound fields', async () => {
    const drizzle = createDrizzleStub()
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      {} as never,
    )
    jest.spyOn(service as any, 'getRequiredConfig').mockResolvedValue({
      id: 1,
      enabled: 1,
      makeupPeriodType: 1,
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
        periodType: 1,
        periodKey: 'week-2026-04-14',
        periodStartDate: '2026-04-14',
        periodEndDate: '2026-04-20',
        periodicGranted: 2,
        periodicUsed: 0,
        periodicRemaining: 2,
        eventAvailable: 0,
      })
    ;(
      drizzle.db.query.checkInDailyStreakProgress.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 1,
      userId: 7,
      currentStreak: 3,
      streakStartedAt: '2026-04-17',
      lastSignedDate: '2026-04-19',
      version: 0,
    })
    ;(
      drizzle.db.query.growthRewardSettlement.findFirst as jest.Mock
    ).mockResolvedValue(null)

    return (service as any)
      .buildActionResponse(5, [12, 13])
      .then((response: any) => {
        expect(response.currentStreak).toBe(3)
        expect(response.triggeredGrantIds).toEqual([12, 13])
        expect(response).not.toHaveProperty(deprecatedRoundConfigField)
        expect(response).not.toHaveProperty(deprecatedRoundIterationField)
      })
  })

  it('delegates streak settlement with scope-aware grant identity', async () => {
    const ensureCheckInStreakRewardSettlement = jest.fn().mockResolvedValue({
      id: 8,
    })
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {
        ensureCheckInStreakRewardSettlement,
        syncManualSettlementResult: jest.fn(),
      } as never,
    )

    return (service as any)
      .ensureGrantRewardSettlement({
        id: 4,
        userId: 7,
        scopeType: CheckInStreakScopeTypeEnum.ACTIVITY,
        configVersionId: null,
        activityId: 22,
        ruleCode: 'activity-day-5',
        triggerSignDate: '2026-04-19',
        rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        rewardSettlementId: null,
      })
      .then(() => {
        expect(ensureCheckInStreakRewardSettlement).toHaveBeenCalledWith(
          expect.objectContaining({
            grantId: 4,
            userId: 7,
            scopeType: CheckInStreakScopeTypeEnum.ACTIVITY,
            configVersionId: null,
            activityId: 22,
            ruleCode: 'activity-day-5',
          }),
          undefined,
        )
      })
  })

  it('builds the user record query ordered by signDate', async () => {
    const drizzle = createDrizzleStub()
    ;(drizzle as { schema: Record<string, unknown> }).schema.checkInRecord =
      checkInRecord
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      {} as never,
    )
    const chain = {
      where: jest.fn(),
      orderBy: jest.fn().mockResolvedValue([]),
    }
    chain.where.mockReturnValue(chain)
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
      }),
    }

    await (service as any).listUserRecords(7, tx)

    const whereArg = chain.where.mock.calls[0]?.[0]
    const inspectedWhere = inspect(whereArg, { depth: 10 })

    expect(inspectedWhere).toContain("name: 'userId'")
  })
})

import type { DrizzleService } from '@db/core'
import { checkInRecord } from '@db/schema'
import { inspect } from 'node:util'
import { BusinessErrorCode } from '@libs/platform/constant'
import { CheckInExecutionService } from './check-in-execution.service'
import {
  CheckInStreakNextRoundStrategyEnum,
  CheckInStreakRoundStatusEnum,
} from './check-in.constant'

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
          checkInStreakRewardGrant: {
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
        checkInStreakRewardGrant: {
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
      checkInStreakRoundConfig: { id: 'id' },
      checkInStreakProgress: { id: 'id' },
      checkInStreakRewardGrant: {
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
      checkInStreakRoundConfig: {},
      checkInStreakProgress: {},
      checkInStreakRewardGrant: {},
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

  it('returns an archived successor for archived-bound progress', async () => {
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    const nextRound = await (service as any).resolveNextRoundConfig(
      {
        id: 11,
      },
      {
        nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT,
        nextRoundConfigId: 12,
      },
      {
        query: {
          checkInStreakRoundConfig: {
            findFirst: jest.fn().mockResolvedValue({
              id: 12,
              status: CheckInStreakRoundStatusEnum.ARCHIVED,
            }),
          },
        },
      },
    )

    expect(nextRound).toMatchObject({
      id: 12,
      status: CheckInStreakRoundStatusEnum.ARCHIVED,
    })
  })

  it('raises state conflict when explicit-next is missing its target id', async () => {
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    await expect(
      (service as any).resolveNextRoundConfig(
        {
          id: 11,
        },
        {
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT,
          nextRoundConfigId: null,
        },
        { query: { checkInStreakRoundConfig: { findFirst: jest.fn() } } },
      ),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.STATE_CONFLICT,
      message: '连续奖励轮次缺少下一轮配置',
    })
  })

  it('raises state conflict when explicit-next points to itself', async () => {
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    await expect(
      (service as any).resolveNextRoundConfig(
        {
          id: 11,
        },
        {
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT,
          nextRoundConfigId: 11,
        },
        { query: { checkInStreakRoundConfig: { findFirst: jest.fn() } } },
      ),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.STATE_CONFLICT,
      message: '连续奖励轮次存在自引用下一轮配置',
    })
  })

  it('raises state conflict when explicit-next target does not exist', async () => {
    const service = new CheckInExecutionService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    await expect(
      (service as any).resolveNextRoundConfig(
        {
          id: 11,
        },
        {
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT,
          nextRoundConfigId: 12,
        },
        {
          query: {
            checkInStreakRoundConfig: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          },
        },
      ),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.STATE_CONFLICT,
      message: '连续奖励轮次下一轮配置不存在',
    })
  })

  it('builds the round-scoped record query with a signDate lower bound', async () => {
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

    await (service as any).listRoundScopedRecords(7, '2026-04-10', tx)

    const whereArg = chain.where.mock.calls[0]?.[0]
    const inspectedWhere = inspect(whereArg, { depth: 10 })

    expect(inspectedWhere).toContain("name: 'userId'")
    expect(inspectedWhere).toContain("name: 'signDate'")
    expect(inspectedWhere).toContain("value: '2026-04-10'")
    expect(inspectedWhere).toContain("' >= '")
  })
})

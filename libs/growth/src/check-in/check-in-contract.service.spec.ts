/// <reference types="jest" />

import {
  CheckInMakeupPeriodTypeEnum,
  CheckInRecordTypeEnum,
} from './check-in.constant'
import { CheckInCalendarReadModelService } from './check-in-calendar-read-model.service'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInRuntimeService } from './check-in-runtime.service'

describe('CheckIn app/admin contract boundaries', () => {
  it('app summary returns narrow config and app-safe latest record without settlement lookups', async () => {
    const db = buildRuntimeDb()
    const rewardPolicyService = buildRewardPolicyService()
    const settlementService = {
      buildGrantRewardItemMap: jest.fn(() =>
        Promise.resolve(
          new Map([[88, [{ amount: 5, assetKey: 'points', assetType: 1 }]]]),
        ),
      ),
      buildSettlementMapById: jest.fn(),
    }
    const service = new CheckInRuntimeService(
      buildDrizzle(db) as never,
      {} as never,
      rewardPolicyService as never,
      {
        buildCurrentMakeupAccountView: jest.fn(() =>
          Promise.resolve({
            eventAvailable: 0,
            periodEndDate: '2026-05-31',
            periodKey: 'month-2026-05-01',
            periodStartDate: '2026-05-01',
            periodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
            periodicGranted: 2,
            periodicRemaining: 1,
            periodicUsed: 1,
          }),
        ),
      } as never,
      buildStreakService() as never,
      settlementService as never,
      {} as never,
    ) as never as CheckInRuntimeService & { getRequiredConfig: jest.Mock }
    service.getRequiredConfig = jest.fn(
      () =>
        Promise.resolve({
          baseRewardItems: null,
          createdAt: new Date('2026-05-31T00:00:00.000Z'),
          dateRewardRules: null,
          id: 1,
          isEnabled: 1,
          makeupIconUrl: null,
          makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
          patternRewardRules: null,
          periodicAllowance: 2,
          rewardOverviewIconUrl: null,
          updatedAt: new Date('2026-05-31T00:00:00.000Z'),
          updatedById: null,
        }) as never,
    )

    const summary = await service.getSummary(33)

    expect(summary.config).toEqual({
      baseRewardItems: [{ amount: 10, assetKey: 'points', assetType: 1 }],
      isEnabled: true,
      makeupIconUrl: 'https://cdn.example.com/makeup.png',
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
      periodicAllowance: 2,
      rewardOverviewIconUrl: 'https://cdn.example.com/reward.png',
    })
    expect(summary.config).not.toHaveProperty('dateRewardRules')
    expect(summary.config).not.toHaveProperty('patternRewardRules')
    expect(summary.config).not.toHaveProperty('createdAt')
    expect(summary.streak.streakStartedAt).toBe('2026-05-30')
    expect(summary.streak.lastSignedDate).toBe('2026-05-31')
    expect(summary.latestRecord).toMatchObject({
      resolvedMakeupIconUrl: null,
      resolvedRewardOverviewIconUrl: 'https://cdn.example.com/reward.png',
    })
    expect(summary.latestRecord).not.toHaveProperty('rewardSettlement')
    expect(summary.latestRecord).not.toHaveProperty('rewardSettlementId')
    expect(summary.latestRecord?.grants[0]).toMatchObject({
      rewardOverviewIconUrl: null,
    })
    expect(summary.latestRecord?.grants[0]).not.toHaveProperty(
      'rewardSettlement',
    )
    expect(summary.latestRecord?.grants[0]).not.toHaveProperty(
      'rewardSettlementId',
    )
    expect(settlementService.buildSettlementMapById).not.toHaveBeenCalled()
  })

  it('app sign response keeps settlement side effects but omits settlement internals', async () => {
    const actionDb = buildActionDb()
    const settlementService = {
      settleGrantReward: jest.fn(
        (_grantId: number, _context: Record<string, unknown>) =>
          Promise.resolve(true),
      ),
      settleRecordReward: jest.fn(
        (_recordId: number, _context: Record<string, unknown>) =>
          Promise.resolve(true),
      ),
    }
    const service = new CheckInExecutionService(
      { db: actionDb, schema: {} } as never,
      {} as never,
      buildRewardPolicyService() as never,
      {
        buildCurrentMakeupAccountView: jest.fn(() =>
          Promise.resolve({
            eventAvailable: 0,
            periodKey: 'month-2026-05-01',
            periodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
            periodicRemaining: 1,
          }),
        ),
      } as never,
      {} as never,
      settlementService as never,
    ) as never as {
      buildActionResponse(recordId: number): Promise<Record<string, unknown>>
      checkInSettlementService: typeof settlementService
      getRequiredConfig: jest.Mock
    }
    service.getRequiredConfig = jest.fn(() =>
      Promise.resolve({
        makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
      }),
    )

    await service.checkInSettlementService.settleRecordReward(90, {})
    await service.checkInSettlementService.settleGrantReward(88, {})
    const response = await service.buildActionResponse(90)

    expect(settlementService.settleRecordReward).toHaveBeenCalledWith(90, {})
    expect(settlementService.settleGrantReward).toHaveBeenCalledWith(88, {})
    expect(response).not.toHaveProperty('rewardSettlement')
    expect(response).not.toHaveProperty('rewardSettlementId')
    expect(response).not.toHaveProperty('triggeredGrantIds')
    expect(response).toMatchObject({
      currentStreak: 3,
      eventAvailable: 0,
      periodicRemaining: 1,
      resolvedMakeupIconUrl: null,
      resolvedRewardOverviewIconUrl: 'https://cdn.example.com/reward.png',
    })
  })

  it('app record page batches grants without settlement diagnostics', async () => {
    const db = buildRuntimeDb()
    const rewardPolicyService = buildRewardPolicyService()
    const settlementService = {
      buildGrantRewardItemMap: jest.fn(() =>
        Promise.resolve(
          new Map([[88, [{ amount: 5, assetKey: 'points', assetType: 1 }]]]),
        ),
      ),
      buildSettlementMapById: jest.fn(),
    }
    const service = new CheckInRuntimeService(
      buildDrizzle(db) as never,
      {} as never,
      rewardPolicyService as never,
      {} as never,
      buildStreakService() as never,
      settlementService as never,
      {} as never,
    )

    const page = await service.getMyRecords(
      { pageIndex: 1, pageSize: 10 } as never,
      33,
    )

    expect(page.list).toHaveLength(2)
    expect(page.list[0].grants).toEqual([
      expect.objectContaining({
        id: 88,
        rewardItems: [{ amount: 5, assetKey: 'points', assetType: 1 }],
      }),
    ])
    expect(page.list[0].grants[0]).not.toHaveProperty('rewardSettlement')
    expect(page.list[0].grants[0]).not.toHaveProperty('rewardSettlementId')
    expect(db.select).toHaveBeenCalledTimes(2)
    expect(settlementService.buildGrantRewardItemMap).toHaveBeenCalledTimes(1)
    expect(settlementService.buildSettlementMapById).not.toHaveBeenCalled()
  })

  it('admin signed-user mapper keeps settlement diagnostics', async () => {
    const service = new CheckInCalendarReadModelService(
      { schema: {} } as never,
      {} as never,
      buildRewardPolicyService() as never,
      {} as never,
      {
        toRewardSettlementSummary: jest.fn((settlement) =>
          settlement
            ? {
                id: settlement.id,
                lastError: settlement.lastError,
                ledgerRecordIds: settlement.ledgerRecordIds,
                retryCount: settlement.retryCount,
              }
            : null,
        ),
      } as never,
    ) as never as {
      toRecordItemView(
        record: Record<string, unknown>,
        settlementMap: Map<number, Record<string, unknown>>,
        grantMap: Map<string, unknown[]>,
      ): Record<string, unknown>
    }

    const item = service.toRecordItemView(
      {
        createdAt: new Date('2026-05-31T00:00:00.000Z'),
        id: 90,
        recordType: CheckInRecordTypeEnum.NORMAL,
        resolvedRewardItems: [{ amount: 10, assetKey: 'points', assetType: 1 }],
        resolvedRewardRuleKey: 'BASE',
        resolvedRewardSourceType: 1,
        rewardSettlementId: 900,
        signDate: '2026-05-31',
        updatedAt: new Date('2026-05-31T00:00:00.000Z'),
        userId: 33,
      },
      new Map([
        [
          900,
          {
            id: 900,
            lastError: 'timeout',
            ledgerRecordIds: [1, 2],
            retryCount: 2,
          },
        ],
      ]),
      new Map(),
    )

    expect(item.rewardSettlementId).toBe(900)
    expect(item.resolvedMakeupIconUrl).toBeNull()
    expect(item.resolvedRewardOverviewIconUrl).toBeNull()
    expect(item.rewardSettlement).toEqual({
      id: 900,
      lastError: 'timeout',
      ledgerRecordIds: [1, 2],
      retryCount: 2,
    })
  })
})

function buildRuntimeDb() {
  const latestRecord = {
    createdAt: new Date('2026-05-31T00:00:00.000Z'),
    id: 90,
    recordType: CheckInRecordTypeEnum.NORMAL,
    resolvedMakeupIconUrl: null,
    resolvedRewardItems: [{ amount: 10, assetKey: 'points', assetType: 1 }],
    resolvedRewardOverviewIconUrl: 'https://cdn.example.com/reward.png',
    resolvedRewardRuleKey: 'BASE',
    resolvedRewardSourceType: 1,
    rewardSettlementId: 900,
    signDate: '2026-05-31',
    updatedAt: new Date('2026-05-31T00:00:00.000Z'),
    userId: 33,
  }
  const pageRecords = [
    latestRecord,
    {
      ...latestRecord,
      id: 89,
      signDate: '2026-05-30',
    },
  ]
  const grants = [
    {
      bizKey: 'checkin:grant',
      context: null,
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      id: 88,
      repeatable: false,
      rewardOverviewIconUrl: null,
      rewardSettlementId: 901,
      ruleCode: 'day-2',
      ruleId: 7,
      streakDays: 2,
      triggerSignDate: '2026-05-31',
      updatedAt: new Date('2026-05-31T00:00:00.000Z'),
      userId: 33,
    },
  ]
  const selectResults = [pageRecords, grants, grants]
  return {
    $count: jest.fn(() => Promise.resolve(pageRecords.length)),
    query: {
      checkInRecord: {
        findFirst: jest.fn(() => Promise.resolve({ id: 91 })),
      },
      checkInStreakProgress: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            currentStreak: 2,
            lastSignedDate: '2026-05-31',
            streakStartedAt: '2026-05-30',
          }),
        ),
      },
    },
    select: jest.fn((selection?: Record<string, unknown>) => {
      if (selection?.nickname) {
        return {
          from: jest.fn(() => ({
            where: jest.fn(() =>
              Promise.resolve([
                { avatarUrl: 'avatar.png', id: 33, nickname: 'User' },
              ]),
            ),
          })),
        }
      }
      const result = selectResults.shift() ?? []
      const orderResult = {
        limit: jest.fn(() => ({
          offset: jest.fn(() => Promise.resolve(result)),
          then: (
            resolve: (value: unknown[]) => unknown,
            reject?: (reason?: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject),
        })),
        then: (
          resolve: (value: unknown[]) => unknown,
          reject?: (reason?: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject),
      }
      return {
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => orderResult),
          })),
        })),
      }
    }),
  }
}

function buildActionDb() {
  return {
    query: {
      checkInRecord: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            createdAt: new Date('2026-05-31T00:00:00.000Z'),
            id: 90,
            recordType: CheckInRecordTypeEnum.NORMAL,
            resolvedMakeupIconUrl: null,
            resolvedRewardItems: [
              { amount: 10, assetKey: 'points', assetType: 1 },
            ],
            resolvedRewardOverviewIconUrl: 'https://cdn.example.com/reward.png',
            resolvedRewardRuleKey: 'BASE',
            resolvedRewardSourceType: 1,
            rewardSettlementId: 900,
            signDate: '2026-05-31',
            updatedAt: new Date('2026-05-31T00:00:00.000Z'),
            userId: 33,
          }),
        ),
      },
      checkInStreakProgress: {
        findFirst: jest.fn(() => Promise.resolve({ currentStreak: 3 })),
      },
    },
  }
}

function buildDrizzle(db: Record<string, unknown>) {
  return {
    buildOrderBy: jest.fn(() => ({ orderBySql: [] })),
    buildPage: jest.fn(() => ({
      limit: 1,
      offset: 0,
      pageIndex: 1,
      pageSize: 1,
    })),
    db,
    schema: {
      appUser: {
        avatarUrl: 'app_user.avatar_url',
        id: 'app_user.id',
        nickname: 'app_user.nickname',
      },
      checkInRecord: {
        id: 'check_in_record.id',
        signDate: 'check_in_record.sign_date',
        userId: 'check_in_record.user_id',
      },
      checkInStreakGrant: {
        id: 'check_in_streak_grant.id',
        triggerSignDate: 'check_in_streak_grant.trigger_sign_date',
        userId: 'check_in_streak_grant.user_id',
      },
    },
  }
}

function buildRewardPolicyService() {
  return {
    parseRewardDefinition: jest.fn(() => ({
      baseRewardItems: [{ amount: 10, assetKey: 'points', assetType: 1 }],
      dateRewardRules: [{ rewardDate: '2026-06-01' }],
      makeupIconUrl: 'https://cdn.example.com/makeup.png',
      patternRewardRules: [{ patternType: 1 }],
      rewardOverviewIconUrl: 'https://cdn.example.com/reward.png',
    })),
    parseStoredRewardItems: jest.fn((value) => value ?? null),
    resolveNextStreakReward: jest.fn(() => null),
  }
}

function buildStreakService() {
  return {
    listActiveStreakRulesAt: jest.fn(() => Promise.resolve([])),
    resolveEffectiveCurrentStreak: jest.fn(() => 2),
    resolveEffectiveLastSignedDate: jest.fn(() => '2026-05-31'),
    toStreakRewardRuleViews: jest.fn(() => []),
  }
}

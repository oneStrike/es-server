/// <reference types="jest" />

import { CheckInRecordTypeEnum } from './check-in.constant'
import { CheckInExecutionService } from './check-in-execution.service'

describe('CheckInExecutionService streak grant write path', () => {
  it('normal sign uses incremental progress and never loads full user history', async () => {
    const streakService = {
      buildIncrementalNormalSignAggregation: jest.fn(() => ({
        currentStreak: 2,
        lastSignedDate: '2026-05-31',
        streakByDate: { '2026-05-31': 2 },
        streakStartedAt: '2026-05-30',
      })),
      buildMakeupBoundedStreakAggregation: jest.fn(),
      getOrCreateStreakProgress: jest.fn(() =>
        Promise.resolve({
          currentStreak: 1,
          id: 10,
          lastSignedDate: '2026-05-30',
          streakStartedAt: '2026-05-30',
          version: 3,
        }),
      ),
      listActiveStreakRulesAt: jest.fn(() =>
        Promise.resolve([
          {
            id: 77,
            repeatable: false,
            rewardItems: [],
            rewardOverviewIconUrl: null,
            ruleCode: 'streak-day-2',
            status: 2,
            streakDays: 2,
          },
        ]),
      ),
      listUserRecords: jest.fn(),
      resolveEligibleGrantRules: jest.fn(() => [
        {
          rule: {
            repeatable: false,
            rewardItems: [],
            rewardOverviewIconUrl: null,
            ruleCode: 'streak-day-2',
            streakDays: 2,
          },
          triggerSignDate: '2026-05-31',
        },
      ]),
      updateStreakProgress: jest.fn(() => Promise.resolve()),
    }
    const settlementService = {
      insertGrantRewardItems: jest.fn(() => Promise.resolve()),
    }
    const tx = buildGrantTx([{ id: 99 }])
    const service = new CheckInExecutionService(
      { schema: buildSchema() } as any,
      {} as any,
      {} as any,
      {} as any,
      streakService as any,
      settlementService as any,
    ) as any

    await expect(
      service.processStreakGrants(
        33,
        '2026-05-31',
        CheckInRecordTypeEnum.NORMAL,
        {
          periodEndDate: '2026-05-31',
          periodKey: 'month-2026-05-01',
          periodStartDate: '2026-05-01',
          periodType: 2,
        },
        tx,
        new Date('2026-05-31T08:00:00+08:00'),
      ),
    ).resolves.toEqual([99])

    expect(streakService.listUserRecords).not.toHaveBeenCalled()
    expect(
      streakService.buildMakeupBoundedStreakAggregation,
    ).not.toHaveBeenCalled()
    expect(
      streakService.buildIncrementalNormalSignAggregation,
    ).toHaveBeenCalled()
    expect(streakService.listActiveStreakRulesAt).toHaveBeenCalledTimes(1)
    expect(streakService.updateStreakProgress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, version: 3 }),
      expect.objectContaining({
        currentStreak: 2,
        streakByDate: { '2026-05-31': 2 },
      }),
      tx,
    )
    expect(settlementService.insertGrantRewardItems).toHaveBeenCalledWith(
      99,
      [],
      tx,
    )
  })

  it('admin repair recomputes streak progress, creates missing grants, and settles them', async () => {
    const streakService = {
      getOrCreateStreakProgress: jest.fn(() =>
        Promise.resolve({
          currentStreak: 0,
          id: 10,
          lastSignedDate: null,
          streakStartedAt: null,
          version: 3,
        }),
      ),
      listUserRecords: jest.fn(() =>
        Promise.resolve([
          { signDate: '2026-05-30' },
          { signDate: '2026-05-31' },
        ]),
      ),
      recomputeStreakAggregation: jest.fn(() => ({
        currentStreak: 2,
        lastSignedDate: '2026-05-31',
        streakByDate: {
          '2026-05-30': 1,
          '2026-05-31': 2,
        },
        streakStartedAt: '2026-05-30',
      })),
      listActiveStreakRulesAt: jest.fn(() =>
        Promise.resolve([
          {
            id: 77,
            repeatable: false,
            rewardItems: [{ amount: 5, assetKey: 'points', assetType: 1 }],
            rewardOverviewIconUrl: null,
            ruleCode: 'streak-day-2',
            status: 2,
            streakDays: 2,
          },
        ]),
      ),
      resolveEligibleGrantRules: jest.fn((_rules, streakByDate) =>
        streakByDate['2026-05-31'] === 2
          ? [
              {
                rule: {
                  repeatable: false,
                  rewardItems: [
                    { amount: 5, assetKey: 'points', assetType: 1 },
                  ],
                  rewardOverviewIconUrl: null,
                  ruleCode: 'streak-day-2',
                  streakDays: 2,
                },
                triggerSignDate: '2026-05-31',
              },
            ]
          : [],
      ),
      updateStreakProgress: jest.fn(() => Promise.resolve()),
    }
    const settlementService = {
      insertGrantRewardItems: jest.fn(() => Promise.resolve()),
      settleGrantReward: jest.fn(() => Promise.resolve(true)),
    }
    const tx = buildGrantTx([{ id: 99 }])
    const service = new CheckInExecutionService(
      {
        schema: {
          ...buildSchema(),
          appUser: { id: 'app_user.id' },
        },
        withTransaction: jest.fn((callback) => callback(tx)),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      streakService as any,
      settlementService as any,
    ) as any

    const result = await service.repairStreak({ userId: 33 }, 7)

    expect(result).toEqual({
      userId: 33,
      currentStreak: 2,
      streakStartedAt: '2026-05-30',
      lastSignedDate: '2026-05-31',
      createdGrantIds: [99],
      settledGrantIds: [99],
    })
    expect(streakService.listUserRecords).toHaveBeenCalledWith(33, tx)
    expect(streakService.updateStreakProgress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, version: 3 }),
      expect.objectContaining({
        currentStreak: 2,
        streakByDate: {
          '2026-05-30': 1,
          '2026-05-31': 2,
        },
      }),
      tx,
    )
    expect(settlementService.insertGrantRewardItems).toHaveBeenCalledWith(
      99,
      [{ amount: 5, assetKey: 'points', assetType: 1 }],
      tx,
    )
    expect(settlementService.settleGrantReward).toHaveBeenCalledWith(99, {
      actorUserId: 7,
      isRetry: true,
    })
  })

  it('admin repair retries current-chain grants that already exist but are still pending', async () => {
    const streakService = {
      getOrCreateStreakProgress: jest.fn(() =>
        Promise.resolve({
          currentStreak: 2,
          id: 10,
          lastSignedDate: '2026-05-31',
          streakStartedAt: '2026-05-30',
          version: 3,
        }),
      ),
      listUserRecords: jest.fn(() =>
        Promise.resolve([
          { signDate: '2026-05-30' },
          { signDate: '2026-05-31' },
        ]),
      ),
      recomputeStreakAggregation: jest.fn(() => ({
        currentStreak: 2,
        lastSignedDate: '2026-05-31',
        streakByDate: {
          '2026-05-30': 1,
          '2026-05-31': 2,
        },
        streakStartedAt: '2026-05-30',
      })),
      listActiveStreakRulesAt: jest.fn(() => Promise.resolve([])),
      resolveEligibleGrantRules: jest.fn(() => []),
      updateStreakProgress: jest.fn(() => Promise.resolve()),
    }
    const settlementService = {
      insertGrantRewardItems: jest.fn(() => Promise.resolve()),
      settleGrantReward: jest.fn(() => Promise.resolve(true)),
    }
    const tx = buildGrantTx([], [{ id: 88 }])
    const service = new CheckInExecutionService(
      {
        schema: {
          ...buildSchema(),
          appUser: { id: 'app_user.id' },
          growthRewardSettlement: {
            id: 'growth_reward_settlement.id',
            settlementStatus: 'growth_reward_settlement.settlement_status',
          },
        },
        withTransaction: jest.fn((callback) => callback(tx)),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      streakService as any,
      settlementService as any,
    ) as any

    const result = await service.repairStreak({ userId: 33 }, 7)

    expect(result).toEqual({
      userId: 33,
      currentStreak: 2,
      streakStartedAt: '2026-05-30',
      lastSignedDate: '2026-05-31',
      createdGrantIds: [],
      settledGrantIds: [88],
    })
    expect(settlementService.insertGrantRewardItems).not.toHaveBeenCalled()
    expect(settlementService.settleGrantReward).toHaveBeenCalledTimes(1)
    expect(settlementService.settleGrantReward).toHaveBeenCalledWith(88, {
      actorUserId: 7,
      isRetry: true,
    })
  })
})

function buildSchema() {
  return {
    checkInStreakGrant: {
      bizKey: 'check_in_streak_grant.biz_key',
      id: 'check_in_streak_grant.id',
      rewardSettlementId: 'check_in_streak_grant.reward_settlement_id',
      ruleCode: 'check_in_streak_grant.rule_code',
      triggerSignDate: 'check_in_streak_grant.trigger_sign_date',
      userId: 'check_in_streak_grant.user_id',
    },
    growthRewardSettlement: {
      id: 'growth_reward_settlement.id',
      settlementStatus: 'growth_reward_settlement.settlement_status',
    },
  }
}

function buildGrantTx(
  returningRows: Array<Record<string, unknown>>,
  retryableGrantRows: Array<Record<string, unknown>> = [],
) {
  let selectCallCount = 0
  const tx: any = {
    query: {
      appUser: {
        findFirst: jest.fn(() => Promise.resolve({ id: 33 })),
      },
    },
    select: jest.fn(() => {
      selectCallCount += 1
      const rows = selectCallCount === 1 ? retryableGrantRows : []

      return {
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => Promise.resolve(rows)),
            })),
          })),
          where: jest.fn(() => ({
            orderBy: jest.fn(() => Promise.resolve(rows)),
          })),
        })),
      }
    }),
  }
  tx.insert = jest.fn(() => ({
    values: jest.fn(() => ({
      onConflictDoNothing: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve(returningRows)),
      })),
    })),
  }))
  return tx
}

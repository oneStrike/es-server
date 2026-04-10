import * as schema from '@db/schema'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerSourceEnum,
} from '@libs/growth/growth-ledger/growth-ledger.constant'
import { NotFoundException } from '@nestjs/common'
import { CheckInExecutionService } from '../check-in-execution.service'
import {
  CheckInCycleTypeEnum,
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRepairTargetTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInRewardStatusEnum,
} from '../check-in.constant'

describe('check-in execution service', () => {
  it('构建签到记录写表载荷时会冻结奖励来源、规则 ID 与解析结果', () => {
    const service = new CheckInExecutionService(
      {
        db: {},
        schema,
      } as any,
      {} as any,
    )

    const payload = (service as any).buildRecordInsert({
      userId: 9,
      planId: 1,
      cycleId: 2,
      cycleKey: 'week-2026-04-06',
      signDate: '2026-04-08',
      recordType: CheckInRecordTypeEnum.NORMAL,
      operatorType: CheckInOperatorTypeEnum.USER,
      rewardApplicable: true,
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
      resolvedRewardRuleId: 23,
      resolvedRewardConfig: { points: 30 },
      context: { source: 'app_sign' },
    })

    expect(payload).toMatchObject({
      userId: 9,
      planId: 1,
      cycleId: 2,
      signDate: '2026-04-08',
      recordType: CheckInRecordTypeEnum.NORMAL,
      rewardStatus: CheckInRewardStatusEnum.PENDING,
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
      resolvedRewardRuleId: 23,
      resolvedRewardConfig: { points: 30 },
      operatorType: CheckInOperatorTypeEnum.USER,
      context: { source: 'app_sign' },
    })
  })

  it('补偿基础奖励时会优先使用签到记录冻结的奖励快照', async () => {
    const applyDeltaMock = jest.fn().mockResolvedValue({
      success: true,
      duplicated: false,
      recordId: 501,
    })
    const record = {
      id: 100,
      userId: 9,
      planId: 1,
      cycleId: 2,
      resolvedRewardConfig: { points: 30 },
    }
    const cycle = {
      id: 2,
      planSnapshot: {
        dateRewardRules: [
          {
            id: 21,
            planVersion: 1,
            rewardDate: '2026-04-08',
            rewardConfig: { points: 999 },
          },
        ],
        patternRewardRules: [],
      },
    }

    const tx = {
      select: jest.fn(() => ({
        from: jest.fn((table: unknown) => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue(
              table === schema.checkInRecord ? [record] : [cycle],
            ),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        })),
      })),
    }

    const drizzle = {
      db: {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn().mockResolvedValue({ rowCount: 1 }),
          })),
        })),
      },
      schema,
      withTransaction: jest.fn(
        async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx),
      ),
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }

    const service = new CheckInExecutionService(
      drizzle as any,
      {
        applyDelta: applyDeltaMock,
      } as any,
    )

    await (service as any).settleRecordReward(100, {
      source: 'record_reward',
    })

    expect(applyDeltaMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        assetType: GrowthAssetTypeEnum.POINTS,
        action: GrowthLedgerActionEnum.GRANT,
        amount: 30,
        source: GrowthLedgerSourceEnum.CHECK_IN_BASE_BONUS,
      }),
    )
  })

  it('动作返回视图会回填冻结奖励来源、规则 ID 与奖励配置', async () => {
    const record = {
      id: 100,
      cycleId: 2,
      signDate: '2026-04-08',
      recordType: CheckInRecordTypeEnum.NORMAL,
      rewardStatus: CheckInRewardStatusEnum.SUCCESS,
      rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
      resolvedRewardRuleId: 21,
      resolvedRewardConfig: { points: 30 },
    }
    const cycle = {
      id: 2,
      currentStreak: 3,
      signedCount: 3,
      makeupUsedCount: 0,
      planSnapshot: {
        allowMakeupCountPerCycle: 2,
        cycleType: 'monthly',
        dateRewardRules: [],
        patternRewardRules: [],
        streakRewardRules: [],
      },
    }
    let callIndex = 0
    const drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: jest.fn().mockImplementation(async () => {
                callIndex += 1
                return callIndex === 1 ? [record] : [cycle]
              }),
            })),
          })),
        })),
      },
      schema,
    }

    const service = new CheckInExecutionService(drizzle as any, {} as any)

    const result = await (service as any).buildLatestActionView(100, {
      alreadyExisted: false,
      triggeredGrantIds: [201],
    })

    expect(result).toMatchObject({
      recordId: 100,
      cycleId: 2,
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
      resolvedRewardRuleId: 21,
      resolvedRewardConfig: { points: 30 },
      triggeredGrantIds: [201],
      alreadyExisted: false,
    })
  })

  it('repairReward 会把基础奖励补偿请求分派给签到记录补偿链路', async () => {
    const service = new CheckInExecutionService(
      {
        db: {},
        schema,
      } as any,
      {} as any,
    )
    const settleRecordRewardSpy = jest
      .spyOn(service as any, 'settleRecordReward')
      .mockResolvedValue(true)

    const result = await service.repairReward(
      {
        targetType: 1,
        recordId: 100,
      } as any,
      99,
    )

    expect(settleRecordRewardSpy).toHaveBeenCalledWith(100, {
      actorUserId: 99,
      source: 'admin_repair',
    })
    expect(result).toEqual({
      targetType: 1,
      recordId: 100,
      success: true,
    })
  })

  it('repairReward 遇到不存在的签到记录时会保留 404 语义', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
    }

    const service = new CheckInExecutionService(
      {
        db: {
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn().mockResolvedValue({ rowCount: 0 }),
            })),
          })),
        },
        schema,
        withTransaction: jest.fn(
          async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx),
        ),
        withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      } as any,
      {} as any,
    )

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.RECORD_REWARD,
          recordId: 404,
        } as any,
        99,
      ),
    ).rejects.toThrow(new NotFoundException('签到记录不存在'))
  })

  it('repairReward 遇到不存在的连续奖励发放事实时会保留 404 语义', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
    }

    const service = new CheckInExecutionService(
      {
        db: {
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn().mockResolvedValue({ rowCount: 0 }),
            })),
          })),
        },
        schema,
        withTransaction: jest.fn(
          async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx),
        ),
        withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      } as any,
      {} as any,
    )

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.STREAK_GRANT,
          grantId: 405,
        } as any,
        99,
      ),
    ).rejects.toThrow(new NotFoundException('连续奖励发放事实不存在'))
  })

  it('周期聚合版本冲突时会重试签到事务', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-10T12:00:00.000Z'))

    let attempt = 0
    const drizzle = {
      db: {},
      schema,
      withTransaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => {
        attempt += 1
        const currentAttempt = attempt
        const tx = {
          insert: jest.fn((table: unknown) => {
            if (table === schema.checkInRecord) {
              return {
                values: jest.fn(() => ({
                  onConflictDoNothing: jest.fn(() => ({
                    returning: jest.fn().mockResolvedValue([
                      {
                        id: 100 + currentAttempt,
                        recordType: CheckInRecordTypeEnum.NORMAL,
                        rewardStatus: null,
                        rewardResultType: null,
                      },
                    ]),
                  })),
                })),
              }
            }

            if (table === schema.checkInStreakRewardGrant) {
              return {
                values: jest.fn(() => ({
                  onConflictDoNothing: jest.fn(() => ({
                    returning: jest.fn().mockResolvedValue([]),
                  })),
                })),
              }
            }

            throw new Error('unexpected insert target')
          }),
          update: jest.fn((table: unknown) => {
            if (table === schema.checkInCycle) {
              return {
                set: jest.fn(() => ({
                  where: jest
                    .fn()
                    .mockResolvedValue(
                      currentAttempt === 1 ? { rowCount: 0 } : { rowCount: 1 },
                    ),
                })),
              }
            }

            throw new Error('unexpected update target')
          }),
        }

        return fn(tx)
      }),
    }

    const service = new CheckInExecutionService(drizzle as any, {} as any)
    jest.spyOn(service as any, 'getCurrentActivePlan').mockResolvedValue({
      id: 1,
      version: 1,
    })
    jest.spyOn(service as any, 'createOrGetCycle').mockResolvedValue({
      id: 2,
      cycleKey: 'week-2026-04-06',
      planSnapshotVersion: 1,
      version: 0,
      planSnapshot: {
        cycleType: CheckInCycleTypeEnum.WEEKLY,
        allowMakeupCountPerCycle: 2,
        baseRewardConfig: null,
        dateRewardRules: [],
        patternRewardRules: [],
        streakRewardRules: [],
      },
    })
    jest.spyOn(service as any, 'findRecordByUniqueKey').mockResolvedValue(undefined)
    jest.spyOn(service as any, 'listCycleRecords').mockResolvedValue([
      {
        signDate: '2026-04-10',
        recordType: CheckInRecordTypeEnum.NORMAL,
      },
    ])
    jest.spyOn(service as any, 'listCycleGrants').mockResolvedValue([])
    jest
      .spyOn(service as any, 'resolveEligibleGrantCandidates')
      .mockReturnValue([])
    jest.spyOn(service as any, 'settleRecordReward').mockResolvedValue(true)
    jest.spyOn(service as any, 'settleGrantReward').mockResolvedValue(true)
    jest.spyOn(service as any, 'buildLatestActionView').mockResolvedValue({
      recordId: 102,
      cycleId: 2,
      signDate: '2026-04-10',
      recordType: CheckInRecordTypeEnum.NORMAL,
      rewardStatus: null,
      rewardResultType: null,
      resolvedRewardSourceType: null,
      resolvedRewardRuleId: null,
      resolvedRewardConfig: null,
      currentStreak: 1,
      signedCount: 1,
      remainingMakeupCount: 2,
      triggeredGrantIds: [],
      alreadyExisted: false,
    })

    await service.signToday(9)

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(2)
  })
})

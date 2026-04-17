import type { DrizzleService } from '@db/core'
import { CheckInExecutionService } from './check-in-execution.service'

function createDrizzleStub(params: {
  record: {
    id: number
    userId: number
    planId: number
    cycleId: number
    signDate: string
    resolvedRewardItems: unknown
    rewardSettlementId?: number | null
  }
  persistedRecord?: {
    id: number
    userId?: number
    planId?: number
    cycleId?: number
    signDate?: string
    resolvedRewardItems?: unknown
    rewardSettlementId?: number | null
  }
}) {
  const updateCheckInRecord = jest.fn()
  const txUpdateCheckInRecord = jest.fn()
  const updateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue({ rowCount: 1 }),
  }
  updateCheckInRecord.mockReturnValue(updateChain)
  txUpdateCheckInRecord.mockReturnValue(updateChain)
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([params.record]),
  }

  return {
    withTransaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
      callback({
        select: jest.fn().mockReturnValue(selectChain),
        update: txUpdateCheckInRecord,
        query: {
          growthRewardSettlement: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        },
      }),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    db: {
      update: updateCheckInRecord,
      query: {
        checkInRecord: {
          findFirst: jest.fn().mockResolvedValue(
            params.persistedRecord ?? {
              id: params.record.id,
              userId: params.record.userId,
              planId: params.record.planId,
              cycleId: params.record.cycleId,
              signDate: params.record.signDate,
              resolvedRewardItems: params.record.resolvedRewardItems,
              rewardSettlementId: params.record.rewardSettlementId ?? null,
            },
          ),
        },
        growthRewardSettlement: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    },
    __mocks: {
      updateCheckInRecord,
      txUpdateCheckInRecord,
    },
    schema: {
      checkInPlan: {},
      checkInCycle: {},
      checkInRecord: {
        id: 'id',
        rewardSettlementId: 'rewardSettlementId',
      },
      checkInStreakRewardGrant: {
        id: 'id',
        rewardSettlementId: 'rewardSettlementId',
      },
      growthRewardSettlement: {
        id: 'id',
      },
    },
  } as unknown as DrizzleService & {
    __mocks: {
      updateCheckInRecord: jest.Mock
      txUpdateCheckInRecord: jest.Mock
    }
  }
}

describe('checkInExecutionService reward settlement behavior', () => {
  it('uses the same transaction for settlement ensure and success sync', async () => {
    const txUpdateCheckInRecord = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue({ rowCount: 1 }),
    })
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            id: 5,
            userId: 7,
            planId: 3,
            cycleId: 8,
            signDate: '2026-04-17',
            resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
            rewardSettlementId: null,
          },
        ]),
      }),
      update: txUpdateCheckInRecord,
      query: {
        growthRewardSettlement: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    }
    const drizzle = {
      withTransaction: async <T>(callback: (runner: unknown) => Promise<T>) =>
        callback(tx),
      withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
      db: {
        update: jest.fn(),
        query: {
          checkInRecord: {
            findFirst: jest.fn(),
          },
          growthRewardSettlement: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        },
      },
      schema: {
        checkInPlan: {},
        checkInCycle: {},
        checkInRecord: {
          id: 'id',
          rewardSettlementId: 'rewardSettlementId',
        },
        checkInStreakRewardGrant: {
          id: 'id',
          rewardSettlementId: 'rewardSettlementId',
        },
        growthRewardSettlement: {
          id: 'id',
        },
      },
    } as unknown as DrizzleService
    const ensureCheckInRecordRewardSettlement = jest
      .fn()
      .mockResolvedValue({ id: 55 })
    const syncManualSettlementResult = jest.fn().mockResolvedValue(undefined)
    const service = new CheckInExecutionService(
      drizzle,
      {
        applyDelta: jest.fn().mockResolvedValue({
          success: true,
          duplicated: false,
          recordId: 11,
        }),
      } as never,
      {
        ensureCheckInRecordRewardSettlement,
        syncManualSettlementResult,
      } as never,
    )

    const success = await (service as any).settleRecordReward(5, {
      source: 'test',
    })

    expect(success).toBe(true)
    expect(ensureCheckInRecordRewardSettlement).toHaveBeenCalledWith(
      expect.any(Object),
      tx,
    )
    expect(syncManualSettlementResult).toHaveBeenCalledWith(
      55,
      expect.objectContaining({
        success: true,
      }),
      {
        isRetry: undefined,
        tx,
      },
    )
  })

  it('marks record reward repair as retry', async () => {
    const drizzle = createDrizzleStub({
      record: {
        id: 3,
        userId: 7,
        planId: 3,
        cycleId: 8,
        signDate: '2026-04-17',
        resolvedRewardItems: null,
        rewardSettlementId: null,
      },
    })
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      {} as never,
    )
    const settleRecordRewardSpy = jest
      .spyOn(service as any, 'settleRecordReward')
      .mockResolvedValue(true)

    await service.repairReward(
      {
        targetType: 1,
        recordId: 3,
      } as never,
      9,
    )

    expect(settleRecordRewardSpy).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        actorUserId: 9,
        source: 'admin_repair',
        isRetry: true,
      }),
    )
  })

  it('marks streak reward repair as retry', async () => {
    const drizzle = createDrizzleStub({
      record: {
        id: 4,
        userId: 7,
        planId: 3,
        cycleId: 8,
        signDate: '2026-04-17',
        resolvedRewardItems: null,
        rewardSettlementId: null,
      },
    })
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      {} as never,
    )
    const settleGrantRewardSpy = jest
      .spyOn(service as any, 'settleGrantReward')
      .mockResolvedValue(true)

    await service.repairReward(
      {
        targetType: 2,
        grantId: 4,
      } as never,
      9,
    )

    expect(settleGrantRewardSpy).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        actorUserId: 9,
        source: 'admin_repair',
        isRetry: true,
      }),
    )
  })

  it('rejects manual repair when record reward settlement is terminal', async () => {
    const drizzle = createDrizzleStub({
      record: {
        id: 6,
        userId: 7,
        planId: 3,
        cycleId: 8,
        signDate: '2026-04-17',
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        rewardSettlementId: null,
      },
    })
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      {
        ensureCheckInRecordRewardSettlement: jest
          .fn()
          .mockResolvedValue({ id: 55 }),
        syncManualSettlementResult: jest.fn(),
      } as never,
    )
    jest
      .spyOn(service as any, 'getSettlementById')
      .mockResolvedValue({
        id: 55,
        settlementStatus: 2,
      })

    await expect(
      service.repairReward(
        {
          targetType: 1,
          recordId: 6,
        } as never,
        9,
      ),
    ).rejects.toThrow('签到奖励已进入终态失败，无需重试')
  })

  it('rejects manual repair when streak reward settlement is terminal', async () => {
    const drizzle = createDrizzleStub({
      record: {
        id: 7,
        userId: 7,
        planId: 3,
        cycleId: 8,
        signDate: '2026-04-17',
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        rewardSettlementId: null,
        triggerSignDate: '2026-04-17',
        rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        ruleCode: 'streak-7',
      } as never,
    })
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      {
        ensureCheckInStreakRewardSettlement: jest
          .fn()
          .mockResolvedValue({ id: 66 }),
        syncManualSettlementResult: jest.fn(),
      } as never,
    )
    jest
      .spyOn(service as any, 'getSettlementById')
      .mockResolvedValue({
        id: 66,
        settlementStatus: 2,
      })

    await expect(
      service.repairReward(
        {
          targetType: 2,
          grantId: 7,
        } as never,
        9,
      ),
    ).rejects.toThrow('签到奖励已进入终态失败，无需重试')
  })

  it('does not create settlement when resolved reward items are empty', async () => {
    const drizzle = createDrizzleStub({
      record: {
        id: 1,
        userId: 7,
        planId: 3,
        cycleId: 8,
        signDate: '2026-04-17',
        resolvedRewardItems: null,
        rewardSettlementId: null,
      },
    })
    const ensureCheckInRecordRewardSettlement = jest.fn()
    const syncManualSettlementResult = jest.fn()
    const settlementService = {
      ensureCheckInRecordRewardSettlement,
      syncManualSettlementResult,
    }
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      settlementService as never,
    )

    const success = await (service as any).settleRecordReward(1, {
      source: 'test',
    })

    expect(success).toBe(true)
    expect(
      ensureCheckInRecordRewardSettlement,
    ).not.toHaveBeenCalled()
    expect(syncManualSettlementResult).not.toHaveBeenCalled()
    expect(drizzle.__mocks.updateCheckInRecord).not.toHaveBeenCalled()
  })

  it('keeps durable failure when reward payload is non-empty but invalid', async () => {
    const drizzle = createDrizzleStub({
      record: {
        id: 2,
        userId: 7,
        planId: 3,
        cycleId: 8,
        signDate: '2026-04-17',
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 0 }],
        rewardSettlementId: null,
      },
      persistedRecord: {
        id: 2,
        userId: 7,
        planId: 3,
        cycleId: 8,
        signDate: '2026-04-17',
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 0 }],
        rewardSettlementId: null,
      },
    })
    const ensureCheckInRecordRewardSettlement = jest
      .fn()
      .mockResolvedValue({ id: 55 })
    const syncManualSettlementResult = jest.fn().mockResolvedValue(undefined)
    const settlementService = {
      ensureCheckInRecordRewardSettlement,
      syncManualSettlementResult,
    }
    const service = new CheckInExecutionService(
      drizzle,
      {} as never,
      settlementService as never,
    )

    const success = await (service as any).settleRecordReward(2, {
      source: 'test',
    })

    expect(success).toBe(false)
    expect(ensureCheckInRecordRewardSettlement).toHaveBeenCalledTimes(2)
    expect(syncManualSettlementResult).toHaveBeenCalledTimes(1)
    expect(syncManualSettlementResult).toHaveBeenCalledWith(
      55,
      expect.objectContaining({
        success: false,
      }),
      { isRetry: undefined },
    )
  })
})

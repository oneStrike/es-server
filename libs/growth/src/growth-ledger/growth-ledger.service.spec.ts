import {
  GrowthAssetTypeEnum,
  GrowthLedgerFailReasonEnum,
  GrowthRuleUsageSlotTypeEnum,
} from './growth-ledger.constant'
import { GrowthLedgerService } from './growth-ledger.service'

describe('GrowthLedgerService', () => {
  function createService() {
    const usageSlotWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn((payload: { slotType: GrowthRuleUsageSlotTypeEnum }) => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue(
              payload.slotType === GrowthRuleUsageSlotTypeEnum.DAILY
                ? [{ id: 1 }]
                : [],
            ),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        where: usageSlotWhereMock,
      })),
    }

    const drizzle = {
      withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
      schema: {
        growthRuleUsageSlot: {
          userId: 'userId',
          assetType: 'assetType',
          ruleKey: 'ruleKey',
          slotType: 'slotType',
          slotValue: 'slotValue',
        },
      },
    }

    const service = new GrowthLedgerService(drizzle as never)

    jest.spyOn(service as any, 'findRuleByType').mockResolvedValue({
      id: 1,
      points: 5,
      dailyLimit: 1,
      totalLimit: 1,
      isEnabled: true,
    })
    jest.spyOn(service as any, 'createLedgerGate').mockResolvedValue({
      duplicated: false,
      recordId: 99,
    })
    jest.spyOn(service as any, 'deleteLedgerRecordById').mockResolvedValue(
      undefined,
    )
    jest.spyOn(service as any, 'writeAuditLog').mockResolvedValue(undefined)

    return {
      service,
      tx,
    }
  }

  it('daily 已占位但 total 拒绝时会回收本次 daily slot', async () => {
    const { service, tx } = createService()

    const result = await service.applyByRule(tx as never, {
      userId: 7,
      assetType: GrowthAssetTypeEnum.POINTS,
      ruleType: 101,
      bizKey: 'growth:rule:test',
    })

    expect(result).toEqual({
      success: false,
      reason: GrowthLedgerFailReasonEnum.TOTAL_LIMIT,
    })
    expect(tx.delete).toHaveBeenCalledTimes(1)
  })
})

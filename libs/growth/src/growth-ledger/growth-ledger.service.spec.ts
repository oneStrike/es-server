import type { DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum, GrowthLedgerActionEnum } from './growth-ledger.constant'
import { GrowthLedgerService } from './growth-ledger.service'

interface ExperienceRuleStub {
  id: number
  experience: number
  dailyLimit: number
  totalLimit: number
  isEnabled: boolean
}

interface GateDuplicateResultStub {
  duplicated: true
  result: {
    success: true
    duplicated: true
    deltaApplied: number
    beforeValue: number
    afterValue: number
    recordId: number
  }
}

interface TxStub {
  query: {
    appUser: {
      findFirst: jest.Mock
    }
  }
}

function createDrizzleStub() {
  return {
    db: {},
    schema: {
      appUser: {},
      growthAuditLog: {},
      growthLedgerRecord: {},
      growthRuleUsageSlot: {},
      userExperienceRule: {},
      userLevelRule: {},
      userPointRule: {},
    },
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService
}

describe('growthLedgerService', () => {
  it('syncs level using current user experience on duplicated rule-based experience grant', async () => {
    const service = new GrowthLedgerService(createDrizzleStub())
    const serviceRecord = service as unknown as Record<string, unknown>
    const txStub: TxStub = {
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({ experience: 999 }),
        },
      },
    }

    const findRuleByTypeMock = jest.fn<
      Promise<ExperienceRuleStub>,
      unknown[]
    >().mockResolvedValue({
      id: 1,
      experience: 20,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: true,
    })
    serviceRecord.findRuleByType = findRuleByTypeMock

    const createLedgerGateMock = jest.fn<
      Promise<GateDuplicateResultStub>,
      unknown[]
    >().mockResolvedValue({
      duplicated: true,
      result: {
        success: true,
        duplicated: true,
        deltaApplied: 20,
        beforeValue: 80,
        afterValue: 100,
        recordId: 11,
      },
    })
    serviceRecord.createLedgerGate = createLedgerGateMock

    const syncSpy = jest.fn<Promise<void>, [unknown, number, number?]>()
    syncSpy.mockResolvedValue(undefined)
    serviceRecord.syncUserLevelByExperience = syncSpy

    const result = await service.applyByRule(txStub as never, {
      userId: 7,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      ruleType: 1,
      bizKey: 'reward:duplicate',
    })

    expect(result.duplicated).toBe(true)
    expect(txStub.query.appUser.findFirst).toHaveBeenCalledWith({
      where: { id: 7 },
      columns: { experience: true },
    })
    expect(syncSpy).toHaveBeenCalledWith(txStub, 7, 999)
  })

  it('syncs level using current user experience on duplicated direct experience grant', async () => {
    const service = new GrowthLedgerService(createDrizzleStub())
    const serviceRecord = service as unknown as Record<string, unknown>
    const txStub: TxStub = {
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({ experience: 1200 }),
        },
      },
    }

    const createLedgerGateMock = jest.fn<
      Promise<GateDuplicateResultStub>,
      unknown[]
    >().mockResolvedValue({
      duplicated: true,
      result: {
        success: true,
        duplicated: true,
        deltaApplied: 50,
        beforeValue: 150,
        afterValue: 200,
        recordId: 15,
      },
    })
    serviceRecord.createLedgerGate = createLedgerGateMock

    const syncSpy = jest.fn<Promise<void>, [unknown, number, number?]>()
    syncSpy.mockResolvedValue(undefined)
    serviceRecord.syncUserLevelByExperience = syncSpy

    const result = await service.applyDelta(txStub as never, {
      userId: 8,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      action: GrowthLedgerActionEnum.GRANT,
      amount: 50,
      bizKey: 'reward:duplicate:delta',
      source: 'test',
    })

    expect(result.duplicated).toBe(true)
    expect(txStub.query.appUser.findFirst).toHaveBeenCalledWith({
      where: { id: 8 },
      columns: { experience: true },
    })
    expect(syncSpy).toHaveBeenCalledWith(txStub, 8, 1200)
  })
})

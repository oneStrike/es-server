import type { DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum, GrowthLedgerActionEnum } from './growth-ledger.constant'
import { GrowthLedgerService } from './growth-ledger.service'

interface ExperienceRuleStub {
  id: number
  dailyLimit: number
  totalLimit: number
  isEnabled: boolean
}

interface GateDuplicateResultStub {
  id: number
  assetKey: string
  delta: number
  beforeValue: number
  afterValue: number
}

interface TxStub {
  execute: jest.Mock
  query: {
    appUser: {
      findFirst: jest.Mock
    }
    userAssetBalance: {
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
      growthRuleUsageCounter: {},
      userAssetBalance: {},
      growthRewardRule: {},
      userLevelRule: {},
    },
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService
}

describe('growthLedgerService', () => {
  it('syncs level using current user experience on duplicated rule-based experience grant', async () => {
    const service = new GrowthLedgerService(createDrizzleStub())
    const serviceRecord = service as unknown as Record<string, unknown>
    const txStub: TxStub = {
      execute: jest.fn(),
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({ id: 7 }),
        },
        userAssetBalance: {
          findFirst: jest.fn().mockResolvedValue({ balance: 999 }),
        },
      },
    }

    const findRuleByTypeMock = jest.fn<
      Promise<ExperienceRuleStub>,
      unknown[]
    >().mockResolvedValue({
      id: 1,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: true,
    })
    serviceRecord.findRuleByType = findRuleByTypeMock

    serviceRecord.ensureLedgerOperationLock = jest
      .fn<Promise<void>, unknown[]>()
      .mockResolvedValue(undefined)
    const existingLedgerMock = jest.fn<
      Promise<GateDuplicateResultStub>,
      unknown[]
    >().mockResolvedValue({
      id: 11,
      assetKey: '',
      delta: 20,
      beforeValue: 80,
      afterValue: 100,
    })
    serviceRecord.findLedgerByUserBizKey = existingLedgerMock

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
    expect(txStub.query.userAssetBalance.findFirst).toHaveBeenCalledWith({
      where: { userId: 7, assetType: GrowthAssetTypeEnum.EXPERIENCE, assetKey: '' },
      columns: { balance: true },
    })
    expect(syncSpy).toHaveBeenCalledWith(txStub, 7, 999)
  })

  it('syncs level using current user experience on duplicated direct experience grant', async () => {
    const service = new GrowthLedgerService(createDrizzleStub())
    const serviceRecord = service as unknown as Record<string, unknown>
    const txStub: TxStub = {
      execute: jest.fn(),
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({ id: 8 }),
        },
        userAssetBalance: {
          findFirst: jest.fn().mockResolvedValue({ balance: 1200 }),
        },
      },
    }

    serviceRecord.ensureLedgerOperationLock = jest
      .fn<Promise<void>, unknown[]>()
      .mockResolvedValue(undefined)
    const existingLedgerMock = jest.fn<
      Promise<GateDuplicateResultStub>,
      unknown[]
    >().mockResolvedValue({
      id: 15,
      assetKey: '',
      delta: 50,
      beforeValue: 150,
      afterValue: 200,
    })
    serviceRecord.findLedgerByUserBizKey = existingLedgerMock

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
    expect(txStub.query.userAssetBalance.findFirst).toHaveBeenCalledWith({
      where: { userId: 8, assetType: GrowthAssetTypeEnum.EXPERIENCE, assetKey: '' },
      columns: { balance: true },
    })
    expect(syncSpy).toHaveBeenCalledWith(txStub, 8, 1200)
  })
})

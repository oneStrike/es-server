import type { DrizzleService } from '@db/core'
import { DrizzleService as DrizzleServiceToken } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { GrowthRewardSettlementService } from '../growth-reward/growth-reward-settlement.service'
import { CheckInExecutionService } from './check-in-execution.service'

function createDrizzleStub() {
  return {
    db: {},
    schema: {
      checkInPlan: {},
      checkInCycle: {},
      checkInRecord: {},
      checkInStreakRewardGrant: {},
      growthRewardSettlement: {},
      growthLedgerRecord: {},
      growthAuditLog: {},
      userAssetBalance: {},
      appUser: {},
      userLevelRule: {},
      growthRewardRule: {},
    },
    ext: {},
    buildPage: jest.fn(),
  } as unknown as DrizzleService
}

@Module({
  providers: [
    GrowthRewardSettlementService,
    {
      provide: DrizzleServiceToken,
      useValue: createDrizzleStub(),
    },
  ],
  exports: [GrowthRewardSettlementService],
})
class SettlementStorageTestModule {}

describe('checkInExecutionService dependency graph', () => {
  it('compiles when settlement storage is supplied by module imports', async () => {
    const moduleRef = Test.createTestingModule({
      imports: [SettlementStorageTestModule],
      providers: [
        CheckInExecutionService,
        {
          provide: GrowthLedgerService,
          useValue: {},
        },
        {
          provide: DrizzleServiceToken,
          useValue: createDrizzleStub(),
        },
      ],
    })

    await expect(moduleRef.compile()).resolves.toBeDefined()
  })
})

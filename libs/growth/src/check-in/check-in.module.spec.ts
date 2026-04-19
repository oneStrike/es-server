import type { DrizzleService } from '@db/core'
import { DrizzleService as DrizzleServiceToken } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { GrowthRewardSettlementService } from '../growth-reward/growth-reward-settlement.service'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInRuntimeService } from './check-in-runtime.service'
import { CheckInService } from './check-in.service'

function createDrizzleStub() {
  return {
    db: {},
    query: {},
    schema: {
      checkInConfig: {},
      checkInDailyStreakConfig: {},
      checkInDailyStreakProgress: {},
      checkInActivityStreak: {},
      checkInActivityStreakProgress: {},
      checkInStreakGrant: {},
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {},
      growthRewardSettlement: {},
      growthLedgerRecord: {},
      growthAuditLog: {},
      userAssetBalance: {},
      appUser: {},
      userLevelRule: {},
      growthRewardRule: {},
      growthRuleUsageCounter: {},
    },
    ext: {},
    buildPage: jest.fn(),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
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

describe('checkIn module dependency graph', () => {
  it('compiles when settlement storage is supplied by module imports', async () => {
    const moduleRef = Test.createTestingModule({
      imports: [SettlementStorageTestModule],
      providers: [
        CheckInDefinitionService,
        CheckInExecutionService,
        CheckInRuntimeService,
        CheckInService,
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

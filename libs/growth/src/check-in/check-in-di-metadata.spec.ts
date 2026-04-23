import 'reflect-metadata'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { GrowthRewardSettlementService } from '@libs/growth/growth-reward/growth-reward-settlement.service'
import { CheckInMakeupService } from './check-in-makeup.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInSettlementService } from './check-in-settlement.service'
import { CheckInStreakService } from './check-in-streak.service'

describe('check-in provider metadata', () => {
  it('preserves runtime constructor param types for Nest DI', () => {
    expect(
      Reflect.getMetadata('design:paramtypes', CheckInRewardPolicyService),
    ).toEqual([DrizzleService, GrowthLedgerService])

    expect(
      Reflect.getMetadata('design:paramtypes', CheckInMakeupService),
    ).toEqual([DrizzleService, GrowthLedgerService])

    expect(
      Reflect.getMetadata('design:paramtypes', CheckInStreakService),
    ).toEqual([DrizzleService, GrowthLedgerService])

    expect(
      Reflect.getMetadata('design:paramtypes', CheckInSettlementService),
    ).toEqual([
      DrizzleService,
      GrowthLedgerService,
      GrowthRewardSettlementService,
    ])
  })
})

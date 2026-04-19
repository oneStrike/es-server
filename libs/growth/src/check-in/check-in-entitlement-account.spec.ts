import type { DrizzleService } from '@db/core'
import { CheckInMakeupSourceTypeEnum } from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

class CheckInEntitlementHarness extends CheckInServiceSupport {
  exposeBuildConsumePlan(account: {
    periodicGranted: number
    periodicUsed: number
    eventAvailable: number
  }) {
    return this.buildMakeupConsumePlan(account as never)
  }
}

function createDrizzleStub() {
  return {
    db: {},
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
    },
  } as unknown as DrizzleService
}

describe('checkIn entitlement account', () => {
  it('consumes periodic allowance first', () => {
    const service = new CheckInEntitlementHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(
      service.exposeBuildConsumePlan({
        periodicGranted: 2,
        periodicUsed: 1,
        eventAvailable: 3,
      }),
    ).toEqual([
      {
        sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
        amount: 1,
      },
    ])
  })

  it('falls back to event cards when periodic allowance is exhausted', () => {
    const service = new CheckInEntitlementHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(
      service.exposeBuildConsumePlan({
        periodicGranted: 2,
        periodicUsed: 2,
        eventAvailable: 3,
      }),
    ).toEqual([
      {
        sourceType: CheckInMakeupSourceTypeEnum.EVENT_CARD,
        amount: 1,
      },
    ])
  })
})

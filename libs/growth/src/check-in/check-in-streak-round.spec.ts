import type { DrizzleService } from '@db/core'
import { CheckInServiceSupport } from './check-in.service.support'

class CheckInStreakHarness extends CheckInServiceSupport {
  exposeNormalizeRules(value: unknown) {
    return this.normalizeStreakRewardRules(value as never)
  }
}

function createDrizzleStub() {
  return {
    db: {},
    schema: {
      checkInConfig: {},
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {},
      checkInStreakRoundConfig: {},
      checkInStreakProgress: {},
      checkInStreakRewardGrant: {},
      growthRewardSettlement: {},
    },
  } as unknown as DrizzleService
}

describe('checkIn streak round rules', () => {
  it('sorts rules by streakDays and ruleCode', () => {
    const service = new CheckInStreakHarness(createDrizzleStub(), {} as never)

    expect(
      service.exposeNormalizeRules([
        {
          ruleCode: 'rule-b',
          streakDays: 7,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        },
        {
          ruleCode: 'rule-a',
          streakDays: 3,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 5 }],
        },
      ]),
    ).toMatchObject([
      { ruleCode: 'rule-a', streakDays: 3 },
      { ruleCode: 'rule-b', streakDays: 7 },
    ])
  })
})

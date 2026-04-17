import type { DrizzleService } from '@db/core'
import { CheckInRewardSourceTypeEnum } from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

class CheckInServiceSupportTestHarness extends CheckInServiceSupport {
  exposeParseRewardItems(value: unknown) {
    return this.parseRewardItems(value as never, { allowEmpty: false })
  }

  exposeResolveRewardForDate(input: {
    signDate: string
    rewardDefinition: Parameters<CheckInServiceSupport['resolveRewardForDate']>[1]
  }) {
    return this.resolveRewardForDate(1, input.rewardDefinition, input.signDate)
  }
}

function createDrizzleStub() {
  return {
    db: {},
    schema: {
      checkInPlan: {},
      checkInCycle: {},
      checkInRecord: {},
      checkInStreakRewardGrant: {},
      growthRewardSettlement: {},
    },
  } as unknown as DrizzleService
}

describe('checkInServiceSupport rewardItems contract', () => {
  it('accepts rewardItems arrays and keeps configured assets', () => {
    const service = new CheckInServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(
      service.exposeParseRewardItems([
        { assetType: 1, assetKey: '', amount: 10 },
        { assetType: 2, assetKey: '', amount: 5 },
      ]),
    ).toEqual([
      { assetType: 1, assetKey: '', amount: 10 },
      { assetType: 2, assetKey: '', amount: 5 },
    ])
  })

  it('rejects the legacy rewardConfig object contract', () => {
    const service = new CheckInServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(() =>
      service.exposeParseRewardItems({ points: 10, experience: 5 }),
    ).toThrow('奖励项非法')
  })

  it('resolves base reward items through the unified reward definition', () => {
    const service = new CheckInServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(
      service.exposeResolveRewardForDate({
        signDate: '2026-04-01',
        rewardDefinition: {
          baseRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          dateRewardRules: [],
          patternRewardRules: [],
        },
      }),
    ).toEqual({
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.BASE_REWARD,
      resolvedRewardRuleKey: null,
      resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
    })
  })
})

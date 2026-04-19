import type { DrizzleService } from '@db/core'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInRewardSourceTypeEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

class CheckInServiceSupportTestHarness extends CheckInServiceSupport {
  exposeParseRewardItems(value: unknown) {
    return this.parseRewardItems(value as never, { allowEmpty: false })
  }

  exposeResolveRewardForDate(input: {
    signDate: string
    rewardDefinition: Parameters<
      CheckInServiceSupport['resolveRewardForDate']
    >[0]
    periodType: CheckInMakeupPeriodTypeEnum
  }) {
    return this.resolveRewardForDate(
      input.rewardDefinition,
      input.signDate,
      input.periodType,
    )
  }

  exposeBuildMakeupWindow(
    date: string,
    periodType: CheckInMakeupPeriodTypeEnum,
  ) {
    return this.buildMakeupWindow(date, periodType)
  }

  exposeNormalizePatternRewardRules(
    rules: unknown,
    periodType: CheckInMakeupPeriodTypeEnum,
  ) {
    return this.normalizePatternRewardRules(rules as never, periodType)
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

describe('checkInServiceSupport', () => {
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
        periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
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

  it('builds weekly makeup windows from monday to sunday', () => {
    const service = new CheckInServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(
      service.exposeBuildMakeupWindow(
        '2026-04-16',
        CheckInMakeupPeriodTypeEnum.WEEKLY,
      ),
    ).toEqual({
      periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodKey: 'week-2026-04-13',
      periodStartDate: '2026-04-13',
      periodEndDate: '2026-04-19',
    })
  })

  it('rejects weekday rules in monthly mode', () => {
    const service = new CheckInServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(() =>
      service.exposeNormalizePatternRewardRules(
        [
          {
            patternType: 1,
            weekday: 1,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          },
        ],
        CheckInMakeupPeriodTypeEnum.MONTHLY,
      ),
    ).toThrow('按月模式下仅支持按月日期或月末奖励规则')
  })

  it('rejects duplicate month-last-day rules in monthly mode', () => {
    const service = new CheckInServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
    )

    expect(() =>
      service.exposeNormalizePatternRewardRules(
        [
          {
            patternType: 3,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          },
          {
            patternType: 3,
            rewardItems: [{ assetType: 2, assetKey: '', amount: 5 }],
          },
        ],
        CheckInMakeupPeriodTypeEnum.MONTHLY,
      ),
    ).toThrow('周期模式奖励规则重复：按月最后一天')
  })
})

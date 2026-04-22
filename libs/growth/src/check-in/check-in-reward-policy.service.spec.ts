import { CheckInMakeupPeriodTypeEnum } from './check-in.constant'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'

describe('check-in reward policy service', () => {
  function createService() {
    return new CheckInRewardPolicyService({} as never, {} as never)
  }

  it('prefers explicit date reward over pattern and base rewards', () => {
    const service = createService()

    const result = service.resolveRewardForDate(
      {
        baseRewardItems: [{ assetType: 1, assetKey: '', amount: 1 }],
        dateRewardRules: [
          {
            rewardDate: '2026-04-22',
            rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          },
        ],
        patternRewardRules: [
          {
            patternType: 1,
            weekday: 3,
            monthDay: null,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 5 }],
          },
        ],
      },
      '2026-04-22',
      CheckInMakeupPeriodTypeEnum.WEEKLY,
    )

    expect(result).toMatchObject({
      resolvedRewardSourceType: 2,
      resolvedRewardRuleKey: 'DATE:2026-04-22',
      resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
    })
  })

  it('returns the next active streak reward strictly above the current streak', () => {
    const service = createService()

    const nextRule = service.resolveNextStreakReward(
      [
        {
          ruleCode: 'streak-day-2',
          streakDays: 2,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          repeatable: false,
          status: 2,
        },
        {
          ruleCode: 'streak-day-5',
          streakDays: 5,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 20 }],
          repeatable: false,
          status: 2,
        },
      ],
      2,
    )

    expect(nextRule).toMatchObject({
      ruleCode: 'streak-day-5',
      streakDays: 5,
    })
  })
})

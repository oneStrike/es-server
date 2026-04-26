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
        baseRewardItems: [
          {
            assetType: 1,
            assetKey: '',
            amount: 1,
            iconUrl: 'https://cdn.example.com/base.png',
          },
        ],
        dateRewardRules: [
          {
            rewardDate: '2026-04-22',
            rewardItems: [
              {
                assetType: 1,
                assetKey: '',
                amount: 10,
                iconUrl: 'https://cdn.example.com/date-item.png',
              },
            ],
            rewardOverviewIconUrl: 'https://cdn.example.com/date-overview.png',
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
        makeupIconUrl: 'https://cdn.example.com/makeup.png',
        rewardOverviewIconUrl: 'https://cdn.example.com/default-overview.png',
      },
      '2026-04-22',
      CheckInMakeupPeriodTypeEnum.WEEKLY,
    )

    expect(result).toMatchObject({
      resolvedRewardSourceType: 2,
      resolvedRewardRuleKey: 'DATE:2026-04-22',
      resolvedRewardItems: [
        {
          assetType: 1,
          assetKey: '',
          amount: 10,
          iconUrl: 'https://cdn.example.com/date-item.png',
        },
      ],
      resolvedRewardOverviewIconUrl:
        'https://cdn.example.com/date-overview.png',
      resolvedMakeupIconUrl: null,
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

  it('treats stored date locks with null reward items as explicit no-reward history', () => {
    const service = createService()

    const result = service.resolveRewardForDate(
      {
        baseRewardItems: [{ assetType: 1, assetKey: '', amount: 1 }],
        dateRewardRules: [
          {
            rewardDate: '2026-04-22',
            rewardItems: null,
            rewardOverviewIconUrl: 'https://cdn.example.com/date-overview.png',
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
        makeupIconUrl: 'https://cdn.example.com/makeup.png',
        rewardOverviewIconUrl: 'https://cdn.example.com/default-overview.png',
      },
      '2026-04-22',
      CheckInMakeupPeriodTypeEnum.WEEKLY,
    )

    expect(result).toEqual({
      resolvedRewardSourceType: null,
      resolvedRewardRuleKey: null,
      resolvedRewardItems: null,
      resolvedRewardOverviewIconUrl: null,
      resolvedMakeupIconUrl: null,
    })
  })

  it('accepts iconUrl on check-in reward items but still rejects unknown fields', () => {
    const service = createService()

    expect(
      service.parseRewardItems(
        [
          {
            assetType: 1,
            assetKey: '',
            amount: 8,
            iconUrl: 'https://cdn.example.com/reward-points.png',
          },
        ],
        {
          allowEmpty: false,
        },
      ),
    ).toEqual([
      {
        assetType: 1,
        assetKey: '',
        amount: 8,
        iconUrl: 'https://cdn.example.com/reward-points.png',
      },
    ])

    expect(() =>
      service.parseRewardItems(
        [
          {
            assetType: 1,
            assetKey: '',
            amount: 8,
            iconUrl: 'https://cdn.example.com/reward-points.png',
            badge: 'unexpected',
          },
        ] as never,
        {
          allowEmpty: false,
        },
      ),
    ).toThrow('暂不支持字段')
  })
})

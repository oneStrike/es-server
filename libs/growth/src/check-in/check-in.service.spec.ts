import type {
  CheckInGrantTriggerView,
  CheckInRecordDateOnlyView,
  CheckInStreakAggregationOptions,
  CheckInStreakRewardRuleView,
  StreakRulePageOrderItem,
} from './check-in.type'
import { GrowthAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInStreakConfigStatusEnum } from './check-in.constant'
import { CheckInStreakService } from './check-in-streak.service'

describe('check-in helpers', () => {
  function createDefinitionService() {
    return new CheckInDefinitionService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
  }

  function createStreakService() {
    return new CheckInStreakService({} as never, {} as never)
  }

  it('uses the default streak rule page sort when orderBy is empty', () => {
    const service = createDefinitionService()

    const orderItems = (
      service as unknown as {
        parseStreakRulePageOrderBy: (
          orderBy?: string,
        ) => StreakRulePageOrderItem[]
      }
    ).parseStreakRulePageOrderBy()

    expect(orderItems).toEqual([
      { field: 'streakDays', direction: 'asc' },
      { field: 'version', direction: 'desc' },
      { field: 'id', direction: 'desc' },
    ])
  })

  it('rejects unsupported streak rule page sort fields', () => {
    const service = createDefinitionService()

    expect(() =>
      (
        service as unknown as {
          parseStreakRulePageOrderBy: (
            orderBy?: string,
          ) => StreakRulePageOrderItem[]
        }
      ).parseStreakRulePageOrderBy('[{"unknown":"asc"}]'),
    ).toThrow('不支持的排序字段：unknown')
  })

  it('recomputes streak aggregation from unsorted records and honors scope start', () => {
    const streakService = createStreakService()

    const aggregation = streakService.recomputeStreakAggregation(
      [
        { signDate: '2026-04-18' },
        { signDate: '2026-04-16' },
        { signDate: '2026-04-17' },
      ],
      { streakStartedAt: '2026-04-16' },
    )

    expect(aggregation).toEqual({
      currentStreak: 3,
      streakStartedAt: '2026-04-16',
      lastSignedDate: '2026-04-18',
      streakByDate: {
        '2026-04-16': 1,
        '2026-04-17': 2,
        '2026-04-18': 3,
      },
    })
  })

  it('keeps non-repeatable grants single-fire and skips repeatable grants that already exist', () => {
    const streakService = createStreakService()

    const candidates = streakService.resolveEligibleGrantRules(
      [
        {
          ruleCode: 'streak-day-2',
          streakDays: 2,
          repeatable: false,
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          rewardItems: [
            {
              assetType: GrowthAssetTypeEnum.POINTS,
              assetKey: '',
              amount: 10,
            },
          ],
        },
        {
          ruleCode: 'streak-day-3',
          streakDays: 3,
          repeatable: true,
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          rewardItems: [
            {
              assetType: GrowthAssetTypeEnum.POINTS,
              assetKey: '',
              amount: 20,
            },
          ],
        },
      ],
      {
        '2026-04-17': 2,
        '2026-04-18': 3,
        '2026-04-21': 3,
      },
      [
        { ruleCode: 'streak-day-2', triggerSignDate: '2026-04-17' },
        { ruleCode: 'streak-day-3', triggerSignDate: '2026-04-18' },
      ],
      '2026-04-17',
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      triggerSignDate: '2026-04-21',
      rule: {
        ruleCode: 'streak-day-3',
        streakDays: 3,
      },
    })
  })
})

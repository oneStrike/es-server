import { BadRequestException } from '@nestjs/common'
import {
  CheckInCycleTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakRewardRuleStatusEnum,
} from '../check-in.constant'
import { CheckInServiceSupport } from '../check-in.service.support'

function getSupportMethod(name: string) {
  return (
    CheckInServiceSupport.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >
  )[name]
}

class CheckInServiceSupportHarness extends CheckInServiceSupport {
  callNormalizeDateRewardRules(...args: unknown[]) {
    return getSupportMethod('normalizeDateRewardRules').call(this, ...args)
  }

  callNormalizePatternRewardRules(...args: unknown[]) {
    return getSupportMethod('normalizePatternRewardRules').call(this, ...args)
  }

  callBuildRewardDefinition(...args: unknown[]) {
    return getSupportMethod('buildRewardDefinition').call(this, ...args)
  }

  callBuildCycleFrame(...args: unknown[]) {
    return getSupportMethod('buildCycleFrame').call(this, ...args)
  }

  callResolveRewardForDate(...args: unknown[]) {
    return getSupportMethod('resolveRewardForDate').call(this, ...args)
  }
}

describe('check-in service support reward rules', () => {
  let service: CheckInServiceSupportHarness

  beforeEach(() => {
    service = new CheckInServiceSupportHarness(
      {
        db: {},
        schema: {},
      } as any,
      {} as any,
    )
  })

  it('会拦截落在计划窗口外的具体日期奖励规则', () => {
    expect(() =>
      service.callNormalizeDateRewardRules(
        [
          {
            rewardDate: '2026-05-01',
            rewardConfig: { points: 10 },
          },
        ],
        '2026-04-01',
        '2026-04-30',
      ),
    ).toThrow(new BadRequestException('具体日期奖励必须落在计划窗口内'))
  })

  it('允许月计划里 MONTH_LAST_DAY 与 MONTH_DAY=31 共存', () => {
    const normalizedRules = service.callNormalizePatternRewardRules(
      [
        {
          patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
          rewardConfig: { points: 88 },
        },
        {
          patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
          monthDay: 31,
          rewardConfig: { experience: 31 },
        },
      ],
      CheckInCycleTypeEnum.MONTHLY,
    )

    expect(normalizedRules).toHaveLength(2)
    expect(normalizedRules).toEqual(
      expect.arrayContaining([
        {
          patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
          weekday: null,
          monthDay: null,
          rewardConfig: { points: 88 },
        },
        {
          patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
          weekday: null,
          monthDay: 31,
          rewardConfig: { experience: 31 },
        },
      ]),
    )
  })

  it('构建奖励定义时会统一收口默认奖励、具体日期规则、周期模式规则和连续奖励规则', () => {
    const rewardDefinition = service.callBuildRewardDefinition({
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-05-31',
      baseRewardConfig: { points: 10 },
      dateRewardRules: [
        {
          rewardDate: '2026-04-30',
          rewardConfig: { experience: 300 },
        },
      ],
      patternRewardRules: [
        {
          patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
          rewardConfig: { points: 30 },
        },
      ],
      streakRewardRules: [
        {
          ruleCode: 'streak-7',
          streakDays: 7,
          rewardConfig: { points: 70 },
          repeatable: false,
          status: CheckInStreakRewardRuleStatusEnum.ENABLED,
        },
      ],
    })

    expect(rewardDefinition).toEqual({
      baseRewardConfig: { points: 10 },
      dateRewardRules: [
        {
          rewardDate: '2026-04-30',
          rewardConfig: { experience: 300 },
        },
      ],
      patternRewardRules: [
        {
          patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
          weekday: null,
          monthDay: null,
          rewardConfig: { points: 30 },
        },
      ],
      streakRewardRules: [
        {
          ruleCode: 'streak-7',
          streakDays: 7,
          rewardConfig: { points: 70 },
          repeatable: false,
          status: CheckInStreakRewardRuleStatusEnum.ENABLED,
        },
      ],
    })
  })

  it('会按具体日期规则 > 月底模式 > 月固定日期模式 > 默认奖励顺序解析，并返回稳定规则键', () => {
    const dateHit = service.callResolveRewardForDate(
      CheckInCycleTypeEnum.MONTHLY,
      {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-30',
            rewardConfig: { points: 300 },
          },
        ],
        patternRewardRules: [
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
            weekday: null,
            monthDay: null,
            rewardConfig: { points: 30 },
          },
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
            weekday: null,
            monthDay: 15,
            rewardConfig: { experience: 15 },
          },
        ],
      },
      '2026-04-30',
    )

    expect(dateHit).toEqual({
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
      resolvedRewardRuleKey: 'DATE:2026-04-30',
      resolvedRewardConfig: { points: 300 },
    })

    const monthLastDayHit = service.callResolveRewardForDate(
      CheckInCycleTypeEnum.MONTHLY,
      {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [],
        patternRewardRules: [
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
            weekday: null,
            monthDay: null,
            rewardConfig: { points: 30 },
          },
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
            weekday: null,
            monthDay: 30,
            rewardConfig: { experience: 15 },
          },
        ],
      },
      '2026-04-30',
    )

    expect(monthLastDayHit).toEqual({
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
      resolvedRewardRuleKey: 'MONTH_LAST_DAY',
      resolvedRewardConfig: { points: 30 },
    })

    const patternHit = service.callResolveRewardForDate(
      CheckInCycleTypeEnum.MONTHLY,
      {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [],
        patternRewardRules: [
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
            weekday: null,
            monthDay: null,
            rewardConfig: { points: 30 },
          },
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
            weekday: null,
            monthDay: 15,
            rewardConfig: { experience: 15 },
          },
        ],
      },
      '2026-04-15',
    )

    expect(patternHit).toEqual({
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
      resolvedRewardRuleKey: 'MONTH_DAY:15',
      resolvedRewardConfig: { experience: 15 },
    })

    const fallbackHit = service.callResolveRewardForDate(
      CheckInCycleTypeEnum.MONTHLY,
      {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [],
        patternRewardRules: [],
      },
      '2026-04-16',
    )

    expect(fallbackHit).toEqual({
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.BASE_REWARD,
      resolvedRewardRuleKey: null,
      resolvedRewardConfig: { points: 5 },
    })
  })
})

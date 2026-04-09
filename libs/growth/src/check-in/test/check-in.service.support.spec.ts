import { BadRequestException } from '@nestjs/common'
import {
  CheckInCycleTypeEnum,
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

  callBuildPlanSnapshot(...args: unknown[]) {
    return getSupportMethod('buildPlanSnapshot').call(this, ...args)
  }

  callBuildCycleFrame(...args: unknown[]) {
    return getSupportMethod('buildCycleFrame').call(this, ...args)
  }

  callResolveSnapshotRewardForDate(...args: unknown[]) {
    return getSupportMethod('resolveSnapshotRewardForDate').call(this, ...args)
  }

  callShouldBumpPlanVersion(...args: unknown[]) {
    return getSupportMethod('shouldBumpPlanVersion').call(this, ...args)
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
        1,
        3,
        '2026-04-01',
        '2026-04-30',
      ),
    ).toThrow(new BadRequestException('具体日期奖励必须落在计划窗口内'))
  })

  it('会拦截月计划里 MONTH_LAST_DAY 与 MONTH_DAY=31 的冲突配置', () => {
    expect(() =>
      service.callNormalizePatternRewardRules(
        [
          {
            patternType: 'MONTH_LAST_DAY',
            rewardConfig: { points: 88 },
          },
          {
            patternType: 'MONTH_DAY',
            monthDay: 31,
            rewardConfig: { experience: 31 },
          },
        ],
        1,
        3,
        CheckInCycleTypeEnum.MONTHLY,
      ),
    ).toThrow(
      new BadRequestException(
        'MONTH_LAST_DAY 不能与 MONTH_DAY=29/30/31 同时配置',
      ),
    )
  })

  it('构建周期快照时会同时冻结具体日期规则、周期模式规则与默认基础奖励', () => {
    const snapshot = service.callBuildPlanSnapshot(
      {
        id: 1,
        planCode: 'growth-check-in',
        planName: '成长签到',
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-05-31',
        allowMakeupCountPerCycle: 2,
        baseRewardConfig: { points: 10 },
        version: 3,
      },
      [
        {
          id: 31,
          planVersion: 3,
          ruleCode: 'streak-7',
          streakDays: 7,
          rewardConfig: { points: 70 },
          repeatable: false,
          status: CheckInStreakRewardRuleStatusEnum.ENABLED,
        },
      ],
      [
        {
          id: 22,
          planId: 1,
          planVersion: 3,
          rewardDate: '2026-04-30',
          rewardConfig: { experience: 300 },
        },
      ],
      [
        {
          id: 21,
          planId: 1,
          planVersion: 3,
          patternType: 'MONTH_LAST_DAY',
          weekday: null,
          monthDay: null,
          rewardConfig: { points: 30 },
        },
      ],
    )

    expect(snapshot).toEqual({
      id: 1,
      planCode: 'growth-check-in',
      planName: '成长签到',
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-05-31',
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: { points: 10 },
      version: 3,
      dateRewardRules: [
        {
          id: 22,
          planVersion: 3,
          rewardDate: '2026-04-30',
          rewardConfig: { experience: 300 },
        },
      ],
      patternRewardRules: [
        {
          id: 21,
          planVersion: 3,
          patternType: 'MONTH_LAST_DAY',
          weekday: null,
          monthDay: null,
          rewardConfig: { points: 30 },
        },
      ],
      streakRewardRules: [
        {
          id: 31,
          planVersion: 3,
          ruleCode: 'streak-7',
          streakDays: 7,
          rewardConfig: { points: 70 },
          repeatable: false,
          status: CheckInStreakRewardRuleStatusEnum.ENABLED,
        },
      ],
    })
  })

  it('会按具体日期规则 > 周期模式规则 > 默认奖励顺序解析', () => {
    const dateHit = service.callResolveSnapshotRewardForDate(
      {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            id: 21,
            planVersion: 3,
            rewardDate: '2026-04-30',
            rewardConfig: { points: 300 },
          },
        ],
        patternRewardRules: [
          {
            id: 22,
            planVersion: 3,
            patternType: 'MONTH_LAST_DAY',
            weekday: null,
            monthDay: null,
            rewardConfig: { points: 30 },
          },
          {
            id: 23,
            planVersion: 3,
            patternType: 'MONTH_DAY',
            weekday: null,
            monthDay: 15,
            rewardConfig: { experience: 15 },
          },
        ],
      },
      '2026-04-30',
    )

    expect(dateHit).toEqual({
      resolvedRewardSourceType: 'DATE_RULE',
      resolvedRewardRuleId: 21,
      resolvedRewardConfig: { points: 300 },
    })

    const patternHit = service.callResolveSnapshotRewardForDate(
      {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        baseRewardConfig: { points: 5 },
        dateRewardRules: [],
        patternRewardRules: [
          {
            id: 23,
            planVersion: 3,
            patternType: 'MONTH_DAY',
            weekday: null,
            monthDay: 15,
            rewardConfig: { experience: 15 },
          },
        ],
      },
      '2026-04-15',
    )

    expect(patternHit).toEqual({
      resolvedRewardSourceType: 'PATTERN_RULE',
      resolvedRewardRuleId: 23,
      resolvedRewardConfig: { experience: 15 },
    })

    const fallbackHit = service.callResolveSnapshotRewardForDate(
      {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        baseRewardConfig: { points: 5 },
        dateRewardRules: [],
        patternRewardRules: [],
      },
      '2026-04-16',
    )

    expect(fallbackHit).toEqual({
      resolvedRewardSourceType: 'BASE_REWARD',
      resolvedRewardRuleId: null,
      resolvedRewardConfig: { points: 5 },
    })
  })

  it('具体日期规则变更会触发计划版本递增', () => {
    const result = service.callShouldBumpPlanVersion({
      currentPlan: {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
        baseRewardConfig: { points: 5 },
      },
      nextPlan: {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
        baseRewardConfig: { points: 5 },
      },
      currentDateRules: [],
      nextDateRules: [
        {
          planId: 1,
          planVersion: 1,
          rewardDate: '2026-04-03',
          rewardConfig: { points: 10 },
        },
      ],
      currentPatternRules: [],
      nextPatternRules: [],
      currentRules: [],
      nextRules: [],
    })

    expect(result).toBe(true)
  })
})

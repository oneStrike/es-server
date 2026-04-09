import { BadRequestException } from '@nestjs/common'
import {
  CheckInCycleTypeEnum,
  CheckInStreakRewardRuleStatusEnum,
} from '../check-in.constant'
import { CheckInServiceSupport } from '../check-in.service.support'

class CheckInServiceSupportHarness extends CheckInServiceSupport {
  callNormalizeDailyRewardRules(...args: unknown[]) {
    return (CheckInServiceSupport.prototype as any).normalizeDailyRewardRules.call(
      this,
      ...args,
    )
  }

  callBuildPlanSnapshot(...args: unknown[]) {
    return (CheckInServiceSupport.prototype as any).buildPlanSnapshot.call(
      this,
      ...args,
    )
  }

  callBuildCycleFrame(...args: unknown[]) {
    return (CheckInServiceSupport.prototype as any).buildCycleFrame.call(
      this,
      ...args,
    )
  }

  callResolveSnapshotRewardForDate(...args: unknown[]) {
    return (CheckInServiceSupport.prototype as any).resolveSnapshotRewardForDate.call(
      this,
      ...args,
    )
  }

  callShouldBumpPlanVersion(...args: unknown[]) {
    return (CheckInServiceSupport.prototype as any).shouldBumpPlanVersion.call(
      this,
      ...args,
    )
  }
}

describe('check-in service support daily reward foundation', () => {
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

  it('按周计划会拒绝超出 1..7 的按日奖励天序号', () => {
    expect(() =>
      service.callNormalizeDailyRewardRules(
        [
          {
            dayIndex: 8,
            rewardConfig: { points: 10 },
          },
        ],
        1,
        3,
        CheckInCycleTypeEnum.WEEKLY,
      ),
    ).toThrow(new BadRequestException('周计划奖励天序号必须在 1..7 之间'))
  })

  it('会拦截同一计划版本下重复的按日奖励天序号', () => {
    expect(() =>
      service.callNormalizeDailyRewardRules(
        [
          {
            dayIndex: 2,
            rewardConfig: { points: 10 },
          },
          {
            dayIndex: 2,
            rewardConfig: { experience: 20 },
          },
        ],
        1,
        3,
        CheckInCycleTypeEnum.MONTHLY,
      ),
    ).toThrow(new BadRequestException('按日奖励天序号重复：2'))
  })

  it('构建周期快照时会同时冻结默认基础奖励与按日奖励规则', () => {
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
          dayIndex: 3,
          rewardConfig: { experience: 30 },
        },
        {
          id: 21,
          planId: 1,
          planVersion: 3,
          dayIndex: 1,
          rewardConfig: { points: 10 },
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
      dailyRewardRules: [
        {
          id: 21,
          planVersion: 3,
          dayIndex: 1,
          rewardConfig: { points: 10 },
        },
        {
          id: 22,
          planVersion: 3,
          dayIndex: 3,
          rewardConfig: { experience: 30 },
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

  it('自然周周期会固定按周一到周日切片', () => {
    const frame = service.callBuildCycleFrame(
      {
        cycleType: CheckInCycleTypeEnum.WEEKLY,
        startDate: '2026-04-01',
      },
      new Date('2026-04-09T10:00:00.000Z'),
    )

    expect(frame).toEqual({
      cycleKey: 'week-2026-04-06',
      cycleStartDate: '2026-04-06',
      cycleEndDate: '2026-04-12',
    })
  })

  it('会按自然日优先解析按日奖励，未配置时回退默认基础奖励', () => {
    const result = service.callResolveSnapshotRewardForDate(
      {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        baseRewardConfig: { points: 5 },
        dailyRewardRules: [
          {
            id: 21,
            planVersion: 3,
            dayIndex: 3,
            rewardConfig: { points: 30 },
          },
        ],
      },
      '2026-04-03',
    )

    expect(result).toEqual({
      rewardDayIndex: 3,
      rewardConfig: { points: 30 },
    })

    const fallbackResult = service.callResolveSnapshotRewardForDate(
      {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        baseRewardConfig: { points: 5 },
        dailyRewardRules: [
          {
            id: 21,
            planVersion: 3,
            dayIndex: 3,
            rewardConfig: { points: 30 },
          },
        ],
      },
      '2026-04-04',
    )

    expect(fallbackResult).toEqual({
      rewardDayIndex: 4,
      rewardConfig: { points: 5 },
    })
  })

  it('默认基础奖励变更会触发计划版本递增', () => {
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
        baseRewardConfig: { points: 10 },
      },
      currentDailyRules: [],
      nextDailyRules: [],
      currentRules: [],
      nextRules: [],
    })

    expect(result).toBe(true)
  })
})

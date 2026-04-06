import { CheckInCycleTypeEnum, CheckInPlanStatusEnum, CheckInStreakRewardRuleStatusEnum } from '@libs/growth/check-in/check-in.constant';
import { CreateCheckInPlanDto } from '@libs/growth/check-in/dto/check-in-definition.dto';
import { CreateCheckInStreakRewardRuleDto } from '@libs/growth/check-in/dto/check-in-streak-reward-rule.dto';
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

describe('admin check-in dto reward config contract', () => {
  it('accepts object-based base reward config', () => {
    const dto = plainToInstance(CreateCheckInPlanDto, {
      allowMakeupCountPerCycle: 1,
      baseRewardConfig: { experience: 5, points: 10 },
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-01',
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.DRAFT,
    })

    expect(validateSync(dto)).toHaveLength(0)
  })

  it('rejects JSON string base reward config', () => {
    const dto = plainToInstance(CreateCheckInPlanDto, {
      allowMakeupCountPerCycle: 1,
      baseRewardConfig: '{"points":10,"experience":5}',
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-01',
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.DRAFT,
    })

    expect(validateSync(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'baseRewardConfig',
        }),
      ]),
    )
  })

  it('rejects JSON string streak reward config', () => {
    const dto = plainToInstance(CreateCheckInStreakRewardRuleDto, {
      repeatable: false,
      rewardConfig: '{"points":70}',
      ruleCode: 'streak-7',
      status: CheckInStreakRewardRuleStatusEnum.ENABLED,
      streakDays: 7,
    })

    expect(validateSync(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'rewardConfig',
        }),
      ]),
    )
  })

  it('rejects daily as a removed cycle type', () => {
    const dto = plainToInstance(CreateCheckInPlanDto, {
      allowMakeupCountPerCycle: 1,
      baseRewardConfig: { experience: 5, points: 10 },
      cycleType: 'daily',
      startDate: '2026-04-01',
      planCode: 'check-in-weekly',
      planName: '每周签到',
      status: CheckInPlanStatusEnum.DRAFT,
    })

    expect(validateSync(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'cycleType',
        }),
      ]),
    )
  })
})

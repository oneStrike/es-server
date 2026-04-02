import {
  CheckInCycleTypeEnum,
  CheckInPlanStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from '@libs/growth/check-in'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import {
  CreateCheckInPlanDto,
  CreateCheckInStreakRewardRuleDto,
} from './check-in.dto'

describe('admin check-in dto reward config contract', () => {
  it('accepts object-based base reward config', () => {
    const dto = plainToInstance(CreateCheckInPlanDto, {
      allowMakeupCountPerCycle: 1,
      baseRewardConfig: { experience: 5, points: 10 },
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-01',
      planCode: 'daily-check-in',
      planName: '每日签到',
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
      planCode: 'daily-check-in',
      planName: '每日签到',
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
})

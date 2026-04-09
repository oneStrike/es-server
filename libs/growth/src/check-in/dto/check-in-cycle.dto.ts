import type { CheckInPlanSnapshot } from '../check-in.type'
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto } from '@libs/platform/dto/base.dto';
import { CheckInCycleTypeEnum } from '../check-in.constant'

export class BaseCheckInCycleDto extends BaseDto {
  @NumberProperty({ description: '用户 ID。', example: 10001 })
  userId!: number

  @NumberProperty({
    description: '签到计划 ID。',
    example: 1,
  })
  planId!: number

  @StringProperty({
    description: '周期键；同用户同计划在同一周期内唯一。',
    example: 'week-2026-03-30',
    maxLength: 32,
  })
  cycleKey!: string

  @StringProperty({
    description: '周期开始日期（date 语义）。',
    example: '2026-03-30',
    type: 'ISO8601',
  })
  cycleStartDate!: string

  @StringProperty({
    description: '周期结束日期（date 语义）。',
    example: '2026-04-05',
    type: 'ISO8601',
  })
  cycleEndDate!: string

  @NumberProperty({
    description: '当前周期已签天数。',
    example: 3,
    validation: false,
  })
  signedCount!: number

  @NumberProperty({
    description: '当前周期已使用的补签次数。',
    example: 1,
    validation: false,
  })
  makeupUsedCount!: number

  @NumberProperty({
    description: '当前周期连续签到天数。',
    example: 3,
    validation: false,
  })
  currentStreak!: number

  @StringProperty({
    description: '最近签到日期（date 语义）；为空表示当前周期还没有有效签到。',
    example: '2026-04-01',
    required: false,
    type: 'ISO8601',
    validation: false,
  })
  lastSignedDate?: string | null

  @NumberProperty({
    description: '周期快照版本号。',
    example: 1,
    validation: false,
  })
  planSnapshotVersion!: number

  @JsonProperty({
    description: '周期快照；冻结了当前周期实际解释所使用的计划、按日奖励规则与连续奖励规则。',
    example: {
      id: 1,
      planCode: 'growth-check-in',
      planName: '成长签到',
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-01',
      endDate: '2026-05-31',
      allowMakeupCountPerCycle: 2,
      version: 1,
      dailyRewardRules: [],
      streakRewardRules: [],
    } satisfies CheckInPlanSnapshot,
    validation: false,
  })
  planSnapshot!: CheckInPlanSnapshot

  @NumberProperty({
    description: '周期聚合版本号；用于并发更新控制。',
    example: 0,
    validation: false,
  })
  version!: number
}

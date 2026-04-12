import type { CheckInRewardConfig } from '../check-in.type'
import { DateProperty } from '@libs/platform/decorators/validate/date-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import {
  CheckInCycleTypeEnum,
  CheckInPlanStatusEnum,
} from '../check-in.constant'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'

export class BaseCheckInPlanDto extends BaseDto {
  @StringProperty({
    description: '签到计划编码。',
    example: 'growth-check-in',
    maxLength: 50,
  })
  planCode!: string

  @StringProperty({
    description: '签到计划名称。',
    example: '成长签到',
    maxLength: 200,
  })
  planName!: string

  @EnumProperty({
    description:
      '签到计划状态（0=草稿；1=已发布；2=已下线；3=已停用）',
    example: CheckInPlanStatusEnum.DRAFT,
    enum: CheckInPlanStatusEnum,
  })
  status!: CheckInPlanStatusEnum

  @EnumProperty({
    description:
      '周期类型（weekly=按周切分；monthly=按月切分）',
    example: CheckInCycleTypeEnum.WEEKLY,
    enum: CheckInCycleTypeEnum,
  })
  cycleType!: CheckInCycleTypeEnum

  @StringProperty({
    description: '计划开始日期（date 语义，同时作为计划生效窗口起点）。',
    example: '2026-04-01',
    type: 'ISO8601',
  })
  startDate!: string

  @NumberProperty({
    description: '每周期允许补签次数。',
    example: 2,
    min: 0,
  })
  allowMakeupCountPerCycle!: number

  @NestedProperty({
    description:
      '计划默认基础奖励配置；当天未命中具体日期奖励和周期模式奖励时回退到该配置。',
    type: CheckInRewardConfigDto,
    example: { points: 10, experience: 5 } satisfies CheckInRewardConfig,
    required: false,
  })
  baseRewardConfig?: CheckInRewardConfigDto | null

  @StringProperty({
    description: '计划结束日期（date 语义）；为空表示长期有效。',
    example: '2026-05-01',
    required: false,
    type: 'ISO8601',
  })
  endDate?: string | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

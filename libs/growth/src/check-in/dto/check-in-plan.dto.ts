import type { CheckInRewardConfig } from '../check-in.type'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { CheckInCycleTypeEnum, CheckInPlanStatusEnum } from '../check-in.constant'
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
      '签到计划状态（0=草稿，仅后台编辑；1=已发布，满足时间窗口时可对用户生效；2=已下线，不再对外开放；3=已停用，表示人工禁用）。',
    example: CheckInPlanStatusEnum.DRAFT,
    enum: CheckInPlanStatusEnum,
  })
  status!: CheckInPlanStatusEnum

  @EnumProperty({
    description:
      '周期类型（weekly=按周切分签到周期；monthly=按月切分签到周期）。',
    example: CheckInCycleTypeEnum.WEEKLY,
    enum: CheckInCycleTypeEnum,
  })
  cycleType!: CheckInCycleTypeEnum

  @StringProperty({
    description: '计划开始日期（date 语义，同时作为周期切片起点）。',
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
    description: '基础签到奖励配置；为空表示该计划没有基础奖励。',
    type: CheckInRewardConfigDto,
    example: { points: 10, experience: 5 } satisfies CheckInRewardConfig,
    required: false,
    nullable: true,
  })
  baseRewardConfig?: CheckInRewardConfigDto | null

  @NumberProperty({
    description: '计划版本号；影响周期快照冻结与规则版本切换。',
    example: 1,
    validation: false,
  })
  version!: number

  @StringProperty({
    description: '计划结束日期（date 语义）；为空表示长期有效。',
    example: '2026-05-01',
    required: false,
    type: 'ISO8601',
  })
  endDate?: string | null

  @DateProperty({
    description: '软删除时间；仅内部审计与排障使用。',
    example: '2026-05-01T00:00:00.000Z',
    required: false,
    contract: false,
  })
  deletedAt?: Date | null
}

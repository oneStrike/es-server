import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInRepairTargetTypeEnum,
} from '../check-in.constant'
import {
  BaseCheckInRecordDto,
  CheckInRewardSettlementSummaryDto,
} from './check-in-record.dto'

export class MakeupCheckInDto {
  @StringProperty({
    description: '需要补签的自然日，格式为 YYYY-MM-DD。',
    example: '2026-04-18',
  })
  signDate!: string
}

export class RepairCheckInRewardDto {
  @EnumProperty({
    description: '补偿目标类型（1=基础奖励；2=连续奖励）。',
    example: CheckInRepairTargetTypeEnum.RECORD_REWARD,
    enum: CheckInRepairTargetTypeEnum,
  })
  targetType!: CheckInRepairTargetTypeEnum

  @NumberProperty({
    description: '基础奖励对应的签到记录 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  recordId?: number

  @NumberProperty({
    description: '连续奖励对应的 grant ID。',
    example: 1,
    required: false,
    validation: false,
  })
  grantId?: number
}

export class RepairCheckInRewardResponseDto extends RepairCheckInRewardDto {
  @BooleanProperty({
    description: '本次补偿是否成功。',
    example: true,
    validation: false,
  })
  success!: boolean
}

export class CheckInActionResponseDto extends BaseCheckInRecordDto {
  @NestedProperty({
    description: '基础奖励结算摘要。',
    type: CheckInRewardSettlementSummaryDto,
    required: false,
    nullable: false,
    validation: false,
  })
  rewardSettlement?: CheckInRewardSettlementSummaryDto | null

  @EnumProperty({
    description: '当前补签周期类型（1=按自然周；2=按自然月）。',
    example: CheckInMakeupPeriodTypeEnum.WEEKLY,
    enum: CheckInMakeupPeriodTypeEnum,
    validation: false,
  })
  currentMakeupPeriodType!: CheckInMakeupPeriodTypeEnum

  @StringProperty({
    description: '当前补签周期键。',
    example: 'week-2026-04-14',
    validation: false,
  })
  currentMakeupPeriodKey!: string

  @NumberProperty({
    description: '当前周期剩余系统补签额度。',
    example: 1,
    validation: false,
  })
  periodicRemaining!: number

  @NumberProperty({
    description: '当前活动补签卡可用额度。',
    example: 0,
    validation: false,
  })
  eventAvailable!: number

  @NumberProperty({
    description: '当前连续签到天数。',
    example: 3,
    validation: false,
  })
  currentStreak!: number

  @ArrayProperty({
    description: '本次签到触发的连续奖励发放 ID 列表。',
    itemType: 'number',
    validation: false,
  })
  triggeredGrantIds!: number[]
}

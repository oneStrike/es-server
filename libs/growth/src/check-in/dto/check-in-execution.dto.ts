import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { ApiExtraModels, ApiProperty } from '@nestjs/swagger'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInRepairTargetTypeEnum,
} from '../check-in.constant'
import {
  AppCheckInRecordFieldsDto,
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

export class RepairCheckInStreakDto {
  @NumberProperty({
    description: '需要重算连续签到进度和连续奖励的用户 ID。',
    example: 1,
  })
  userId!: number
}

export class RepairCheckInStreakResponseDto {
  @NumberProperty({
    description: '已重算的用户 ID。',
    example: 1,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '重算后的当前连续签到天数。',
    example: 7,
    validation: false,
  })
  currentStreak!: number

  @StringProperty({
    description: '重算后的当前连续区间开始日期；无连续记录时为空。',
    example: '2026-04-13',
    nullable: true,
    validation: false,
  })
  streakStartedAt!: string | null

  @StringProperty({
    description: '重算后的最近签到日期；无签到记录时为空。',
    example: '2026-04-19',
    nullable: true,
    validation: false,
  })
  lastSignedDate!: string | null

  @ArrayProperty({
    description: '本次补齐创建的连续奖励发放 ID 列表。',
    itemType: 'number',
    validation: false,
  })
  createdGrantIds!: number[]

  @ArrayProperty({
    description: '本次成功补偿落账的连续奖励发放 ID 列表。',
    itemType: 'number',
    validation: false,
  })
  settledGrantIds!: number[]
}

@ApiExtraModels(CheckInRewardSettlementSummaryDto)
export class CheckInActionResponseDto extends BaseCheckInRecordDto {
  @ApiProperty({
    description: '基础奖励结算摘要。',
    required: false,
    nullable: true,
    type: CheckInRewardSettlementSummaryDto,
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
}

export class AppCheckInActionResponseDto extends AppCheckInRecordFieldsDto {
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
}

import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { BaseCheckInCycleDto } from './check-in-cycle.dto'
import {
  CheckInRecordIdDto,
  CheckInRemainingMakeupCountDto,
  CheckInRepairTargetTypeDto,
  OptionalCheckInGrantIdDto,
  OptionalCheckInRecordIdDto,
} from './check-in-fragment.dto'
import {
  BaseCheckInRecordDto,
  CheckInRewardSettlementSummaryDto,
} from './check-in-record.dto'

class CheckInActionBaseDto extends IntersectionType(
  PickType(BaseCheckInRecordDto, [
    'signDate',
    'recordType',
    'rewardSettlementId',
    'resolvedRewardSourceType',
    'resolvedRewardRuleKey',
    'resolvedRewardItems',
  ] as const),
  PickType(BaseCheckInCycleDto, ['currentStreak', 'signedCount'] as const),
) {}

export class MakeupCheckInDto extends PickType(BaseCheckInRecordDto, [
  'signDate',
] as const) {}

export class RepairCheckInRewardDto extends IntersectionType(
  CheckInRepairTargetTypeDto,
  OptionalCheckInRecordIdDto,
  OptionalCheckInGrantIdDto,
) {}

export class RepairCheckInRewardResponseDto extends IntersectionType(
  CheckInRepairTargetTypeDto,
  OptionalCheckInRecordIdDto,
  OptionalCheckInGrantIdDto,
) {
  @BooleanProperty({
    description: '是否补偿成功。',
    example: true,
    validation: false,
  })
  success!: boolean
}

export class CheckInActionResponseDto extends IntersectionType(
  CheckInActionBaseDto,
  CheckInRecordIdDto,
  PickType(BaseCheckInRecordDto, ['userId', 'planId', 'cycleId'] as const),
  CheckInRemainingMakeupCountDto,
) {
  @ArrayProperty({
    description: '本次触发的连续奖励发放事实 ID 列表。',
    itemType: 'number',
    example: [201],
    validation: false,
  })
  triggeredGrantIds!: number[]

  @BooleanProperty({
    description: '是否命中幂等并复用既有签到记录。',
    example: false,
    validation: false,
  })
  alreadyExisted!: boolean

  @NestedProperty({
    description: '基础奖励结算摘要。',
    type: CheckInRewardSettlementSummaryDto,
    required: false,
    nullable: false,
    validation: false,
  })
  rewardSettlement?: CheckInRewardSettlementSummaryDto | null
}

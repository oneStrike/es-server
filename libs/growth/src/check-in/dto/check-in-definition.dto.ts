import { ArrayProperty, NumberProperty } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { CheckInPageNoDateDto } from './check-in-fragment.dto'
import { BaseCheckInPlanDto } from './check-in-plan.dto'
import {
  CheckInStreakRewardRuleItemDto,
  CreateCheckInStreakRewardRuleDto,
} from './check-in-streak-reward-rule.dto'

export class CreateCheckInPlanDto extends OmitType(BaseCheckInPlanDto, [
  'id',
  'createdAt',
  'updatedAt',
  'version',
] as const) {
  @ArrayProperty({
    description: '连续签到奖励规则列表。',
    itemClass: CreateCheckInStreakRewardRuleDto,
    itemType: 'object',
    required: false,
  })
  streakRewardRules?: CreateCheckInStreakRewardRuleDto[]
}

export class UpdateCheckInPlanDto extends IntersectionType(
  PartialType(CreateCheckInPlanDto),
  IdDto,
) {}

export class UpdateCheckInPlanStatusDto extends IntersectionType(
  IdDto,
  PartialType(PickType(BaseCheckInPlanDto, ['status'] as const)),
) {}

export class QueryCheckInPlanDto extends IntersectionType(
  CheckInPageNoDateDto,
  PartialType(
    PickType(BaseCheckInPlanDto, [
      'planCode',
      'planName',
      'status',
    ] as const),
  ),
) {}

export class CheckInPlanPageItemDto extends BaseCheckInPlanDto {
  @NumberProperty({
    description: '当前版本连续奖励规则数量。',
    example: 3,
    validation: false,
  })
  ruleCount!: number

  @NumberProperty({
    description: '当前活跃周期实例数量。',
    example: 123,
    validation: false,
  })
  activeCycleCount!: number

  @NumberProperty({
    description: '待补偿奖励数量。',
    example: 4,
    validation: false,
  })
  pendingRewardCount!: number
}

export class CheckInPlanDetailResponseDto extends CheckInPlanPageItemDto {
  @ArrayProperty({
    description: '当前版本连续奖励规则列表。',
    itemClass: CheckInStreakRewardRuleItemDto,
    itemType: 'object',
    validation: false,
  })
  streakRewardRules!: CheckInStreakRewardRuleItemDto[]
}

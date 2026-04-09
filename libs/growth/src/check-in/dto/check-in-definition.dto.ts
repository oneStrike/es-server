import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { IdDto } from '@libs/platform/dto/base.dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  CheckInDailyRewardRuleItemDto,
  CreateCheckInDailyRewardRuleDto,
} from './check-in-daily-reward-rule.dto'
import { CheckInPageNoDateDto } from './check-in-fragment.dto'
import { BaseCheckInPlanDto } from './check-in-plan.dto'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'
import {
  CheckInStreakRewardRuleItemDto,
  CreateCheckInStreakRewardRuleDto,
} from './check-in-streak-reward-rule.dto'

export class CreateCheckInPlanDto extends OmitType(BaseCheckInPlanDto, [
  'id',
  'createdAt',
  'updatedAt',
  'version',
  'baseRewardConfig',
] as const) {}

export class UpdateCheckInPlanDto extends IntersectionType(
  PartialType(CreateCheckInPlanDto),
  IdDto,
) {}

class CheckInPlanRewardConfigFieldsDto {
  @NestedProperty({
    description: '计划默认基础奖励配置；当天未配置按日奖励时回退到该配置。',
    type: CheckInRewardConfigDto,
    required: false,
    nullable: true,
  })
  baseRewardConfig?: CheckInRewardConfigDto | null

  @ArrayProperty({
    description: '按日基础奖励规则列表。',
    itemClass: CreateCheckInDailyRewardRuleDto,
    itemType: 'object',
    required: false,
  })
  dailyRewardRules?: CreateCheckInDailyRewardRuleDto[]

  @ArrayProperty({
    description: '连续签到奖励规则列表。',
    itemClass: CreateCheckInStreakRewardRuleDto,
    itemType: 'object',
    required: false,
  })
  streakRewardRules?: CreateCheckInStreakRewardRuleDto[]
}

export class CreateCheckInPlanRewardConfigDto extends IntersectionType(
  IdDto,
  CheckInPlanRewardConfigFieldsDto,
) {}

export class UpdateCheckInPlanRewardConfigDto extends IntersectionType(
  IdDto,
  PartialType(CheckInPlanRewardConfigFieldsDto),
) {}

export class UpdateCheckInPlanStatusDto extends IntersectionType(
  IdDto,
  PartialType(PickType(BaseCheckInPlanDto, ['status'] as const)),
) {}

export class QueryCheckInPlanDto extends IntersectionType(
  CheckInPageNoDateDto,
  PartialType(
    PickType(BaseCheckInPlanDto, ['planCode', 'planName', 'status'] as const),
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
    description: '当前版本按日基础奖励规则列表。',
    itemClass: CheckInDailyRewardRuleItemDto,
    itemType: 'object',
    validation: false,
  })
  dailyRewardRules!: CheckInDailyRewardRuleItemDto[]

  @ArrayProperty({
    description: '当前版本连续奖励规则列表。',
    itemClass: CheckInStreakRewardRuleItemDto,
    itemType: 'object',
    validation: false,
  })
  streakRewardRules!: CheckInStreakRewardRuleItemDto[]
}

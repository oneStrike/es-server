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
  CheckInDateRewardRuleItemDto,
  CreateCheckInDateRewardRuleDto,
} from './check-in-date-reward-rule.dto'
import { CheckInPageNoDateDto } from './check-in-fragment.dto'
import { BaseCheckInPlanDto } from './check-in-plan.dto'
import {
  CheckInPatternRewardRuleItemDto,
  CreateCheckInPatternRewardRuleDto,
} from './check-in-pattern-reward-rule.dto'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'
import {
  CheckInStreakRewardRuleItemDto,
  CreateCheckInStreakRewardRuleDto,
} from './check-in-streak-reward-rule.dto'

class CheckInPlanRewardConfigFieldsDto {
  @NestedProperty({
    description: '计划默认基础奖励配置；当天未命中具体日期奖励和周期模式奖励时回退到该配置。',
    type: CheckInRewardConfigDto,
    required: false,
    nullable: false,
  })
  baseRewardConfig?: CheckInRewardConfigDto | null

  @ArrayProperty({
    description: '具体日期奖励规则列表。',
    itemClass: CreateCheckInDateRewardRuleDto,
    required: false,
  })
  dateRewardRules?: CreateCheckInDateRewardRuleDto[]

  @ArrayProperty({
    description:
      '周期模式奖励规则列表；月计划同日同时命中时按 MONTH_LAST_DAY 优先于 MONTH_DAY 解析。',
    itemClass: CreateCheckInPatternRewardRuleDto,
    required: false,
  })
  patternRewardRules?: CreateCheckInPatternRewardRuleDto[]

  @ArrayProperty({
    description: '连续签到奖励规则列表。',
    itemClass: CreateCheckInStreakRewardRuleDto,
    required: false,
  })
  streakRewardRules?: CreateCheckInStreakRewardRuleDto[]
}

export class CreateCheckInPlanDto extends IntersectionType(
  OmitType(BaseCheckInPlanDto, [
    'id',
    'createdAt',
    'updatedAt',
    'baseRewardConfig',
  ] as const),
  PartialType(CheckInPlanRewardConfigFieldsDto),
) {}

export class UpdateCheckInPlanDto extends IntersectionType(
  IdDto,
  PartialType(CreateCheckInPlanDto),
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
    description: '当前版本具体日期奖励规则列表。',
    itemClass: CheckInDateRewardRuleItemDto,
    validation: false,
  })
  dateRewardRules!: CheckInDateRewardRuleItemDto[]

  @ArrayProperty({
    description: '当前版本周期模式奖励规则列表。',
    itemClass: CheckInPatternRewardRuleItemDto,
    validation: false,
  })
  patternRewardRules!: CheckInPatternRewardRuleItemDto[]

  @ArrayProperty({
    description: '当前版本连续奖励规则列表。',
    itemClass: CheckInStreakRewardRuleItemDto,
    validation: false,
  })
  streakRewardRules!: CheckInStreakRewardRuleItemDto[]
}

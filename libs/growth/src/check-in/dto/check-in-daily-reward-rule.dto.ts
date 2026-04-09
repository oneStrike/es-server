import type { CheckInRewardConfig } from '../check-in.type'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { BaseDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { OmitType } from '@nestjs/swagger'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'

export class BaseCheckInDailyRewardRuleDto extends BaseDto {
  @NumberProperty({ description: '签到计划 ID。', example: 1 })
  planId!: number

  @NumberProperty({
    description: '归属计划版本号。',
    example: 1,
    validation: false,
  })
  planVersion!: number

  @NumberProperty({
    description: '奖励天序号。',
    example: 3,
    min: 1,
    max: 31,
  })
  dayIndex!: number

  @NestedProperty({
    description: '当天基础奖励配置。',
    type: CheckInRewardConfigDto,
    example: { points: 10, experience: 5 } satisfies CheckInRewardConfig,
  })
  rewardConfig!: CheckInRewardConfigDto
}

export class CreateCheckInDailyRewardRuleDto extends OmitType(
  BaseCheckInDailyRewardRuleDto,
  [...OMIT_BASE_FIELDS, 'planId', 'planVersion'] as const,
) {}

export class CheckInDailyRewardRuleItemDto extends OmitType(
  BaseCheckInDailyRewardRuleDto,
  ['createdAt', 'updatedAt', 'planId', 'planVersion'] as const,
) {}

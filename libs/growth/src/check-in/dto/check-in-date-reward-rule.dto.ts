import type { CheckInRewardConfig } from '../check-in.type'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { OmitType } from '@nestjs/swagger'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'

export class BaseCheckInDateRewardRuleDto extends BaseDto {
  @NumberProperty({ description: '签到计划 ID。', example: 1 })
  planId!: number

  @NumberProperty({
    description: '归属计划版本号。',
    example: 1,
    validation: false,
  })
  planVersion!: number

  @StringProperty({
    description: '命中的具体自然日。',
    example: '2026-04-30',
    type: 'ISO8601',
  })
  rewardDate!: string

  @NestedProperty({
    description: '该自然日命中的基础奖励配置。',
    type: CheckInRewardConfigDto,
    example: { points: 10, experience: 5 } satisfies CheckInRewardConfig,
  })
  rewardConfig!: CheckInRewardConfigDto
}

export class CreateCheckInDateRewardRuleDto extends OmitType(
  BaseCheckInDateRewardRuleDto,
  [...OMIT_BASE_FIELDS, 'planId', 'planVersion'] as const,
) {}

export class CheckInDateRewardRuleItemDto extends OmitType(
  BaseCheckInDateRewardRuleDto,
  ['createdAt', 'updatedAt', 'planId', 'planVersion'] as const,
) {}

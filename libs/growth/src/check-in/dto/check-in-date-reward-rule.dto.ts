import type { CheckInRewardConfig } from '../check-in.type'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'

class CheckInDateRewardRuleFieldsDto {
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

export class CreateCheckInDateRewardRuleDto extends CheckInDateRewardRuleFieldsDto {}

export class CheckInDateRewardRuleItemDto extends CheckInDateRewardRuleFieldsDto {}

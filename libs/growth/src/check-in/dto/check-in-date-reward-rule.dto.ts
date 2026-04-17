import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'

class CheckInDateRewardRuleFieldsDto {
  @StringProperty({
    description: '命中的具体自然日。',
    example: '2026-04-30',
    type: 'ISO8601',
  })
  rewardDate!: string

  @ArrayProperty({
    description: '该自然日命中的奖励项列表。',
    itemClass: GrowthRewardItemDto,
    example: [{ assetType: 1, amount: 10 }, { assetType: 2, amount: 5 }],
  })
  rewardItems!: GrowthRewardItemDto[]
}

export class CreateCheckInDateRewardRuleDto extends CheckInDateRewardRuleFieldsDto {}

export class CheckInDateRewardRuleItemDto extends CheckInDateRewardRuleFieldsDto {}

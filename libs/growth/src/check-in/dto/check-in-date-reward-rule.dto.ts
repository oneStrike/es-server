import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty, StringProperty } from '@libs/platform/decorators'

export class CheckInDateRewardRuleFieldsDto {
  @StringProperty({
    description: '奖励生效日期，格式为 YYYY-MM-DD。',
    example: '2026-04-19',
  })
  rewardDate!: string

  @ArrayProperty({
    description: '具体日期奖励项列表。',
    itemClass: GrowthRewardItemDto,
  })
  rewardItems!: GrowthRewardItemDto[]
}

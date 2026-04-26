import { ArrayProperty, StringProperty } from '@libs/platform/decorators'
import { CheckInRewardItemDto } from './check-in-reward-item.dto'

export class CheckInDateRewardRuleFieldsDto {
  @StringProperty({
    description: '奖励生效日期，格式为 YYYY-MM-DD。',
    example: '2026-04-19',
  })
  rewardDate!: string

  @ArrayProperty({
    description: '具体日期奖励项列表。',
    itemClass: CheckInRewardItemDto,
  })
  rewardItems!: CheckInRewardItemDto[]

  @StringProperty({
    description: '该日期奖励概览图标 URL。',
    example: 'https://cdn.example.com/check-in/date-overview.png',
    required: false,
    maxLength: 500,
  })
  rewardOverviewIconUrl?: string | null
}

import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { StringProperty } from '@libs/platform/decorators'

export class CheckInRewardItemDto extends GrowthRewardItemDto {
  @StringProperty({
    description: '签到奖励图标 URL。',
    example: 'https://cdn.example.com/check-in/reward-points.png',
    required: false,
    maxLength: 500,
  })
  iconUrl?: string | null
}

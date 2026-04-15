import type { CheckInRewardConfig } from '../check-in.type'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'

export class CheckInRewardConfigDto implements CheckInRewardConfig {
  @NumberProperty({
    description: '奖励积分；配置后表示本次签到或连续奖励会发放对应积分。',
    example: 10,
    min: 1,
    required: false,
  })
  points?: number

  @NumberProperty({
    description: '奖励经验值；配置后表示本次签到或连续奖励会发放对应经验。',
    example: 5,
    min: 1,
    required: false,
  })
  experience?: number
}

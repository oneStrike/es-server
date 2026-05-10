import { AdRewardService } from '@libs/interaction/ad-reward/ad-reward.service'
import {
  AdRewardResultDto,
  AdRewardVerificationDto,
} from '@libs/interaction/ad-reward/dto/ad-reward.dto'
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('广告激励')
@Controller('app/ad-reward')
export class AdRewardController {
  constructor(private readonly adRewardService: AdRewardService) {}

  // 创建广告奖励验证。
  @Post('verification/create')
  @ApiDoc({
    summary: '创建广告奖励验证',
    model: AdRewardResultDto,
  })
  async verifyAdReward(
    @Body() body: AdRewardVerificationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.adRewardService.verifyAdReward(userId, body)
  }
}

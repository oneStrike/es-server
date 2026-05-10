import { AdRewardModule as InteractionAdRewardModule } from '@libs/interaction/ad-reward/ad-reward.module'
import { Module } from '@nestjs/common'
import { AdRewardController } from './ad-reward.controller'

@Module({
  imports: [InteractionAdRewardModule],
  controllers: [AdRewardController],
})
export class AdminAdRewardModule {}
